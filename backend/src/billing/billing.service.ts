import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { KdsGateway } from '../kds/kds.gateway';
import { StockPolicyService } from './stock-policy.service';
import { PrintQueueService } from '../printer/print-queue.service';
import { kitchenSignature } from '../printer/print-document';
import { getBusinessDayBounds } from '../utils/date.util';
import { billTotals, paymentAllocation, ledgerView, readJson, ensurePersistedItemsPresent, financialSummary, immutableHistoryBill, itemSignature } from './financial';

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => KdsGateway))
    private readonly kdsGateway: KdsGateway,
    private readonly stockPolicy: StockPolicyService,
    private readonly printQueue: PrintQueueService,
  ) {}

  // 1. Create a new POS or Table-side Order
  async createOrder(data: {
    tableId?: string;
    waiterId?: string;
    customerId?: string;
    notes?: string;
    restaurantId: string;
    items: Array<{ productId: string; quantity: number; notes?: string }>;
  }) {
    if (!data.restaurantId) throw new UnauthorizedException('No restaurant context');
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item.');
    }

    // Calculate item prices from Product catalog
    let totalAmount = 0.0;
    const orderItemsData = [];

    for (const item of data.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new BadRequestException('Invalid item quantity');
      const product = await this.prisma.product.findUnique({ 
        where: { id: item.productId } 
      });
      // Ensure product belongs to this restaurant
      if (!product || product.isArchived || product.restaurantId !== data.restaurantId) {
        throw new NotFoundException(`Product ID ${item.productId} not found in this restaurant.`);
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        notes: item.notes || null,
      });
    }

    // Create Order in Database within an ACID transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = `KORD-${randomUUID()}`;

      for (const [model, id] of [['table', data.tableId], ['user', data.waiterId], ['customer', data.customerId]]) {
        if (id) {
          const related = await (tx as any)[model].findUnique({ where: { id } });
          if (!related || related.restaurantId !== data.restaurantId) throw new BadRequestException('Invalid restaurant reference');
        }
      }
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          restaurantId: data.restaurantId,
          tableId: data.tableId || null,
          waiterId: data.waiterId || null,
          customerId: data.customerId || null,
          notes: data.notes || null,
          totalAmount,
          items: {
            create: orderItemsData,
          },
        },
        include: { items: { include: { product: true } }, table: true },
      });

      // Update table status to OCCUPIED if applicable
      if (data.tableId) {
        // Ensure table belongs to this restaurant
        const table = await tx.table.findUnique({ where: { id: data.tableId } });
        if (table && table.restaurantId === data.restaurantId) {
          await tx.table.update({
            where: { id: data.tableId },
            data: { status: 'OCCUPIED', currentOrderId: newOrder.id },
          });
        }
      }

      await this.printQueue.kitchen(tx, data.restaurantId, `order:${newOrder.id}`, { reference: newOrder.orderNumber, orderType: newOrder.orderType, table: newOrder.table?.tableNumber, items: newOrder.items.map(item => ({ name: item.product.name, quantity: item.quantity, notes: item.notes })) }, data.waiterId || 'server');
      return newOrder;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    // Broadcast WebSocket ticket to KDS and Table Layout monitors in real time
    this.kdsGateway.server.to(data.restaurantId).emit('kds_new_ticket', {
      id: order.id,
      restaurantId: order.restaurantId,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.tableNumber || 'Takeaway',
      items: order.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        notes: i.notes,
        status: i.status,
      })),
      firedAt: order.createdAt,
    });

    if (order.tableId) {
      this.kdsGateway.server.to(data.restaurantId).emit('table_updated', {
        tableId: order.tableId,
        restaurantId: order.restaurantId,
        status: 'OCCUPIED',
        orderId: order.id,
      });
    }

    return order;
  }

  // 2. Calculate GST breakdown and discounts for billing settlement
  async calculateBillPreview(orderId: string, restaurantId: string, discountAmount: number = 0) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order || order.restaurantId !== restaurantId) {
      throw new NotFoundException(`Order ID ${orderId} not found.`);
    }

    const subtotal = order.totalAmount;
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) throw new BadRequestException('Invalid discount');
    // Calculate weighted GST (e.g. 5% standard dining GST => 2.5% CGST + 2.5% SGST)
    const totalGst = order.items.reduce((sum, item) => sum + item.price * item.quantity * (1 - discountAmount / (subtotal || 1)) * item.product.gstRate / 100, 0);
    const cgst = Number((totalGst / 2).toFixed(2));
    const sgst = Number((totalGst / 2).toFixed(2));
    const grandTotal = Number((subtotal - discountAmount + cgst + sgst).toFixed(2));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discountAmount.toFixed(2)),
      cgst,
      sgst,
      grandTotal,
    };
  }

  async settleBill(data: { orderId: string; paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT'; discount?: number }, restaurantId: string, cashierId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: data.orderId, restaurantId }, include: { items: true, bill: true } });
    if (!order) throw new NotFoundException('Order not found');
    const bill = await this.processDirectCheckout({
      billNumber: order.bill?.billNumber || `INV-${order.id}`, orderNumber: order.orderNumber, orderType: order.orderType,
      tableId: order.tableId, discount: data.discount || 0, paymentMethod: data.paymentMethod,
      items: order.items.map(item => ({ productId: item.productId, quantity: item.quantity, notes: item.notes, addons: item.addons ? JSON.parse(item.addons) : [] })),
    }, restaurantId, cashierId);
    return { bill, order: await this.prisma.order.findUnique({ where: { id: order.id } }) };
  }
  async pricedItems(tx: any, items: any[], restaurantId: string, persistedItems: any[] = []) {
    if (!Array.isArray(items) || !items.length || items.length > 500) throw new BadRequestException('Order must contain valid items');
    const raw = await tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } });
    let settings: any = {};
    try { settings = JSON.parse(raw?.data || '{}'); } catch {}
    const addonCatalog = settings.paidAddons || [
      { id: 'a1', name: 'Extra Mayonnaise', price: 20 }, { id: 'a2', name: 'Extra Cheese Slice', price: 30 },
      { id: 'a3', name: 'Peri Peri Dip', price: 15 }, { id: 'a4', name: 'Double Patty', price: 120 }, { id: 'a5', name: 'Hazelnut Syrup', price: 40 },
    ];
    const lines = [];
    const archivedQuantities = new Map<string, number>();
    for (const item of persistedItems) archivedQuantities.set(itemSignature(item), (archivedQuantities.get(itemSignature(item)) || 0) + item.quantity);
    for (const item of items) {
      if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) throw new BadRequestException('Invalid item quantity');
      let product = await tx.product.findUnique({ where: { id: item.productId } });
      if (typeof item.productId === 'string' && item.productId.startsWith('standalone-')) {
        const addon = addonCatalog.find((a: any) => `standalone-${a.id}` === item.productId && a.isActive !== false);
        if (!addon || !Number.isFinite(addon.price) || addon.price < 0) throw new BadRequestException('This standalone add-on is no longer available');
        const category = await tx.category.upsert({ where: { restaurantId_name: { restaurantId, name: 'Add-ons' } }, update: {}, create: { restaurantId, name: 'Add-ons' } });
        product = await tx.product.upsert({ where: { id: `addon:${restaurantId}:${addon.id}` }, update: { name: `+ ${addon.name}`, price: addon.price, isArchived: true }, create: { id: `addon:${restaurantId}:${addon.id}`, restaurantId, categoryId: category.id, name: `+ ${addon.name}`, price: addon.price, isAvailable: false, isArchived: true } });
      }
      if (!product || product.restaurantId !== restaurantId) throw new BadRequestException('Product not found in this restaurant');
      const addons = (item.addons || []).map((addon: any) => {
        const match = addonCatalog.find((a: any) => a.id === addon.id && a.isActive !== false);
        if (!match || !Number.isFinite(match.price) || match.price < 0) throw new BadRequestException('Invalid add-on');
        return { id: match.id, name: match.name, price: match.price };
      });
      if ((product.isArchived || !product.isAvailable) && !String(item.productId).startsWith('standalone-')) {
        const signature = itemSignature({ productId: product.id, addons });
        const remaining = archivedQuantities.get(signature) || 0;
        if (item.quantity > remaining) throw new BadRequestException(product.isArchived ? 'This menu item was deleted. Remove new quantities; already-sent quantities can still be settled.' : 'This menu item is marked unavailable. Remove new quantities; already-sent quantities can still be settled.');
        archivedQuantities.set(signature, remaining - item.quantity);
      }
      const price = roundMoney(product.price + addons.reduce((sum: number, a: any) => sum + a.price, 0));
      lines.push({ product, quantity: item.quantity, price, notes: typeof item.notes === 'string' ? item.notes : null, addons });
    }
    return { lines, settings };
  }

  async saveKitchenOrder(data: any, restaurantId: string, waiterId: string) {
    if (!data?.id || !data.orderNumber) throw new BadRequestException('Kitchen ticket ID and order number are required');
    return this.prisma.$transaction(async tx => {
      const key = { restaurantId_settingKey: { restaurantId, settingKey: `kot:${data.id}` } };
      const receipt = await tx.systemSetting.findUnique({ where: key });
      if (receipt) {
        const saved = JSON.parse(receipt.data);
        return { ...await tx.order.findUniqueOrThrow({ where: { id: saved.orderId }, include: { items: { include: { product: true } }, table: true } }), printJobId: saved.printJobId || null };
      }
      const { lines } = await this.pricedItems(tx, data.items, restaurantId);
      let existing = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } }, include: { bill: true } });
      if (existing?.bill) throw new BadRequestException('Order is already settled');
      let table = null;
      if (data.tableNumber) table = await tx.table.findFirst({ where: { restaurantId, tableNumber: data.tableNumber } });
      const tableId = table?.id || null;

      if (!existing && table?.currentOrderId) {
        const activeTableOrder = await tx.order.findUnique({ where: { id: table.currentOrderId }, include: { bill: true } });
        if (activeTableOrder && !activeTableOrder.bill) {
          existing = activeTableOrder;
        }
      }

      const items = lines.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes, addons: JSON.stringify(i.addons), status: 'SENT' }));
      const addedTotal = roundMoney(lines.reduce((sum, i) => sum + i.price * i.quantity, 0));
      const order = existing
        ? await tx.order.update({ where: { id: existing.id }, data: { status: 'COOKING', totalAmount: { increment: addedTotal }, items: { create: items } } })
        : await tx.order.create({ data: { restaurantId, orderNumber: data.orderNumber, orderType: data.orderType || 'DINE_IN', waiterId, tableId, status: 'COOKING', totalAmount: addedTotal, items: { create: items } } });
      const printJob = await this.printQueue.kitchen(tx, restaurantId, `kot:${data.id}`, { reference: order.orderNumber, orderNumber: order.orderNumber, table: table?.tableNumber || data.tableNumber, orderType: order.orderType, items: lines.map(line => ({ name: line.product.name, quantity: line.quantity, notes: line.notes, addons: line.addons })) }, waiterId);
      await tx.systemSetting.create({ data: { restaurantId, settingKey: `kot:${data.id}`, data: JSON.stringify({ orderId: order.id, printJobId: printJob?.id || null }) } });
      if (tableId) await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED', currentOrderId: order.id } });
      return { ...await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { product: true } }, table: true } }), printJobId: printJob?.id || null };
    });
  }

  // A repeated bill returns the original result before any inventory side effects.
  async processDirectCheckout(data: any, restaurantId: string, cashierId: string) {
    if (!restaurantId || typeof data?.billNumber !== 'string' || !data.billNumber || typeof data.orderNumber !== 'string' || !data.orderNumber) {
      throw new BadRequestException('Bill and order identifiers are required');
    }
    const bill = await this.prisma.$transaction(tx => this.checkoutInTransaction(tx, data, restaurantId, cashierId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    // A notification failure must not turn a committed sale into a failed checkout.
    try {
      const inventory = await this.prisma.inventoryItem.findMany({ where: { restaurantId, isActive: true } });
      this.kdsGateway.server.to(restaurantId).emit('inventory_updated', inventory);
      this.kdsGateway.server.to(restaurantId).emit('ledger_updated', await ledgerView(this.prisma, restaurantId));
      if (data.tableId) this.kdsGateway.server.to(restaurantId).emit('table_updated', { tableId: data.tableId, status: 'AVAILABLE' });
      const order = await this.prisma.order.findUnique({ where: { id: bill.orderId }, include: { items: { include: { product: true } }, table: true } });
      if (order && ['RECEIVED', 'COOKING', 'READY'].includes(order.status)) this.kdsGateway.server.to(restaurantId).emit('kds_new_ticket', this.kdsGateway.ticket(order));
    } catch {}
    return bill;
  }
  async printPrebill(data: any, user: any) {
    if (typeof data?.requestId !== 'string' || !data.requestId || data.requestId.length > 200) throw new BadRequestException('A stable print request ID is required');
    return this.prisma.$transaction(async tx => {
      const { lines, settings } = await this.pricedItems(tx, data.items, user.restaurantId);
      const table = data.tableId ? await tx.table.findFirst({ where: { id: data.tableId, restaurantId: user.restaurantId } }) : null;
      if (data.tableId && !table) throw new BadRequestException('Table not found');
      const totals = billTotals(lines, settings, data, table?.id);
      const job = await this.printQueue.enqueue(tx, user.restaurantId, 'RECEIPT', `prebill:${data.requestId}`, { ...await this.printQueue.branding(tx, user.restaurantId), kind: 'PREBILL', reference: `PRE-${data.requestId}`, orderType: data.orderType, table: table?.tableNumber, createdAt: new Date().toISOString(), items: lines.map(line => ({ name: line.product.name, quantity: line.quantity, price: line.price, notes: line.notes, addons: line.addons })), ...totals, discount: data.discount || 0, paymentMethod: 'UNPAID' }, user.id, false);
      return { id: job.id, kind: job.kind, reference: job.reference, state: job.state };
    });
  }
  async recipeForProduct(tx: any, productId: string) {
    const rows = await tx.recipeIngredient.findMany({ where: { productId }, include: { inventoryItem: true } });
    return rows.map((row: any) => ({ inventoryItemId: row.inventoryItemId, quantity: Number((row.quantity * (1 + row.wasteFactorPercent / 100)).toFixed(6)), costPrice: row.inventoryItem.costPrice }));
  }

  async checkoutInTransaction(tx: any, data: any, restaurantId: string, cashierId: string, storedPricing?: any) {
      if (!restaurantId || typeof data?.billNumber !== 'string' || !data.billNumber || typeof data.orderNumber !== 'string' || !data.orderNumber) throw new BadRequestException('Bill and order identifiers are required');
      const existingBill = await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId, billNumber: data.billNumber } }, include: { order: true } });
      if (existingBill) {
        if (existingBill.order.orderNumber !== data.orderNumber) throw new BadRequestException('Bill identifier is already used by another order');
        return existingBill;
      }
      const cashier = await tx.user.findUnique({ where: { id: cashierId } });
      if (!cashier?.isActive || cashier.restaurantId !== restaurantId) throw new UnauthorizedException('Invalid cashier');
      const existingOrder = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } }, include: { bill: true, items: true } });
      const { lines, settings } = storedPricing || await this.pricedItems(tx, data.items, restaurantId, existingOrder?.items || []);
      const discount = data.discount ?? 0;
      let permissions: any = {};
      try { permissions = JSON.parse(cashier.permissions || '{}'); } catch {}
      if (discount > 0 && !storedPricing && !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(cashier.role) && !permissions.canDiscount) throw new UnauthorizedException('Discount permission is required');
      const orderType = data.orderType || 'DINE_IN';
      if (!['DINE_IN', 'PARCEL', 'DELIVERY'].includes(orderType)) throw new BadRequestException('Invalid order type');
      const table = data.tableId ? await tx.table.findUnique({ where: { id: data.tableId } }) : null;
      if (data.tableId && (!table || table.restaurantId !== restaurantId)) throw new BadRequestException('Invalid dining table');
      const totals = billTotals(lines, settings, { ...data, orderType }, table?.id);
      const { itemSubtotal, surcharge, packaging, deliveryFee, subtotal, cgst, sgst, grandTotal } = totals;
      const tenders = paymentAllocation(data, grandTotal);
      const paymentMethod = Object.keys(tenders).length > 1 ? 'SPLIT' : Object.keys(tenders)[0] || 'CASH';
      if (existingOrder?.bill) throw new BadRequestException('This order is already settled');
      if (table?.currentOrderId && table.currentOrderId !== existingOrder?.id) throw new BadRequestException('This table has a different active order. Reload the table before payment.');
      if (existingOrder) {
        if (data.expectedOrderVersion && new Date(data.expectedOrderVersion).getTime() !== existingOrder.updatedAt.getTime()) throw new BadRequestException('This order changed on another terminal. Reload it before payment.');
        ensurePersistedItemsPresent(existingOrder.items, lines.map(i => ({ ...i, productId: i.product.id })));
      }
      const status = existingOrder?.status || (data.items.some((item: any) => item.status === 'NEW') ? 'COOKING' : 'SERVED');
      const billedItems = lines.map(i => ({ id: randomUUID(), productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes, addons: JSON.stringify(i.addons), status: status === 'COOKING' ? 'SENT' : 'SERVED' }));
      const orderValues = { status, totalAmount: subtotal, discount, tableId: table?.id || null, orderType, items: { create: billedItems } };
      const order = existingOrder
        ? await tx.order.update({ where: { id: existingOrder.id }, data: { ...orderValues, items: { deleteMany: {}, ...orderValues.items } } })
        : await tx.order.create({ data: { restaurantId, orderNumber: data.orderNumber, ...orderValues } });
      const snapshots = [];
      let allocated = 0;
      let allocatedCgst = 0, allocatedSgst = 0;
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const recipe = line.recipe || await this.recipeForProduct(tx, line.product.id);
        const lineAmount = line.price * line.quantity;
        const refundTotal = index === lines.length - 1 ? roundMoney(grandTotal - allocated) : roundMoney(lineAmount * (1 - discount / (itemSubtotal || 1)) * (1 + line.product.gstRate / 100) + ((surcharge + packaging) * 1.05 + deliveryFee) * lineAmount / (itemSubtotal || 1));
        allocated = roundMoney(allocated + refundTotal);
        const lineTax = lineAmount * (1 - discount / (itemSubtotal || 1)) * line.product.gstRate / 100 + (surcharge + packaging) * 0.05 * lineAmount / (itemSubtotal || 1);
        const refundCgst = index === lines.length - 1 ? roundMoney(cgst - allocatedCgst) : roundMoney(lineTax / 2);
        const refundSgst = index === lines.length - 1 ? roundMoney(sgst - allocatedSgst) : roundMoney(lineTax / 2);
        allocatedCgst = roundMoney(allocatedCgst + refundCgst); allocatedSgst = roundMoney(allocatedSgst + refundSgst);
        snapshots.push({ id: billedItems[index].id, productId: line.product.id, name: line.product.name, price: line.price, quantity: line.quantity, gstRate: line.product.gstRate, notes: line.notes, addons: line.addons, refundTotal, refundCgst, refundSgst, recipe: recipe.map(r => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, costPrice: r.costPrice })) });
      }
      const saved = await tx.bill.create({ data: { restaurantId, billNumber: data.billNumber, orderId: order.id, orderType, subtotal, discount, cgst, sgst, grandTotal, deliveryFee, paymentMethod, tenders: JSON.stringify(tenders), invoiceItems: JSON.stringify(snapshots), cashierId, customerName: data.customerName || null, customerPhone: data.customerPhone || null, waiterName: data.waiter || null } });
      if (tenders.CREDIT > 0 && (!data.customerName?.trim() || !data.customerPhone?.trim())) throw new BadRequestException('Customer name and phone are required for credit');
      if (data.customerPhone?.trim()) {
        const customer = await tx.customer.upsert({ where: { restaurantId_mobile: { restaurantId, mobile: data.customerPhone.trim() } }, update: { name: data.customerName?.trim() || 'Guest', totalSpend: { increment: grandTotal }, creditBalance: { increment: tenders.CREDIT || 0 } }, create: { restaurantId, mobile: data.customerPhone.trim(), name: data.customerName?.trim() || 'Guest', totalSpend: grandTotal, creditBalance: tenders.CREDIT || 0 } });
        await tx.order.update({ where: { id: order.id }, data: { customerId: customer.id } });
        if (tenders.CREDIT > 0) await tx.ledgerEntry.create({ data: { id: `credit:${saved.id}`, customerId: customer.id, customerName: customer.name, amount: tenders.CREDIT, type: 'CREDIT', billNumber: saved.billNumber, recordedBy: cashierId } });
      }
      const delivery = ['DELIVERY', 'PARCEL'].includes(orderType) ? await tx.deliveryOrder.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } } }) : null;
      if (!delivery?.inventoryConsumed) await this.stockPolicy.consume(tx, snapshots, cashier, 'checkout', data.billNumber, order.id, data.stockAuthorization);
      if (table) await tx.table.update({ where: { id: table.id }, data: { status: 'AVAILABLE', currentOrderId: null } });
      await this.printQueue.receipt(tx, restaurantId, saved, { ...order, table }, cashier.name, true, `receipt:${saved.id}`, false, cashierId);
      // Checkout may contain food never sent to the kitchen. Compare persisted quantities,
      // including notes/add-ons, rather than trusting a terminal's NEW/SENT flag.
      const remaining = new Map<string, number>();
      for (const item of existingOrder?.items || []) {
        const signature = kitchenSignature(item);
        remaining.set(signature, (remaining.get(signature) || 0) + item.quantity);
      }
      const unsent = snapshots.flatMap(item => {
        const signature = kitchenSignature(item);
        const previous = remaining.get(signature) || 0;
        remaining.set(signature, Math.max(0, previous - item.quantity));
        const quantity = Math.max(0, item.quantity - previous);
        return quantity > 0 ? [{ ...item, quantity }] : [];
      });
      if ([...remaining.values()].some(quantity => quantity > 0)) throw new BadRequestException('Cooking instructions for already-sent food changed. Reload the latest order before payment.');
      await this.printQueue.kitchen(tx, restaurantId, `checkout:${saved.id}`, { reference: order.orderNumber, orderType, table: table?.tableNumber, items: unsent }, cashierId);
      return saved;

  }
  // 4. Get Today's Dashboard Sales Summary
  async getDailyDashboardSummary(restaurantId: string) {
    const { start, end } = getBusinessDayBounds();

    const aggregate = await this.prisma.bill.aggregate({
      where: { restaurantId, settledAt: { gte: start, lte: end } },
      _sum: { grandTotal: true },
      _count: { id: true }
    });

    const grossRevenue = aggregate._sum.grandTotal || 0;
    const totalOrders = aggregate._count.id;

    const summary = await financialSummary(this.prisma, restaurantId, start, end);

    const activeOrdersCount = await this.prisma.order.count({
      where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
    });
    const occupiedTablesCount = await this.prisma.table.count({
      where: { restaurantId, status: 'OCCUPIED' },
    });

    return {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      refundTotal: summary.refundTotal, netRevenue: summary.netRevenue, repayments: summary.repayments,
      collectionBreakdown: summary.collections,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Number((grossRevenue / totalOrders).toFixed(2)) : 0,
      activeOrdersCount,
      occupiedTablesCount,
      paymentBreakdown: {
        cash: summary.byPayment.CASH || 0,
        card: summary.byPayment.CARD || 0,
        upi: summary.byPayment.UPI || 0,
      },
    };
  }

  // 5. Get Order History for Dashboard
  async getOrderHistory(restaurantId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { restaurantId };
    
    if (startDate && endDate) {
      const start = getBusinessDayBounds(startDate).start;
      const end = getBusinessDayBounds(endDate).end;
      
      whereClause.settledAt = { gte: start, lte: end };
    } else {
      const { start, end } = getBusinessDayBounds();
      whereClause.settledAt = { gte: start, lte: end };
    }

    const bills = await this.prisma.bill.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            waiter: { select: { name: true } },
            table: { select: { tableNumber: true } }
          }
        },
        cashier: { select: { name: true } }
      },
      orderBy: { settledAt: 'desc' }
    });

    return bills.map(immutableHistoryBill);
  }
}
