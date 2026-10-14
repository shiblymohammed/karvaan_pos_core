import { BadRequestException, ConflictException, ForbiddenException, Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { BillingService } from './billing.service';
import { billTotals, money, ledgerView, readJson, ensurePersistedItemsPresent } from './financial';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService, @Inject(forwardRef(() => BillingService)) private readonly billing: BillingService, private readonly auth: AuthService) {}

  private async command(data: any, user: any, type: string, action: (tx: any) => Promise<any>) {
    if (typeof data?.actionId !== 'string' || !data.actionId || data.actionId.length > 200) throw new BadRequestException('A stable action identifier is required');
    return this.prisma.$transaction(async tx => {
      const key = { restaurantId_settingKey: { restaurantId: user.restaurantId, settingKey: `command:${type}:${data.actionId}` } };
      const saved = await tx.systemSetting.findUnique({ where: key });
      if (saved) return readJson(saved.data, null);
      const result = await action(tx);
      await tx.systemSetting.create({ data: { restaurantId: user.restaurantId, settingKey: key.restaurantId_settingKey.settingKey, data: JSON.stringify(result) } });
      return result;
    }, { timeout: 20000 });
  }

  async kitchenStatus(data: any, user: any) {
    return this.command(data, user, 'kitchen-status', async tx => {
      if (!['COOKING', 'READY', 'SERVED'].includes(data.status)) throw new BadRequestException('Invalid kitchen status');
      const order = await tx.order.findFirst({ where: { restaurantId: user.restaurantId, OR: [{ id: data.orderId || '' }, { orderNumber: data.orderNumber || data.orderId || '' }] } });
      if (!order) throw new BadRequestException('Kitchen order not found');
      const steps = ['RECEIVED', 'COOKING', 'READY', 'SERVED'];
      if (steps.indexOf(data.status) < steps.indexOf(order.status) || !steps.includes(order.status)) throw new ConflictException('This kitchen ticket has already progressed. Refresh the kitchen screen.');
      await tx.order.update({ where: { id: order.id }, data: { status: data.status } });
      const delivery = await tx.deliveryOrder.findUnique({ where: { restaurantId_orderNumber: { restaurantId: user.restaurantId, orderNumber: order.orderNumber } } });
      if (delivery && ['RECEIVED', 'PREPARING', 'READY'].includes(delivery.status)) {
        const status = data.status === 'COOKING' ? 'PREPARING' : 'READY';
        if (status !== delivery.status) await tx.deliveryOrder.update({ where: { id: delivery.id }, data: { status, revision: { increment: 1 } } });
      }
      return { orderId: order.id };
    });
  }

  async deliveryState(restaurantId: string) {
    const rows = await this.prisma.deliveryOrder.findMany({ where: { restaurantId, archived: false }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => ({ ...row, items: readJson(row.items, []), deliveryBoyId: row.riderId, deliveryBoyName: row.riderName, placedAt: row.createdAt }));
  }

  async createDelivery(data: any, user: any) {
    return this.command(data, user, 'delivery-create', async tx => {
      if (!data.orderNumber || !data.billNumber || !['DELIVERY', 'PARCEL'].includes(data.orderType)) throw new BadRequestException('Valid delivery order and bill identifiers are required');
      const key = { restaurantId_orderNumber: { restaurantId: user.restaurantId, orderNumber: data.orderNumber } };
      const existing = await tx.deliveryOrder.findUnique({ where: key });
      if (existing) return { id: existing.id, orderNumber: existing.orderNumber };
      let order = await tx.order.findUnique({ where: key, include: { bill: true, items: true } });
      const { lines, settings } = await this.billing.pricedItems(tx, data.items, user.restaurantId, order?.items || []);
      const totals = billTotals(lines, settings, data);
      const permissions = readJson<any>(JSON.stringify(user.permissions || {}), {});
      if (totals.discount > 0 && !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(user.role) && !permissions.canDiscount) throw new ForbiddenException('Discount permission is required');
      const storedLines = [];
      for (const line of lines) storedLines.push({ productId: line.product.id, name: line.product.name, price: line.price, basePrice: line.product.price, gstRate: line.product.gstRate, quantity: line.quantity, notes: line.notes, addons: line.addons, recipe: await tx.recipeIngredient.findMany({ where: { productId: line.product.id }, select: { inventoryItemId: true, quantity: true } }) });
      if (order?.bill && data.orderType !== 'PARCEL') throw new BadRequestException('This order is already settled');
      if (order && !order.bill) ensurePersistedItemsPresent(order.items, storedLines);
      if (!order) order = await tx.order.create({ data: { restaurantId: user.restaurantId, orderNumber: data.orderNumber, orderType: data.orderType, status: 'COOKING', totalAmount: totals.subtotal, discount: totals.discount, waiterId: user.id, items: { create: storedLines.map(line => ({ productId: line.productId, price: line.price, quantity: line.quantity, notes: line.notes, addons: JSON.stringify(line.addons), status: 'SENT' })) } }, include: { bill: true, items: true } });
      else if (!order.bill) order = await tx.order.update({ where: { id: order.id }, data: { totalAmount: totals.subtotal, discount: totals.discount, items: { deleteMany: {}, create: storedLines.map(line => ({ productId: line.productId, price: line.price, quantity: line.quantity, notes: line.notes, addons: JSON.stringify(line.addons), status: 'SENT' })) } }, include: { bill: true, items: true } });
      const paid = !!order.bill || data.paymentStatus === 'COLLECTED';
      const delivery = await tx.deliveryOrder.create({ data: { id: data.id || undefined, restaurantId: user.restaurantId, orderNumber: data.orderNumber, orderType: data.orderType, billNumber: order.bill?.billNumber || data.billNumber, customerName: data.customerName || 'Guest', customerPhone: data.customerPhone || null, deliveryAddress: data.deliveryAddress || null, deliveryFee: totals.deliveryFee, discount: totals.discount, subtotal: totals.subtotal, grandTotal: totals.grandTotal, items: JSON.stringify(storedLines), status: 'RECEIVED', paymentStatus: order.bill ? 'COLLECTED' : 'PENDING', inventoryConsumed: !!order.bill } });
      if (!order.bill) {
        for (const line of storedLines) for (const ingredient of line.recipe) {
          const quantity = ingredient.quantity * line.quantity;
          await tx.inventoryItem.update({ where: { id: ingredient.inventoryItemId }, data: { currentStock: { decrement: quantity }, revision: { increment: 1 } } });
          await tx.stockLog.create({ data: { itemId: ingredient.inventoryItemId, orderId: order.id, type: 'OUT', reason: 'SALE', quantityChange: -quantity, notes: `Delivery dispatch ${data.orderNumber}` } });
        }
        await tx.deliveryOrder.update({ where: { id: delivery.id }, data: { inventoryConsumed: true } });
      }
      if (paid && !order.bill) {
        const bill = await this.billing.checkoutInTransaction(tx, { ...data, method: data.paymentMethod || 'UPI' }, user.restaurantId, user.id);
        await tx.deliveryOrder.update({ where: { id: delivery.id }, data: { paymentStatus: 'COLLECTED', paymentMethod: bill.paymentMethod, collectedAmount: bill.grandTotal } });
      }
      return { id: delivery.id, orderNumber: delivery.orderNumber };
    });
  }

  async updateDelivery(data: any, user: any) {
    return this.command(data, user, 'delivery-update', async tx => {
      const row = await tx.deliveryOrder.findFirst({ where: { id: data.id, restaurantId: user.restaurantId } });
      if (!row) throw new BadRequestException('Delivery not found');
      const claiming = user.role === 'DELIVERY' && !row.riderId && data.riderId === user.id && data.status === 'OUT_FOR_DELIVERY' && row.status === 'READY';
      if (user.role === 'DELIVERY' && row.riderId !== user.id && !claiming) throw new ForbiddenException('Only the assigned rider can update this delivery');
      if (data.expectedRevision !== row.revision) throw new ConflictException('This delivery changed on another terminal. Refresh the board.');
      if (data.archived && !['DELIVERED', 'CANCELLED'].includes(row.status)) throw new BadRequestException('Complete or cancel this delivery before removing it');
      if (data.riderId !== undefined && !['ADMIN', 'REST_ADMIN', 'MANAGER', 'CASHIER'].includes(user.role) && data.riderId !== user.id && !(user.role === 'DELIVERY' && row.riderId === user.id && !data.riderId)) throw new ForbiddenException('Rider assignment requires a cashier or manager');
      let riderName = null;
      if (data.riderId) {
        const rider = await tx.user.findFirst({ where: { id: data.riderId, restaurantId: user.restaurantId, role: 'DELIVERY', isActive: true } });
        if (!rider) throw new BadRequestException('Invalid rider');
        riderName = rider.name;
      }
      const transitions: Record<string, string[]> = { RECEIVED: ['PREPARING', 'READY', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'], READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'], OUT_FOR_DELIVERY: ['READY', 'DELIVERED'], DELIVERED: [], CANCELLED: [] };
      if (data.status && data.status !== row.status && !transitions[row.status]?.includes(data.status)) throw new BadRequestException('This delivery status transition is not allowed');
      if (user.role === 'KITCHEN' && !['PREPARING', 'READY'].includes(data.status)) throw new ForbiddenException('Kitchen staff can only update food preparation');
      if (data.status === 'DELIVERED' && row.paymentStatus !== 'COLLECTED') throw new BadRequestException('Record payment before completing delivery');
      if (data.status === 'CANCELLED' && row.paymentStatus === 'COLLECTED') {
        const bill = row.billNumber ? await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId: user.restaurantId, billNumber: row.billNumber } } }) : null;
        if (!bill || bill.refundedAmount + 0.005 < bill.grandTotal) throw new BadRequestException('Refund the paid bill before cancelling it');
      }
      await tx.deliveryOrder.update({ where: { id: row.id }, data: { ...(data.status ? { status: data.status } : {}), ...(data.riderId !== undefined ? { riderId: data.riderId || null, riderName } : {}), ...(data.archived ? { archived: true } : {}), revision: { increment: 1 }, ...(data.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) } });
      return { id: row.id };
    });
  }

  async collectDelivery(data: any, user: any) {
    return this.command(data, user, 'delivery-payment', async tx => {
      const delivery = await tx.deliveryOrder.findFirst({ where: { id: data.id, restaurantId: user.restaurantId } });
      if (!delivery || delivery.status === 'CANCELLED') throw new BadRequestException('Active delivery not found');
      if (user.role === 'DELIVERY' && delivery.riderId !== user.id) throw new ForbiddenException('Only the assigned rider can collect this delivery');
      if (data.complete && !['READY', 'OUT_FOR_DELIVERY'].includes(delivery.status) && delivery.status !== 'DELIVERED') throw new BadRequestException('Finish preparation before completing delivery');
      if (delivery.paymentStatus !== 'COLLECTED') {
        const order = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId: user.restaurantId, orderNumber: delivery.orderNumber } } });
        if (!order) throw new BadRequestException('This legacy delivery has no linked kitchen order; review it before billing');
        const lines = readJson<any[]>(delivery.items, []);
        if (lines.some(line => !line.productId || !Number.isFinite(line.gstRate))) throw new BadRequestException('This legacy delivery needs product and pricing review before payment');
        const settingsRow = await tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId: user.restaurantId, settingKey: 'general' } } });
        const storedPricing = { settings: readJson(settingsRow?.data, {}), lines: lines.map(line => ({ product: { id: line.productId, name: line.name, price: line.basePrice, gstRate: line.gstRate }, price: line.price, quantity: line.quantity, notes: line.notes, addons: line.addons || [], recipe: line.recipe })) };
        const paymentMethod = data.paymentMethod;
        const tenders = data.tenders || { [paymentMethod]: data.amount };
        const bill = await this.billing.checkoutInTransaction(tx, { billNumber: delivery.billNumber || `DEL-${delivery.orderNumber}`, orderNumber: delivery.orderNumber, orderType: delivery.orderType, items: lines, discount: delivery.discount, deliveryFee: delivery.deliveryFee, grandTotal: delivery.grandTotal, paymentMethod, tenders, customerName: delivery.customerName, customerPhone: delivery.customerPhone }, user.restaurantId, user.id, storedPricing);
        await tx.deliveryOrder.update({ where: { id: delivery.id }, data: { paymentStatus: 'COLLECTED', collectedAmount: bill.grandTotal, paymentMethod: bill.paymentMethod, billNumber: bill.billNumber, collectedById: user.id, collectedTenders: bill.tenders, revision: { increment: 1 } } });
      }
      if (data.complete) await tx.deliveryOrder.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), revision: { increment: 1 } } });
      return { id: delivery.id, billNumber: delivery.billNumber || `DEL-${delivery.orderNumber}` };
    });
  }

  private async pendingRemittance(tx: any, riderId: string, restaurantId: string) {
    const rows = await tx.deliveryOrder.findMany({ where: { restaurantId, collectedById: riderId, paymentStatus: 'COLLECTED', remittedAt: null }, orderBy: { createdAt: 'asc' } });
    const allocations = rows.map(row => readJson<Record<string, number>>(row.collectedTenders, {}));
    return { deliveryIds: rows.map(row => row.id).sort(), trips: rows.length, cash: money(allocations.reduce((sum, row) => sum + (row.CASH || 0), 0)), digital: money(allocations.reduce((sum, row) => sum + (row.UPI || 0) + (row.CARD || 0), 0)) };
  }

  async riderRemittanceSummary(riderId: string, user: any) {
    if (user.role === 'DELIVERY' && user.id !== riderId) throw new ForbiddenException('Only your own collections are available');
    const rider = await this.prisma.user.findFirst({ where: { id: riderId, restaurantId: user.restaurantId, role: 'DELIVERY' } });
    if (!rider) throw new BadRequestException('Rider not found');
    const summary = await this.pendingRemittance(this.prisma, riderId, user.restaurantId);
    const legacyCount = await this.prisma.deliveryOrder.count({ where: { restaurantId: user.restaurantId, riderId, paymentStatus: 'COLLECTED', collectedById: null, paymentMethod: { in: ['CASH', 'SPLIT'] } } });
    return { ...summary, legacyCount };
  }

  async remitRiderCash(data: any, user: any) {
    if (!['ADMIN', 'REST_ADMIN', 'MANAGER', 'CASHIER'].includes(user.role)) throw new ForbiddenException('A cashier or manager must confirm receiving rider cash');
    return this.command(data, user, 'rider-remit', async tx => {
      const rider = await tx.user.findFirst({ where: { id: data.riderId, restaurantId: user.restaurantId, role: 'DELIVERY' } });
      if (!rider) throw new BadRequestException('Rider not found');
      const summary = await this.pendingRemittance(tx, data.riderId, user.restaurantId);
      if (!summary.trips) throw new BadRequestException('No rider collections await remittance');
      if (!Number.isFinite(data.amount) || Math.abs(summary.cash - data.amount) > 0.005 || JSON.stringify(summary.deliveryIds) !== JSON.stringify((data.deliveryIds || []).slice().sort())) throw new ConflictException('Rider collections changed. Reload the shift summary before confirming received cash.');
      const receivedAt = new Date();
      await tx.deliveryOrder.updateMany({ where: { restaurantId: user.restaurantId, id: { in: summary.deliveryIds } }, data: { remittedAt: receivedAt, revision: { increment: 1 } } });
      return { ...summary, riderId: data.riderId, receivedBy: user.id, receivedAt: receivedAt.toISOString() };
    });
  }

  ledger(restaurantId: string) { return ledgerView(this.prisma, restaurantId); }

  async menu(restaurantId: string) {
    return this.prisma.$transaction(async tx => {
      const [categories, products, version] = await Promise.all([tx.category.findMany({ where: { restaurantId }, orderBy: { sortOrder: 'asc' } }), tx.product.findMany({ where: { restaurantId, isArchived: false }, include: { category: true } }), tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'menu_revision' } } })]);
      return { categories, products: products.map(product => ({ ...product, category: product.category.name, prepTime: product.prepTimeMinutes })), serverRevision: readJson<number>(version?.data, 0) };
    });
  }

  inventoryState(restaurantId: string) { return this.prisma.inventoryItem.findMany({ where: { restaurantId, isActive: true } }); }

  async receiveInventoryPurchase(data: any, user: any) {
    return this.command(data, user, 'inventory-purchase', async tx => {
      const row = await tx.inventoryItem.findFirst({ where: { id: data.id, restaurantId: user.restaurantId, isActive: true } });
      if (!row) throw new BadRequestException('Active inventory item not found');
      if (!Number.isFinite(data.purchaseUnits) || data.purchaseUnits <= 0 || !Number.isFinite(data.conversionFactor) || data.conversionFactor <= 0 || typeof data.purchaseUnit !== 'string' || !data.purchaseUnit.trim()) throw new BadRequestException('Enter a positive received quantity and valid purchase-unit conversion');
      if (data.invoiceCost !== undefined && (!Number.isFinite(data.invoiceCost) || data.invoiceCost < 0)) throw new BadRequestException('Invoice cost must be a valid non-negative total');
      if (data.vendor !== undefined && (typeof data.vendor !== 'string' || data.vendor.length > 200)) throw new BadRequestException('Invalid supplier name');
      if (row.conversionFactor !== null && (row.conversionFactor !== data.conversionFactor || row.purchaseUnit !== data.purchaseUnit)) throw new ConflictException('Purchase units changed on another terminal. Reload stock before receiving this invoice.');
      const quantity = data.purchaseUnits * data.conversionFactor;
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(row.currentStock + quantity)) throw new BadRequestException('Received stock quantity is invalid');
      const costPrice = data.invoiceCost === undefined ? row.costPrice : data.invoiceCost / quantity;
      if (!Number.isFinite(costPrice)) throw new BadRequestException('Invoice cost per stock unit is invalid');
      const saved = await tx.inventoryItem.update({ where: { id: row.id }, data: { currentStock: { increment: quantity }, costPrice, purchaseUnit: data.purchaseUnit, conversionFactor: data.conversionFactor, lastVendor: data.vendor?.trim() || row.lastVendor, revision: { increment: 1 } } });
      const movement = await tx.stockLog.create({ data: { itemId: row.id, type: 'IN', reason: 'PURCHASE', quantityChange: quantity, notes: JSON.stringify({ actionId: data.actionId, recordedBy: user.id, purchaseUnits: data.purchaseUnits, purchaseUnit: data.purchaseUnit, conversionFactor: data.conversionFactor, invoiceCost: data.invoiceCost ?? null, vendor: data.vendor?.trim() || row.lastVendor }) } });
      return { id: row.id, movementId: movement.id, currentStock: saved.currentStock, costPrice: saved.costPrice, quantityReceived: quantity };
    });
  }

  async inventory(data: any, user: any) {
    return this.command(data, user, 'inventory', async tx => {
      if (!Array.isArray(data.changes) || !data.changes.length || data.changes.length > 500) throw new BadRequestException('Invalid inventory changes');
      const seen = new Set();
      for (const change of data.changes) {
        if (typeof change.id !== 'string' || seen.has(change.id)) throw new BadRequestException('Invalid inventory item');
        seen.add(change.id);
        const row = await tx.inventoryItem.findUnique({ where: { id: change.id } });
        if (row && row.restaurantId !== user.restaurantId) throw new ForbiddenException('Invalid restaurant inventory');
        if ((change.metadata || change.remove) && (change.expectedRevision !== (row?.revision || 0))) throw new ConflictException('Inventory details changed on another terminal. Refresh before editing.');
        if (change.remove) {
          if (!row) throw new BadRequestException('Inventory item not found');
          await tx.recipeIngredient.deleteMany({ where: { inventoryItemId: row.id } });
          await tx.inventoryItem.update({ where: { id: row.id }, data: { isActive: false, revision: { increment: 1 } } });
          continue;
        }
        const delta = change.delta;
        if (!Number.isFinite(delta) || (row ? row.currentStock + delta : delta) < 0) throw new BadRequestException('Invalid stock adjustment');
        const meta = change.metadata;
        if (meta && (typeof meta.name !== 'string' || !meta.name.trim() || !Number.isFinite(meta.costPrice) || meta.costPrice < 0 || !Number.isFinite(meta.minThreshold) || meta.minThreshold < 0)) throw new BadRequestException('Invalid inventory details');
        if (meta && ((meta.conversionFactor !== undefined && (!Number.isFinite(meta.conversionFactor) || meta.conversionFactor <= 0)) || (meta.purchaseUnit !== undefined && (typeof meta.purchaseUnit !== 'string' || !meta.purchaseUnit.trim())) || (meta.lastVendor !== undefined && typeof meta.lastVendor !== 'string'))) throw new BadRequestException('Invalid inventory purchase units');
        if (!row && !meta) throw new BadRequestException('New stock requires item details');
        const fields = meta ? { name: meta.name.trim(), category: meta.category || 'General', unit: meta.unit || 'pcs', minThreshold: meta.minThreshold, costPrice: meta.costPrice, ...(meta.purchaseUnit !== undefined ? { purchaseUnit: meta.purchaseUnit } : {}), ...(meta.conversionFactor !== undefined ? { conversionFactor: meta.conversionFactor } : {}), ...(meta.lastVendor !== undefined ? { lastVendor: meta.lastVendor } : {}) } : {};
        if (row) await tx.inventoryItem.update({ where: { id: row.id }, data: { ...fields, currentStock: { increment: delta }, revision: { increment: 1 } } });
        else await tx.inventoryItem.create({ data: { id: change.id, restaurantId: user.restaurantId, ...fields, name: meta.name.trim(), category: meta.category || 'General', currentStock: delta, revision: 1 } });
        if (delta !== 0) await tx.stockLog.create({ data: { itemId: change.id, type: delta > 0 ? 'IN' : 'ADJUSTMENT', quantityChange: delta, reason: change.reason || 'ADJUSTMENT', notes: `Staff ${user.id}; action ${data.actionId}` } });
      }
      return { saved: data.changes.length };
    });
  }

  async parkedState(restaurantId: string) {
    const rows = await this.prisma.parkedOrder.findMany({ where: { restaurantId }, orderBy: { heldAt: 'desc' } });
    return rows.map(row => ({ ...readJson<any>(row.data, {}), revision: row.revision }));
  }

  async park(data: any, user: any, remove = false) {
    return this.command(data, user, remove ? 'park-remove' : 'park-save', async tx => {
      const id = remove ? data.id : data.order?.id;
      if (typeof id !== 'string' || !id) throw new BadRequestException('Parked order ID is required');
      const row = await tx.parkedOrder.findUnique({ where: { orderId: id } });
      if (row && row.restaurantId !== user.restaurantId) throw new ForbiddenException('Invalid parked order');
      if (data.expectedRevision !== (row?.revision || 0) || (remove && !row)) throw new ConflictException('This parked order was changed or resumed on another terminal. Refresh before continuing.');
      if (remove) { await tx.parkedOrder.delete({ where: { id: row.id } }); return { id }; }
      const next = (row?.revision || 0) + 1;
      await tx.parkedOrder.upsert({ where: { orderId: id }, update: { data: JSON.stringify(data.order), revision: next }, create: { orderId: id, restaurantId: user.restaurantId, data: JSON.stringify(data.order), revision: next } });
      return { id, revision: next };
    });
  }

  async activeOrder(orderNumber: string, restaurantId: string, tableId?: string) {
    const table = tableId ? await this.prisma.table.findFirst({ where: { id: tableId, restaurantId } }) : null;
    const order = await this.prisma.order.findFirst({ where: { restaurantId, ...(table?.currentOrderId ? { id: table.currentOrderId } : { orderNumber }) }, include: { items: { include: { product: true } }, bill: true } });
    if (!order) return null;
    if (order.bill) throw new ConflictException('This order was already paid on another terminal');
    return { id: order.id, orderNumber: order.orderNumber, version: order.updatedAt.toISOString(), items: order.items.map(line => { const addons = readJson<any[]>(line.addons, []); return { id: line.id, productId: line.productId, name: line.product.name, quantity: line.quantity, price: money(line.price - addons.reduce((sum, addon) => sum + addon.price, 0)), addons, notes: line.notes, status: 'SENT' }; }) };
  }

  async repay(data: any, user: any) {
    return this.command(data, user, 'ledger-payment', async tx => {
      const entry = await tx.ledgerEntry.findFirst({ where: { id: data.entryId, type: 'CREDIT', customer: { restaurantId: user.restaurantId } }, include: { customer: true } });
      if (!entry) throw new BadRequestException('Server credit entry not found. Older device entries require review.');
      const amount = money(data.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount - (entry.amount - entry.settledAmount) > 0.005) throw new BadRequestException('Payment exceeds the outstanding credit');
      if (!['CASH', 'CARD', 'UPI'].includes(data.paymentMethod)) throw new BadRequestException('Invalid repayment method');
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: { settledAmount: { increment: amount } } });
      await tx.ledgerEntry.create({ data: { id: `payment:${user.restaurantId}:${data.actionId}`, customerId: entry.customerId, customerName: entry.customerName, type: 'PAYMENT', amount: -amount, sourceEntryId: entry.id, billNumber: entry.billNumber, paymentMethod: data.paymentMethod, recordedBy: user.id } });
      await tx.customer.update({ where: { id: entry.customerId }, data: { creditBalance: { decrement: amount } } });
      return { entryId: entry.id, paid: amount };
    });
  }

  async invoice(billNumber: string, restaurantId: string) {
    const bill = await this.prisma.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId, billNumber } } });
    if (!bill) throw new BadRequestException('Saved bill not found. Wait for server confirmation before returning it.');
    if (!bill.invoiceItems) throw new BadRequestException('This older invoice needs a reviewed refund; it has no immutable line snapshot.');
    const returns = await this.prisma.returnRecord.findMany({ where: { restaurantId, billNumber } });
    const used = new Map<string, number>();
    for (const record of returns) for (const line of readJson<any[]>(record.items, [])) used.set(line.id, (used.get(line.id) || 0) + line.quantity);
    return { ...bill, items: readJson<any[]>(bill.invoiceItems, []).map(line => ({ ...line, remainingQuantity: line.quantity - (used.get(line.id) || 0) })) };
  }

  async refund(data: any, user: any) {
    return this.command(data, user, 'refund', async tx => {
      let authorizedBy = user.id;
      if (!['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(user.role) && !user.permissions?.canVoid) authorizedBy = await this.auth.verifyRefundAuthorization(data.authorization, user, data.actionId, data.billNumber);
      if (!['RESTOCK', 'WASTE'].includes(data.action) || !['CASH', 'UPI', 'CARD', 'LEDGER'].includes(data.refundDest) || typeof data.reason !== 'string' || !data.reason.trim()) throw new BadRequestException('Valid return action, reason, and refund destination are required');
      const bill = await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId: user.restaurantId, billNumber: data.billNumber } }, include: { order: true } });
      if (!bill?.invoiceItems) throw new BadRequestException('Saved invoice line snapshot not found; review older invoices manually');
      const snapshots = readJson<any[]>(bill.invoiceItems, []);
      const prior = await tx.returnRecord.findMany({ where: { restaurantId: user.restaurantId, billNumber: bill.billNumber } });
      const used = new Map<string, { quantity: number; amount: number; cgst: number; sgst: number }>();
      for (const record of prior) for (const line of readJson<any[]>(record.items, [])) { const current = used.get(line.id) || { quantity: 0, amount: 0, cgst: 0, sgst: 0 }; used.set(line.id, { quantity: current.quantity + line.quantity, amount: money(current.amount + line.refundAmount), cgst: money(current.cgst + (line.cgst || 0)), sgst: money(current.sgst + (line.sgst || 0)) }); }
      if (!Array.isArray(data.items) || !data.items.length || data.items.length > snapshots.length) throw new BadRequestException('Select invoice lines to return');
      const items = [], seen = new Set();
      let total = 0;
      let cgst = 0, sgst = 0;
      for (const selected of data.items) {
        const line = snapshots.find(line => line.id === selected.id);
        if (!line || seen.has(line.id) || !Number.isInteger(selected.quantity) || selected.quantity < 1) throw new BadRequestException('Invalid returned invoice line');
        seen.add(line.id);
        const previous = used.get(line.id) || { quantity: 0, amount: 0, cgst: 0, sgst: 0 };
        const remaining = line.quantity - previous.quantity;
        if (selected.quantity > remaining) throw new BadRequestException('Returned quantity exceeds the remaining billed quantity');
        const amount = selected.quantity === remaining ? money(line.refundTotal - previous.amount) : money(line.refundTotal * selected.quantity / line.quantity);
        total = money(total + amount);
        const lineCgst = selected.quantity === remaining ? money((line.refundCgst || 0) - previous.cgst) : money((line.refundCgst || 0) * selected.quantity / line.quantity);
        const lineSgst = selected.quantity === remaining ? money((line.refundSgst || 0) - previous.sgst) : money((line.refundSgst || 0) * selected.quantity / line.quantity);
        cgst = money(cgst + lineCgst); sgst = money(sgst + lineSgst);
        items.push({ id: line.id, productId: line.productId, name: line.name, quantity: selected.quantity, refundAmount: amount, cgst: lineCgst, sgst: lineSgst });
        if (data.action === 'RESTOCK') for (const ingredient of line.recipe || []) {
          const stock = await tx.inventoryItem.findUnique({ where: { id: ingredient.inventoryItemId } });
          if (stock?.restaurantId !== user.restaurantId) throw new BadRequestException('Return inventory is no longer available');
          const quantity = ingredient.quantity * selected.quantity;
          await tx.inventoryItem.update({ where: { id: stock.id }, data: { currentStock: { increment: quantity }, revision: { increment: 1 } } });
          await tx.stockLog.create({ data: { itemId: stock.id, orderId: bill.orderId, type: 'IN', reason: 'RETURN', quantityChange: quantity, notes: `Return ${data.actionId} for ${bill.billNumber}` } });
        }
        if (data.action === 'WASTE') await tx.wasteLog.create({ data: { restaurantId: user.restaurantId, itemName: line.name, quantity: selected.quantity, unit: 'portion', reason: 'RETURN', orderId: bill.orderId, billNumber: bill.billNumber, loggedBy: authorizedBy } });
      }
      if (bill.refundedAmount + total > bill.grandTotal + 0.005) throw new BadRequestException('Refund exceeds the original bill');
      const tenders = readJson<any>(bill.tenders, {});
      const cashRefunded = prior.filter(r => r.refundDest !== 'LEDGER').reduce((sum, r) => sum + r.totalRefund, 0);
      if (data.refundDest !== 'LEDGER' && cashRefunded + total > bill.grandTotal - (tenders.CREDIT || 0) + 0.005) throw new BadRequestException('Unpaid customer credit must be refunded to the ledger');
      if (data.refundDest === 'LEDGER') {
        if (!bill.order.customerId) throw new BadRequestException('This invoice has no saved customer for a ledger refund');
        let remaining = total;
        const credits = await tx.ledgerEntry.findMany({ where: { customerId: bill.order.customerId, type: 'CREDIT' }, orderBy: { createdAt: 'asc' } });
        for (const credit of credits) { const apply = money(Math.min(remaining, credit.amount - credit.settledAmount)); if (apply <= 0) continue; await tx.ledgerEntry.update({ where: { id: credit.id }, data: { settledAmount: { increment: apply } } }); remaining = money(remaining - apply); }
        await tx.ledgerEntry.create({ data: { id: `refund:${user.restaurantId}:${data.actionId}`, customerId: bill.order.customerId, customerName: bill.customerName || 'Guest', amount: -total, settledAmount: money(total - remaining), type: 'REFUND', billNumber: bill.billNumber, recordedBy: authorizedBy, paymentMethod: 'LEDGER' } });
        await tx.customer.update({ where: { id: bill.order.customerId }, data: { creditBalance: { decrement: total } } });
      }
      await tx.bill.update({ where: { id: bill.id }, data: { refundedAmount: { increment: total } } });
      if (bill.order.customerId) await tx.customer.update({ where: { id: bill.order.customerId }, data: { totalSpend: { decrement: total } } });
      const record = await tx.returnRecord.create({ data: { id: `return:${user.restaurantId}:${data.actionId}`, restaurantId: user.restaurantId, billNumber: bill.billNumber, orderType: bill.orderType, reason: data.reason.trim(), action: data.action, refundDest: data.refundDest, totalRefund: total, cgst, sgst, items: JSON.stringify(items), authorizedBy } });
      return { id: record.id, totalRefund: total };
    });
  }
}
