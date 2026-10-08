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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const kds_gateway_1 = require("../kds/kds.gateway");
const date_util_1 = require("../utils/date.util");
let BillingService = class BillingService {
    constructor(prisma, kdsGateway) {
        this.prisma = prisma;
        this.kdsGateway = kdsGateway;
    }
    async createOrder(data) {
        if (!data.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        if (!data.items || data.items.length === 0) {
            throw new common_1.BadRequestException('Order must contain at least one item.');
        }
        let totalAmount = 0.0;
        const orderItemsData = [];
        for (const item of data.items) {
            const product = await this.prisma.product.findUnique({
                where: { id: item.productId }
            });
            if (!product || product.restaurantId !== data.restaurantId) {
                throw new common_1.NotFoundException(`Product ID ${item.productId} not found in this restaurant.`);
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
        const order = await this.prisma.$transaction(async (tx) => {
            const orderCount = await tx.order.count({ where: { restaurantId: data.restaurantId } });
            const orderNumber = `KORD-${1000 + orderCount + 1}`;
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
            if (data.tableId) {
                const table = await tx.table.findUnique({ where: { id: data.tableId } });
                if (table && table.restaurantId === data.restaurantId) {
                    await tx.table.update({
                        where: { id: data.tableId },
                        data: { status: 'OCCUPIED', currentOrderId: newOrder.id },
                    });
                }
            }
            return newOrder;
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
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
    async calculateBillPreview(orderId, restaurantId, discountAmount = 0) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } },
        });
        if (!order || order.restaurantId !== restaurantId) {
            throw new common_1.NotFoundException(`Order ID ${orderId} not found.`);
        }
        const subtotal = order.totalAmount;
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
    async settleBill(data, restaurantId, cashierId) {
        const preview = await this.calculateBillPreview(data.orderId, restaurantId, data.discount || 0);
        const settledBill = await this.prisma.$transaction(async (tx) => {
            const billCount = await tx.bill.count({ where: { restaurantId } });
            const billNumber = `INV-${2026000 + billCount + 1}`;
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
            const order = await tx.order.update({
                where: { id: data.orderId },
                data: { status: 'SERVED' },
                include: { items: { include: { product: { include: { recipeItems: true } } } }, table: true },
            });
            if (order.tableId) {
                await tx.table.update({
                    where: { id: order.tableId },
                    data: { status: 'AVAILABLE', currentOrderId: null },
                });
            }
            for (const item of order.items) {
                if (!item.product.recipeItems || item.product.recipeItems.length === 0)
                    continue;
                for (const recipeItem of item.product.recipeItems) {
                    const deductQty = item.quantity * recipeItem.quantity;
                    await tx.inventoryItem.update({
                        where: { id: recipeItem.inventoryItemId },
                        data: { currentStock: { decrement: deductQty } },
                    });
                    await tx.stockLog.create({
                        data: {
                            itemId: recipeItem.inventoryItemId,
                            type: 'OUT',
                            quantityChange: -deductQty,
                            notes: `Automated POS deduction for Bill #${billNumber} (${item.quantity}x ${item.product.name})`,
                        },
                    });
                }
            }
            return { bill, order };
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
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
    async processDirectCheckout(billData, restaurantId) {
        const settledBill = await this.prisma.$transaction(async (tx) => {
            let orderId = null;
            let existingOrder = await tx.order.findUnique({
                where: { restaurantId_orderNumber: { restaurantId, orderNumber: billData.orderNumber } }
            });
            if (existingOrder) {
                orderId = existingOrder.id;
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: 'SERVED', discount: billData.discount || 0 }
                });
            }
            else {
                const orderItemsData = [];
                let totalAmount = 0.0;
                if (billData.items) {
                    for (const item of billData.items) {
                        if (item.productId && item.productId !== 'unknown') {
                            const product = await tx.product.findUnique({ where: { id: item.productId } });
                            if (product) {
                                totalAmount += (product.price * item.quantity);
                                orderItemsData.push({
                                    productId: product.id,
                                    quantity: item.quantity,
                                    price: product.price,
                                    notes: item.notes || null,
                                });
                            }
                        }
                    }
                }
                const newOrder = await tx.order.create({
                    data: {
                        orderNumber: billData.orderNumber,
                        restaurantId,
                        totalAmount: Number((billData.subtotal || totalAmount).toFixed(2)),
                        status: 'SERVED',
                        orderType: billData.orderType || 'DINE_IN',
                        items: { create: orderItemsData }
                    }
                });
                orderId = newOrder.id;
            }
            const bill = await tx.bill.upsert({
                where: { restaurantId_billNumber: { restaurantId, billNumber: billData.billNumber } },
                update: {},
                create: {
                    billNumber: billData.billNumber,
                    orderId,
                    orderType: billData.orderType || 'DINE_IN',
                    subtotal: Number((billData.subtotal || 0).toFixed(2)),
                    cgst: Number((billData.cgst || 0).toFixed(2)),
                    sgst: Number((billData.sgst || 0).toFixed(2)),
                    discount: Number((billData.discount || 0).toFixed(2)),
                    deliveryFee: Number((billData.deliveryFee || 0).toFixed(2)),
                    grandTotal: Number((billData.grandTotal || 0).toFixed(2)),
                    paymentMethod: billData.method || billData.paymentMethod || 'CASH',
                    customerName: billData.customerName || null,
                    customerPhone: billData.customerPhone || null,
                    waiterName: billData.waiter || null,
                    settledAt: new Date(),
                    restaurantId,
                }
            });
            const orderWithItems = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: { include: { product: { include: { recipeItems: true } } } } }
            });
            if (orderWithItems) {
                for (const item of orderWithItems.items) {
                    if (!item.product.recipeItems || item.product.recipeItems.length === 0)
                        continue;
                    for (const recipeItem of item.product.recipeItems) {
                        const deductQty = item.quantity * recipeItem.quantity;
                        const invItem = await tx.inventoryItem.findUnique({ where: { id: recipeItem.inventoryItemId } });
                        if (invItem) {
                            const newStock = Math.max(0, invItem.currentStock - deductQty);
                            await tx.inventoryItem.update({
                                where: { id: recipeItem.inventoryItemId },
                                data: { currentStock: newStock },
                            });
                            await tx.stockLog.create({
                                data: {
                                    itemId: recipeItem.inventoryItemId,
                                    type: 'OUT',
                                    quantityChange: -deductQty,
                                    notes: `POS Checkout #${bill.billNumber} (${item.quantity}x ${item.product.name})`,
                                },
                            });
                        }
                    }
                }
            }
            return bill;
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
        const updatedInventory = await this.prisma.inventoryItem.findMany({ where: { restaurantId } });
        this.kdsGateway.server.emit('inventory_updated', updatedInventory);
        return settledBill;
    }
    async getDailyDashboardSummary(restaurantId) {
        const { start, end } = (0, date_util_1.getBusinessDayBounds)();
        const aggregate = await this.prisma.bill.aggregate({
            where: { restaurantId, settledAt: { gte: start, lte: end } },
            _sum: { grandTotal: true },
            _count: { id: true }
        });
        const grossRevenue = aggregate._sum.grandTotal || 0;
        const totalOrders = aggregate._count.id;
        const paymentGroups = await this.prisma.bill.groupBy({
            by: ['paymentMethod'],
            where: { restaurantId, settledAt: { gte: start, lte: end } },
            _sum: { grandTotal: true }
        });
        let cashRevenue = 0, cardRevenue = 0, upiRevenue = 0;
        for (const group of paymentGroups) {
            if (group.paymentMethod === 'CASH')
                cashRevenue = group._sum.grandTotal || 0;
            if (group.paymentMethod === 'CARD')
                cardRevenue = group._sum.grandTotal || 0;
            if (group.paymentMethod === 'UPI')
                upiRevenue = group._sum.grandTotal || 0;
        }
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
    async getOrderHistory(restaurantId, startDate, endDate) {
        const whereClause = { restaurantId };
        if (startDate && endDate) {
            const start = (0, date_util_1.getBusinessDayBounds)(startDate).start;
            const end = (0, date_util_1.getBusinessDayBounds)(endDate).end;
            whereClause.settledAt = { gte: start, lte: end };
        }
        else {
            const { start, end } = (0, date_util_1.getBusinessDayBounds)();
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
        return bills;
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => kds_gateway_1.KdsGateway))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kds_gateway_1.KdsGateway])
], BillingService);
//# sourceMappingURL=billing.service.js.map