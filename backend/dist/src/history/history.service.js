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
let HistoryService = class HistoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBillHistory(options) {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 50, 200);
        const skip = (page - 1) * limit;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const startDate = options.startDate ? new Date(options.startDate) : startOfToday;
        const endDate = options.endDate
            ? new Date(new Date(options.endDate).setHours(23, 59, 59, 999))
            : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const where = {
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
    async getDailySummary(date) {
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
        const byPayment = {};
        const byOrderType = {};
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
    async getTopSellingItems(startDate, endDate, limit = 10) {
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
        const products = await Promise.all(items.map(async (i) => {
            const product = await this.prisma.product.findUnique({ where: { id: i.productId } });
            return {
                productId: i.productId,
                productName: product?.name || 'Unknown',
                totalSold: i._sum.quantity,
            };
        }));
        return products;
    }
    async getDeliveryHistory(options) {
        const page = options.page || 1;
        const limit = Math.min(options.limit || 50, 200);
        const skip = (page - 1) * limit;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const where = {
            createdAt: {
                gte: options.startDate ? new Date(options.startDate) : startOfToday,
                lte: options.endDate
                    ? new Date(new Date(options.endDate).setHours(23, 59, 59, 999))
                    : new Date(),
            },
        };
        if (options.riderId)
            where.riderId = options.riderId;
        if (options.status)
            where.status = options.status;
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
    async getWasteLogs(startDate, endDate) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();
        return this.prisma.wasteLog.findMany({
            where: { createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getReturnRecords(startDate, endDate) {
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();
        return this.prisma.returnRecord.findMany({
            where: { createdAt: { gte: start, lte: end } },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.HistoryService = HistoryService;
exports.HistoryService = HistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HistoryService);
//# sourceMappingURL=history.service.js.map