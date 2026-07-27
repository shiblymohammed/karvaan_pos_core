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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const kds_gateway_1 = require("../kds/kds.gateway");
let BillingService = class BillingService {
    constructor(prisma, kdsGateway) {
        this.prisma = prisma;
        this.kdsGateway = kdsGateway;
    }
    async createOrder(data) {
        if (!data.items || data.items.length === 0) {
            throw new common_1.BadRequestException('Order must contain at least one item.');
        }
        const orderCount = await this.prisma.order.count();
        const orderNumber = `KORD-${1000 + orderCount + 1}`;
        let totalAmount = 0.0;
        const orderItemsData = [];
        for (const item of data.items) {
            const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
            if (!product)
                throw new common_1.NotFoundException(`Product ID ${item.productId} not found.`);
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
            const newOrder = await tx.order.create({
                data: {
                    orderNumber,
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
                await tx.table.update({
                    where: { id: data.tableId },
                    data: { status: 'OCCUPIED', currentOrderId: newOrder.id },
                });
            }
            return newOrder;
        });
        this.kdsGateway.server.emit('kds_new_ticket', {
            id: order.id,
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
                status: 'OCCUPIED',
                orderId: order.id,
            });
        }
        return order;
    }
    async calculateBillPreview(orderId, discountAmount = 0) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } },
        });
        if (!order)
            throw new common_1.NotFoundException(`Order ID ${orderId} not found.`);
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
    async settleBill(data) {
        const preview = await this.calculateBillPreview(data.orderId, data.discount || 0);
        const billCount = await this.prisma.bill.count();
        const billNumber = `INV-${2026000 + billCount + 1}`;
        const settledBill = await this.prisma.$transaction(async (tx) => {
            const bill = await tx.bill.create({
                data: {
                    billNumber,
                    orderId: data.orderId,
                    subtotal: preview.subtotal,
                    cgst: preview.cgst,
                    sgst: preview.sgst,
                    discount: preview.discount,
                    grandTotal: preview.grandTotal,
                    paymentMethod: data.paymentMethod,
                    cashierId: data.cashierId || null,
                },
            });
            const order = await tx.order.update({
                where: { id: data.orderId },
                data: { status: 'SERVED' },
                include: { items: { include: { product: true } }, table: true },
            });
            if (order.tableId) {
                await tx.table.update({
                    where: { id: order.tableId },
                    data: { status: 'AVAILABLE', currentOrderId: null },
                });
            }
            for (const item of order.items) {
                const invItem = await tx.inventoryItem.findFirst({
                    where: { name: { contains: item.product.name } },
                });
                if (invItem) {
                    const deductQty = item.quantity * 0.1;
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
                status: 'AVAILABLE',
            });
        }
        return settledBill;
    }
    async getDailyDashboardSummary() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const billsToday = await this.prisma.bill.findMany({
            where: { settledAt: { gte: today } },
        });
        const grossRevenue = billsToday.reduce((sum, b) => sum + b.grandTotal, 0);
        const totalOrders = billsToday.length;
        const cashRevenue = billsToday.filter((b) => b.paymentMethod === 'CASH').reduce((s, b) => s + b.grandTotal, 0);
        const cardRevenue = billsToday.filter((b) => b.paymentMethod === 'CARD').reduce((s, b) => s + b.grandTotal, 0);
        const upiRevenue = billsToday.filter((b) => b.paymentMethod === 'UPI').reduce((s, b) => s + b.grandTotal, 0);
        const activeOrdersCount = await this.prisma.order.count({
            where: { status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
        });
        const occupiedTablesCount = await this.prisma.table.count({
            where: { status: 'OCCUPIED' },
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
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kds_gateway_1.KdsGateway])
], BillingService);
//# sourceMappingURL=billing.service.js.map