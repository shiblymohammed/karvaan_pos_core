import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getBusinessDayBounds } from '../utils/date.util';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getBillHistory(options: {
    restaurantId: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    orderType?: string;
    paymentMethod?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const skip = (page - 1) * limit;

    let startDate, endDate;
    if (options.startDate && options.endDate) {
      startDate = getBusinessDayBounds(options.startDate).start;
      endDate = getBusinessDayBounds(options.endDate).end;
    } else {
      const bounds = getBusinessDayBounds();
      startDate = bounds.start;
      endDate = bounds.end;
    }

    const where: any = {
      restaurantId: options.restaurantId,
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
              orderNumber: true, orderType: true, notes: true,
              items: {
                select: { quantity: true, price: true, notes: true, product: { select: { name: true } } },
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
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: skip + limit < total },
      summary: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalRevenue: bills.reduce((s, b) => s + b.grandTotal, 0),
        totalBills: bills.length,
      },
    };
  }

  async getDailySummary(restaurantId: string, date?: string) {
    const { start, end } = getBusinessDayBounds(date);

    const aggregate = await this.prisma.bill.aggregate({
      where: { restaurantId, settledAt: { gte: start, lte: end } },
      _sum: { grandTotal: true, discount: true, cgst: true, sgst: true },
      _count: { id: true }
    });

    const deliveryOrders = await this.prisma.deliveryOrder.count({
      where: { restaurantId, createdAt: { gte: start, lte: end }, status: 'DELIVERED' },
    });

    const grossRevenue = aggregate._sum.grandTotal || 0;
    const totalDiscount = aggregate._sum.discount || 0;
    const totalGst = (aggregate._sum.cgst || 0) + (aggregate._sum.sgst || 0);

    const paymentGroups = await this.prisma.bill.groupBy({
      by: ['paymentMethod'],
      where: { restaurantId, settledAt: { gte: start, lte: end } },
      _sum: { grandTotal: true }
    });

    const byPayment: Record<string, number> = {};
    for (const group of paymentGroups) {
      byPayment[group.paymentMethod] = group._sum.grandTotal || 0;
    }

    const byOrderType: Record<string, number> = {};

    return {
      date: start.toDateString(),
      totalBills: aggregate._count.id,
      grossRevenue: Number(grossRevenue.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      netRevenue: Number((grossRevenue - totalDiscount).toFixed(2)),
      deliveriesCompleted: deliveryOrders,
      paymentBreakdown: byPayment,
      orderTypeBreakdown: byOrderType,
    };
  }

  async getTopSellingItems(restaurantId: string, startDate?: string, endDate?: string, limit = 10) {
    let start, end;
    if (startDate && endDate) {
      start = getBusinessDayBounds(startDate).start;
      end = getBusinessDayBounds(endDate).end;
    } else {
      const bounds = getBusinessDayBounds();
      end = bounds.end;
      // Default to 30 business days ago
      start = new Date(bounds.start.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { restaurantId, createdAt: { gte: start, lte: end }, status: 'SERVED' },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const products = await Promise.all(
      items.map(async (i) => {
        const product = await this.prisma.product.findUnique({ where: { id: i.productId } });
        return { productId: i.productId, productName: product?.name || 'Unknown', totalSold: i._sum.quantity };
      }),
    );
    return products;
  }

  async getDeliveryHistory(options: { restaurantId: string; startDate?: string; endDate?: string; page?: number; limit?: number; riderId?: string; status?: string; }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const skip = (page - 1) * limit;

    let start, end;
    if (options.startDate && options.endDate) {
      start = getBusinessDayBounds(options.startDate).start;
      end = getBusinessDayBounds(options.endDate).end;
    } else {
      const bounds = getBusinessDayBounds();
      start = bounds.start;
      end = bounds.end;
    }

    const where: any = {
      restaurantId: options.restaurantId,
      createdAt: { gte: start, lte: end },
    };

    if (options.riderId) where.riderId = options.riderId;
    if (options.status) where.status = options.status;

    const [orders, total] = await Promise.all([
      this.prisma.deliveryOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { rider: { select: { name: true } } } }),
      this.prisma.deliveryOrder.count({ where }),
    ]);

    return { data: orders, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getWasteLogs(restaurantId: string, startDate?: string, endDate?: string) {
    let start, end;
    if (startDate && endDate) {
      start = getBusinessDayBounds(startDate).start;
      end = getBusinessDayBounds(endDate).end;
    } else {
      const bounds = getBusinessDayBounds();
      end = bounds.end;
      start = new Date(bounds.start.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return this.prisma.wasteLog.findMany({ where: { restaurantId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } });
  }

  async getReturnRecords(restaurantId: string, startDate?: string, endDate?: string) {
    let start, end;
    if (startDate && endDate) {
      start = getBusinessDayBounds(startDate).start;
      end = getBusinessDayBounds(endDate).end;
    } else {
      const bounds = getBusinessDayBounds();
      end = bounds.end;
      start = new Date(bounds.start.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return this.prisma.returnRecord.findMany({ where: { restaurantId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } });
  }
}
