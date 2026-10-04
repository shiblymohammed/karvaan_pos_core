import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kdsGateway: KdsGateway,
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

    // Generate unique order number scoped to restaurant
    const orderCount = await this.prisma.order.count({ where: { restaurantId: data.restaurantId } });
    const orderNumber = `KORD-${1000 + orderCount + 1}`;

    // Calculate item prices from Product catalog
    let totalAmount = 0.0;
    const orderItemsData = [];

    for (const item of data.items) {
      const product = await this.prisma.product.findUnique({ 
        where: { id: item.productId } 
      });
      // Ensure product belongs to this restaurant
      if (!product || product.restaurantId !== data.restaurantId) {
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

      return newOrder;
    });

    // Broadcast WebSocket ticket to KDS and Table Layout monitors in real time
    // TODO: Add room-based broadcasting by restaurantId
    this.kdsGateway.server.emit('kds_new_ticket', {
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
      this.kdsGateway.server.emit('table_updated', {
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
    // Calculate weighted GST (e.g. 5% standard dining GST => 2.5% CGST + 2.5% SGST)
    const gstRate = 0.05; 
    const totalGst = (subtotal - discountAmount) * gstRate;
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

  // 3. Settle Bill & Automate Inventory Recipe Deduction
  async settleBill(
    data: { orderId: string; paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT'; discount?: number },
    restaurantId: string,
    cashierId?: string
  ) {
    const preview = await this.calculateBillPreview(data.orderId, restaurantId, data.discount || 0);
    const billCount = await this.prisma.bill.count({ where: { restaurantId } });
    const billNumber = `INV-${2026000 + billCount + 1}`;

    const settledBill = await this.prisma.$transaction(async (tx) => {
      // 1. Create Bill record
      const bill = await tx.bill.create({
        data: {
          billNumber,
          orderId: data.orderId,
          restaurantId,
          subtotal: preview.subtotal,
          cgst: preview.cgst,
          sgst: preview.sgst,
          discount: preview.discount,
          grandTotal: preview.grandTotal,
          paymentMethod: data.paymentMethod,
          cashierId: cashierId || null,
        },
      });

      // 2. Mark Order as SERVED
      const order = await tx.order.update({
        where: { id: data.orderId },
        data: { status: 'SERVED' },
        include: { items: { include: { product: true } }, table: true },
      });

      // 3. Free up dining table if occupied
      if (order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE', currentOrderId: null },
        });
      }

      // 4. Automated Inventory Recipe Deduction
      for (const item of order.items) {
        const invItem = await tx.inventoryItem.findFirst({
          where: { restaurantId, name: { contains: item.product.name } },
        });
        if (invItem) {
          const deductQty = item.quantity * 0.1; // Simulated standard recipe deduction
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: { decrement: deductQty } },
          });
          await tx.stockLog.create({
            data: {
              itemId: invItem.id,
              type: 'OUT',
              quantityChange: -deductQty,
              notes: `Automated POS deduction for Bill #${billNumber}`,
            },
          });
        }
      }

      return { bill, order };
    });

    if (settledBill.order.tableId) {
      this.kdsGateway.server.emit('table_updated', {
        tableId: settledBill.order.tableId,
        restaurantId,
        status: 'AVAILABLE',
      });
    }

    return settledBill;
  }

  // 4. Get Today's Dashboard Sales Summary
  async getDailyDashboardSummary(restaurantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const billsToday = await this.prisma.bill.findMany({
      where: { restaurantId, settledAt: { gte: today } },
    });

    const grossRevenue = billsToday.reduce((sum, b) => sum + b.grandTotal, 0);
    const totalOrders = billsToday.length;

    const cashRevenue = billsToday.filter((b) => b.paymentMethod === 'CASH').reduce((s, b) => s + b.grandTotal, 0);
    const cardRevenue = billsToday.filter((b) => b.paymentMethod === 'CARD').reduce((s, b) => s + b.grandTotal, 0);
    const upiRevenue = billsToday.filter((b) => b.paymentMethod === 'UPI').reduce((s, b) => s + b.grandTotal, 0);

    const activeOrdersCount = await this.prisma.order.count({
      where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
    });
    const occupiedTablesCount = await this.prisma.table.count({
      where: { restaurantId, status: 'OCCUPIED' },
    });

    return {
      grossRevenue: Number(grossRevenue.toFixed(2)),
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Number((grossRevenue / totalOrders).toFixed(2)) : 0,
      activeOrdersCount,
      occupiedTablesCount,
      paymentBreakdown: {
        cash: Number(cashRevenue.toFixed(2)),
        card: Number(cardRevenue.toFixed(2)),
        upi: Number(upiRevenue.toFixed(2)),
      },
    };
  }
}
