"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const date_util_1 = require("../utils/date.util");
let HistoryService = class HistoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBillHistory(options) {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 50, 200);
        const skip = (page - 1) * limit;
        let startDate, endDate;
        if (options.startDate && options.endDate) {
            startDate = (0, date_util_1.getBusinessDayBounds)(options.startDate).start;
            endDate = (0, date_util_1.getBusinessDayBounds)(options.endDate).end;
        }
        else {
            const bounds = (0, date_util_1.getBusinessDayBounds)();
            startDate = bounds.start;
            endDate = bounds.end;
        }
        const where = {
            restaurantId: options.restaurantId,
            settledAt: { gte: startDate, lte: endDate },
        };
        if (options.orderType)
            where.orderType = options.orderType;
        if (options.paymentMethod)
            where.paymentMethod = options.paymentMethod;
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
    async getDailySummary(restaurantId, date) {
        const { start, end } = (0, date_util_1.getBusinessDayBounds)(date);
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
        const byPayment = {};
        for (const group of paymentGroups) {
            byPayment[group.paymentMethod] = group._sum.grandTotal || 0;
        }
        const byOrderType = {};
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
    async getTopSellingItems(restaurantId, startDate, endDate, limit = 10) {
        let start, end;
        if (startDate && endDate) {
            start = (0, date_util_1.getBusinessDayBounds)(startDate).start;
            end = (0, date_util_1.getBusinessDayBounds)(endDate).end;
        }
        else {
            const bounds = (0, date_util_1.getBusinessDayBounds)();
            end = bounds.end;
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
        const products = await Promise.all(items.map(async (i) => {
            const product = await this.prisma.product.findUnique({ where: { id: i.productId } });
            return { productId: i.productId, productName: product?.name || 'Unknown', totalSold: i._sum.quantity };
        }));
        return products;
    }
    async getDeliveryHistory(options) {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 50, 200);
        const skip = (page - 1) * limit;
        let start, end;
        if (options.startDate && options.endDate) {
            start = (0, date_util_1.getBusinessDayBounds)(options.startDate).start;
            end = (0, date_util_1.getBusinessDayBounds)(options.endDate).end;
        }
        else {
            const bounds = (0, date_util_1.getBusinessDayBounds)();
            start = bounds.start;
            end = bounds.end;
        }
        const where = {
            restaurantId: options.restaurantId,
            createdAt: { gte: start, lte: end },
        };
        if (options.riderId)
            where.riderId = options.riderId;
        if (options.status)
            where.status = options.status;
        const [orders, total] = await Promise.all([
            this.prisma.deliveryOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { rider: { select: { name: true } } } }),
            this.prisma.deliveryOrder.count({ where }),
        ]);
        return { data: orders, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    async getWasteLogs(restaurantId, startDate, endDate) {
        let start, end;
        if (startDate && endDate) {
            start = (0, date_util_1.getBusinessDayBounds)(startDate).start;
            end = (0, date_util_1.getBusinessDayBounds)(endDate).end;
        }
        else {
            const bounds = (0, date_util_1.getBusinessDayBounds)();
            end = bounds.end;
            start = new Date(bounds.start.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return this.prisma.wasteLog.findMany({ where: { restaurantId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } });
    }
    async getReturnRecords(restaurantId, startDate, endDate) {
        let start, end;
        if (startDate && endDate) {
            start = (0, date_util_1.getBusinessDayBounds)(startDate).start;
            end = (0, date_util_1.getBusinessDayBounds)(endDate).end;
        }
        else {
            const bounds = (0, date_util_1.getBusinessDayBounds)();
            end = bounds.end;
            start = new Date(bounds.start.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        return this.prisma.returnRecord.findMany({ where: { restaurantId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' } });
    }
};
exports.HistoryService = HistoryService;
exports.HistoryService = HistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HistoryService);
//# sourceMappingURL=history.service.js.map