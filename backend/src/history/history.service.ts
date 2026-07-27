import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated billing history with optional date range filter.
   * Default: loads today's bills only.
   */
  async getBillHistory(options: {
    startDate?: string; // ISO date string, e.g. "2026-07-01"
    endDate?: string;
    page?: number;
    limit?: number;
    orderType?: string; // DINE_IN, PARCEL, DELIVERY
    paymentMethod?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200); // Cap at 200 per page
    const skip = (page - 1) * limit;

    // Build date range: default to today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const startDate = options.startDate ? new Date(options.startDate) : startOfToday;
    const endDate = options.endDate
      ? new Date(new Date(options.endDate).setHours(23, 59, 59, 999))
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const where: any = {
      settledAt: { gte: startDate, lte: endDate },
    };

    if (options.orderType) where.orderType = options.orderType;
    if (options.paymentMethod) where.paymentMethod = options.paymentMethod;

    const [bills, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        orderBy: { settledAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              orderType: true,
              notes: true,
              items: {
                select: {
                  quantity: true,
                  price: true,
                  notes: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
          cashier: { select: { name: true, role: true } },
        },
      }),
      this.prisma.bill.count({ where }),
    ]);

    return {
      data: bills,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
      summary: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRevenue: bills.reduce((s, b) => s + b.grandTotal, 0),
        totalBills: bills.length,
      },
    };
  }

  /**
   * Daily revenue summary for the Day-Close Report.
   */
  async getDailySummary(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const bills = await this.prisma.bill.findMany({
      where: { settledAt: { gte: start, lte: end } },
    });

    const deliveryOrders = await this.prisma.deliveryOrder.count({
      where: { createdAt: { gte: start, lte: end }, status: 'DELIVERED' },
    });

    const grossRevenue = bills.reduce((s, b) => s + b.grandTotal, 0);
    const totalDiscount = bills.reduce((s, b) => s + b.discount, 0);
    const totalGst = bills.reduce((s, b) => s + b.cgst + b.sgst, 0);

    const byPayment: Record<string, number> = {};
    const byOrderType: Record<string, number> = {};

    for (const b of bills) {
      byPayment[b.paymentMethod] = (byPayment[b.paymentMethod] || 0) + b.grandTotal;
      byOrderType[b.orderType] = (byOrderType[b.orderType] || 0) + b.grandTotal;
    }

    return {
      date: start.toDateString(),
      totalBills: bills.length,
      grossRevenue: Number(grossRevenue.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      netRevenue: Number((grossRevenue - totalDiscount).toFixed(2)),
      deliveriesCompleted: deliveryOrders,
      paymentBreakdown: byPayment,
      orderTypeBreakdown: byOrderType,
    };
  }

  /**
   * Top selling items in a given date range.
   */
  async getTopSellingItems(startDate?: string, endDate?: string, limit = 10) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate
      ? new Date(new Date(endDate).setHours(23, 59, 59, 999))
      : new Date();

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: 'SERVED',
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const products = await Promise.all(
      items.map(async (i) => {
        const product = await this.prisma.product.findUnique({ where: { id: i.productId } });
        return {
          productId: i.productId,
          productName: product?.name || 'Unknown',
          totalSold: i._sum.quantity,
        };
      }),
    );

    return products;
  }

  /**
   * Delivery order history with date range and pagination.
   */
  async getDeliveryHistory(options: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    riderId?: string;
    status?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const where: any = {
      createdAt: {
        gte: options.startDate ? new Date(options.startDate) : startOfToday,
        lte: options.endDate
          ? new Date(new Date(options.endDate).setHours(23, 59, 59, 999))
          : new Date(),
      },
    };

    if (options.riderId) where.riderId = options.riderId;
    if (options.status) where.status = options.status;

    const [orders, total] = await Promise.all([
      this.prisma.deliveryOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          rider: { select: { name: true } },
        },
      }),
      this.prisma.deliveryOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Inventory waste logs with date range.
   */
  async getWasteLogs(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();

    return this.prisma.wasteLog.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Return/Refund records with date range.
   */
  async getReturnRecords(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();

    return this.prisma.returnRecord.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
