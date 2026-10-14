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
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const kds_gateway_1 = require("../kds/kds.gateway");
const date_util_1 = require("../utils/date.util");
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
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
            if (!Number.isInteger(item.quantity) || item.quantity <= 0)
                throw new common_1.BadRequestException('Invalid item quantity');
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
            const orderNumber = `KORD-${(0, crypto_1.randomUUID)()}`;
            for (const [model, id] of [['table', data.tableId], ['user', data.waiterId], ['customer', data.customerId]]) {
                if (id) {
                    const related = await tx[model].findUnique({ where: { id } });
                    if (!related || related.restaurantId !== data.restaurantId)
                        throw new common_1.BadRequestException('Invalid restaurant reference');
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
    async calculateBillPreview(orderId, restaurantId, discountAmount = 0) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } },
        });
        if (!order || order.restaurantId !== restaurantId) {
            throw new common_1.NotFoundException(`Order ID ${orderId} not found.`);
        }
        const subtotal = order.totalAmount;
        if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal)
            throw new common_1.BadRequestException('Invalid discount');
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
    async settleBill(data, restaurantId, cashierId) {
        const order = await this.prisma.order.findFirst({ where: { id: data.orderId, restaurantId }, include: { items: true, bill: true } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const bill = await this.processDirectCheckout({
            billNumber: order.bill?.billNumber || `INV-${order.id}`, orderNumber: order.orderNumber, orderType: order.orderType,
            tableId: order.tableId, discount: data.discount || 0, paymentMethod: data.paymentMethod,
            items: order.items.map(item => ({ productId: item.productId, quantity: item.quantity, notes: item.notes, addons: item.addons ? JSON.parse(item.addons) : [] })),
        }, restaurantId, cashierId);
        return { bill, order: await this.prisma.order.findUnique({ where: { id: order.id } }) };
    }
    async pricedItems(tx, items, restaurantId) {
        if (!Array.isArray(items) || !items.length || items.length > 500)
            throw new common_1.BadRequestException('Order must contain valid items');
        const raw = await tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } });
        let settings = {};
        try {
            settings = JSON.parse(raw?.data || '{}');
        }
        catch { }
        const addonCatalog = settings.paidAddons || [
            { id: 'a1', name: 'Extra Mayonnaise', price: 20 }, { id: 'a2', name: 'Extra Cheese Slice', price: 30 },
            { id: 'a3', name: 'Peri Peri Dip', price: 15 }, { id: 'a4', name: 'Double Patty', price: 120 }, { id: 'a5', name: 'Hazelnut Syrup', price: 40 },
        ];
        const lines = [];
        for (const item of items) {
            if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000)
                throw new common_1.BadRequestException('Invalid item quantity');
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (!product || product.restaurantId !== restaurantId)
                throw new common_1.BadRequestException('Product not found in this restaurant');
            const addons = (item.addons || []).map((addon) => {
                const match = addonCatalog.find((a) => a.id === addon.id && a.isActive !== false);
                if (!match || !Number.isFinite(match.price) || match.price < 0)
                    throw new common_1.BadRequestException('Invalid add-on');
                return { id: match.id, name: match.name, price: match.price };
            });
            const price = roundMoney(product.price + addons.reduce((sum, a) => sum + a.price, 0));
            lines.push({ product, quantity: item.quantity, price, notes: typeof item.notes === 'string' ? item.notes : null, addons });
        }
        return { lines, settings };
    }
    async saveKitchenOrder(data, restaurantId, waiterId) {
        if (!data?.id || !data.orderNumber)
            throw new common_1.BadRequestException('Kitchen ticket ID and order number are required');
        return this.prisma.$transaction(async (tx) => {
            const key = { restaurantId_settingKey: { restaurantId, settingKey: `kot:${data.id}` } };
            const receipt = await tx.systemSetting.findUnique({ where: key });
            if (receipt)
                return tx.order.findUniqueOrThrow({ where: { id: JSON.parse(receipt.data).orderId }, include: { items: { include: { product: true } }, table: true } });
            const { lines } = await this.pricedItems(tx, data.items, restaurantId);
            let existing = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } }, include: { bill: true } });
            if (existing?.bill)
                throw new common_1.BadRequestException('Order is already settled');
            let table = null;
            if (data.tableNumber)
                table = await tx.table.findFirst({ where: { restaurantId, tableNumber: data.tableNumber } });
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
            await tx.systemSetting.create({ data: { restaurantId, settingKey: `kot:${data.id}`, data: JSON.stringify({ orderId: order.id }) } });
            if (tableId)
                await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED', currentOrderId: order.id } });
            return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { product: true } }, table: true } });
        });
    }
    async processDirectCheckout(data, restaurantId, cashierId) {
        if (!restaurantId || typeof data?.billNumber !== 'string' || !data.billNumber || typeof data.orderNumber !== 'string' || !data.orderNumber) {
            throw new common_1.BadRequestException('Bill and order identifiers are required');
        }
        const bill = await this.prisma.$transaction(async (tx) => {
            const existingBill = await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId, billNumber: data.billNumber } }, include: { order: true } });
            if (existingBill) {
                if (existingBill.order.orderNumber !== data.orderNumber)
                    throw new common_1.BadRequestException('Bill identifier is already used by another order');
                return existingBill;
            }
            const cashier = await tx.user.findUnique({ where: { id: cashierId } });
            if (!cashier?.isActive || cashier.restaurantId !== restaurantId)
                throw new common_1.UnauthorizedException('Invalid cashier');
            const { lines, settings } = await this.pricedItems(tx, data.items, restaurantId);
            const itemSubtotal = roundMoney(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
            const discount = data.discount ?? 0;
            if (!Number.isFinite(discount) || discount < 0 || discount > itemSubtotal)
                throw new common_1.BadRequestException('Invalid discount');
            let permissions = {};
            try {
                permissions = JSON.parse(cashier.permissions || '{}');
            }
            catch { }
            if (discount > 0 && !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(cashier.role) && !permissions.canDiscount)
                throw new common_1.UnauthorizedException('Discount permission is required');
            const orderType = data.orderType || 'DINE_IN';
            if (!['DINE_IN', 'PARCEL', 'DELIVERY'].includes(orderType))
                throw new common_1.BadRequestException('Invalid order type');
            const table = data.tableId ? await tx.table.findUnique({ where: { id: data.tableId } }) : null;
            if (data.tableId && (!table || table.restaurantId !== restaurantId))
                throw new common_1.BadRequestException('Invalid dining table');
            const tableConfig = settings.tableConfig?.find((t) => t.id === table?.id);
            const floor = settings.floorConfig?.find((f) => f.id === tableConfig?.floorId);
            const surcharge = floor ? roundMoney(floor.surchargeType === 'PERCENTAGE' ? itemSubtotal * floor.surchargeValue / 100 : floor.surchargeValue) : 0;
            const packaging = orderType === 'PARCEL' ? settings.parcelChargeAmount || 0 : 0;
            const deliveryFee = orderType === 'DELIVERY' ? data.deliveryFee ?? 0 : 0;
            if (![surcharge, packaging, deliveryFee].every(v => Number.isFinite(v) && v >= 0))
                throw new common_1.BadRequestException('Invalid service charge');
            const subtotal = roundMoney(itemSubtotal + surcharge + packaging);
            const tax = roundMoney(lines.reduce((sum, line) => sum + line.price * line.quantity * (1 - discount / (itemSubtotal || 1)) * line.product.gstRate / 100, 0) + (surcharge + packaging) * 0.05);
            const cgst = roundMoney(tax / 2);
            const sgst = roundMoney(tax - cgst);
            const grandTotal = roundMoney(subtotal - discount + cgst + sgst + deliveryFee);
            if (data.grandTotal !== undefined && (!Number.isFinite(data.grandTotal) || Math.abs(data.grandTotal - grandTotal) > 0.02))
                throw new common_1.BadRequestException('Prices or charges have changed; review the cart before checkout');
            const paymentMethod = data.method || data.paymentMethod || 'CASH';
            if (!['CASH', 'CARD', 'UPI', 'CREDIT', 'SPLIT'].includes(paymentMethod))
                throw new common_1.BadRequestException('Invalid payment method');
            if (data.tenders) {
                const amounts = Object.entries(data.tenders);
                if (!amounts.every(([method, amount]) => ['CASH', 'CARD', 'UPI', 'CREDIT'].includes(method) && Number.isFinite(amount) && Number(amount) >= 0) || amounts.reduce((sum, [, amount]) => sum + Number(amount), 0) + 0.01 < grandTotal)
                    throw new common_1.BadRequestException('Insufficient or invalid payment');
            }
            const existingOrder = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } }, include: { bill: true } });
            if (existingOrder?.bill)
                throw new common_1.BadRequestException('This order is already settled');
            const status = existingOrder?.status || (data.items.some((item) => item.status === 'NEW') ? 'COOKING' : 'SERVED');
            const orderValues = { status, totalAmount: subtotal, discount, tableId: table?.id || null, orderType, items: { create: lines.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes, addons: JSON.stringify(i.addons), status: 'SERVED' })) } };
            const order = existingOrder
                ? await tx.order.update({ where: { id: existingOrder.id }, data: { ...orderValues, items: { deleteMany: {}, ...orderValues.items } } })
                : await tx.order.create({ data: { restaurantId, orderNumber: data.orderNumber, ...orderValues } });
            const saved = await tx.bill.create({ data: { restaurantId, billNumber: data.billNumber, orderId: order.id, orderType, subtotal, discount, cgst, sgst, grandTotal, deliveryFee, paymentMethod, cashierId, customerName: data.customerName || null, customerPhone: data.customerPhone || null, waiterName: data.waiter || null } });
            for (const line of lines) {
                const recipe = await tx.recipeIngredient.findMany({ where: { productId: line.product.id }, include: { inventoryItem: true } });
                for (const ingredient of recipe) {
                    if (ingredient.inventoryItem.restaurantId !== restaurantId)
                        throw new common_1.BadRequestException('Invalid recipe inventory');
                    const quantity = line.quantity * ingredient.quantity;
                    await tx.inventoryItem.update({ where: { id: ingredient.inventoryItemId }, data: { currentStock: { decrement: quantity } } });
                    await tx.stockLog.create({ data: { itemId: ingredient.inventoryItemId, type: 'OUT', quantityChange: -quantity, orderId: order.id, notes: `POS Checkout #${saved.billNumber}` } });
                }
            }
            if (table)
                await tx.table.update({ where: { id: table.id }, data: { status: 'AVAILABLE', currentOrderId: null } });
            return saved;
        }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
        try {
            const inventory = await this.prisma.inventoryItem.findMany({ where: { restaurantId } });
            this.kdsGateway.server.to(restaurantId).emit('inventory_updated', inventory);
            if (data.tableId)
                this.kdsGateway.server.to(restaurantId).emit('table_updated', { tableId: data.tableId, status: 'AVAILABLE' });
            const order = await this.prisma.order.findUnique({ where: { id: bill.orderId }, include: { items: { include: { product: true } }, table: true } });
            if (order && ['RECEIVED', 'COOKING', 'READY'].includes(order.status))
                this.kdsGateway.server.to(restaurantId).emit('kds_new_ticket', this.kdsGateway.ticket(order));
        }
        catch { }
        return bill;
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