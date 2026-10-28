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
const stock_policy_service_1 = require("./stock-policy.service");
const print_queue_service_1 = require("../printer/print-queue.service");
const print_document_1 = require("../printer/print-document");
const date_util_1 = require("../utils/date.util");
const financial_1 = require("./financial");
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
let BillingService = class BillingService {
    constructor(prisma, kdsGateway, stockPolicy, printQueue) {
        this.prisma = prisma;
        this.kdsGateway = kdsGateway;
        this.stockPolicy = stockPolicy;
        this.printQueue = printQueue;
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
            if (!product || product.isArchived || product.restaurantId !== data.restaurantId) {
                throw new common_1.NotFoundException(`Product ID ${item.productId} not found in this restaurant.`);
            }
            let itemPrice = product.price;
            if (item.variantId && product.variants) {
                try {
                    const vars = JSON.parse(product.variants);
                    const matched = Array.isArray(vars) && vars.find((v) => v.id === item.variantId || v.name === item.variantName);
                    if (matched && typeof matched.price === 'number') {
                        itemPrice = matched.price;
                    }
                }
                catch { }
            }
            else if (Number.isFinite(item.price) && item.price > 0) {
                itemPrice = item.price;
            }
            const itemTotal = itemPrice * item.quantity;
            totalAmount += itemTotal;
            orderItemsData.push({
                productId: product.id,
                quantity: item.quantity,
                price: itemPrice,
                notes: item.notes || null,
                variant: item.variantName || item.variantId || null,
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
            await this.printQueue.kitchen(tx, data.restaurantId, `order:${newOrder.id}`, { reference: newOrder.orderNumber, orderType: newOrder.orderType, table: newOrder.table?.tableNumber, items: newOrder.items.map(item => ({ name: item.product.name, quantity: item.quantity, notes: item.notes })) }, data.waiterId || 'server');
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
    async pricedItems(tx, items, restaurantId, persistedItems = []) {
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
        const archivedQuantities = new Map();
        for (const item of persistedItems)
            archivedQuantities.set((0, financial_1.itemSignature)(item), (archivedQuantities.get((0, financial_1.itemSignature)(item)) || 0) + item.quantity);
        for (const item of items) {
            if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000)
                throw new common_1.BadRequestException('Invalid item quantity');
            let product = await tx.product.findUnique({ where: { id: item.productId } });
            if (typeof item.productId === 'string' && item.productId.startsWith('standalone-')) {
                const addon = addonCatalog.find((a) => `standalone-${a.id}` === item.productId && a.isActive !== false);
                if (!addon || !Number.isFinite(addon.price) || addon.price < 0)
                    throw new common_1.BadRequestException('This standalone add-on is no longer available');
                const category = await tx.category.upsert({ where: { restaurantId_name: { restaurantId, name: 'Add-ons' } }, update: {}, create: { restaurantId, name: 'Add-ons' } });
                product = await tx.product.upsert({ where: { id: `addon:${restaurantId}:${addon.id}` }, update: { name: `+ ${addon.name}`, price: addon.price, isArchived: true }, create: { id: `addon:${restaurantId}:${addon.id}`, restaurantId, categoryId: category.id, name: `+ ${addon.name}`, price: addon.price, isAvailable: false, isArchived: true } });
            }
            if (!product || product.restaurantId !== restaurantId)
                throw new common_1.BadRequestException('Product not found in this restaurant');
            const addons = (item.addons || []).map((addon) => {
                const match = addonCatalog.find((a) => a.id === addon.id && a.isActive !== false);
                if (!match || !Number.isFinite(match.price) || match.price < 0)
                    throw new common_1.BadRequestException('Invalid add-on');
                return { id: match.id, name: match.name, price: match.price };
            });
            if ((product.isArchived || !product.isAvailable) && !String(item.productId).startsWith('standalone-')) {
                const signature = (0, financial_1.itemSignature)({ productId: product.id, addons });
                const remaining = archivedQuantities.get(signature) || 0;
                if (item.quantity > remaining)
                    throw new common_1.BadRequestException(product.isArchived ? 'This menu item was deleted. Remove new quantities; already-sent quantities can still be settled.' : 'This menu item is marked unavailable. Remove new quantities; already-sent quantities can still be settled.');
                archivedQuantities.set(signature, remaining - item.quantity);
            }
            let basePrice = product.price;
            if ((item.variantId || item.variantName) && product.variants) {
                try {
                    const vars = JSON.parse(product.variants);
                    const matched = Array.isArray(vars) && vars.find((v) => (item.variantId && v.id === item.variantId) || (item.variantName && v.name === item.variantName));
                    if (matched && typeof matched.price === 'number') {
                        basePrice = matched.price;
                    }
                }
                catch { }
            }
            const price = roundMoney(basePrice + addons.reduce((sum, a) => sum + a.price, 0));
            lines.push({ product, quantity: item.quantity, price, notes: typeof item.notes === 'string' ? item.notes : null, addons, variant: item.variantName || null });
        }
        return { lines, settings };
    }
    async saveKitchenOrder(data, restaurantId, waiterId) {
        if (!data?.id || !data.orderNumber)
            throw new common_1.BadRequestException('Kitchen ticket ID and order number are required');
        return this.prisma.$transaction(async (tx) => {
            const key = { restaurantId_settingKey: { restaurantId, settingKey: `kot:${data.id}` } };
            const receipt = await tx.systemSetting.findUnique({ where: key });
            if (receipt) {
                const saved = JSON.parse(receipt.data);
                return { ...await tx.order.findUniqueOrThrow({ where: { id: saved.orderId }, include: { items: { include: { product: true } }, table: true } }), printJobId: saved.printJobId || null };
            }
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
            const items = lines.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes, addons: JSON.stringify(i.addons), variant: i.variant || null, status: 'SENT' }));
            const addedTotal = roundMoney(lines.reduce((sum, i) => sum + i.price * i.quantity, 0));
            const order = existing
                ? await tx.order.update({ where: { id: existing.id }, data: { status: 'COOKING', totalAmount: { increment: addedTotal }, items: { create: items } } })
                : await tx.order.create({ data: { restaurantId, orderNumber: data.orderNumber, orderType: data.orderType || 'DINE_IN', waiterId, tableId, status: 'COOKING', totalAmount: addedTotal, items: { create: items } } });
            const printJob = await this.printQueue.kitchen(tx, restaurantId, `kot:${data.id}`, { reference: order.orderNumber, orderNumber: order.orderNumber, table: table?.tableNumber || data.tableNumber, orderType: order.orderType, items: lines.map(line => ({ name: line.variant ? ` ()` : line.product.name, quantity: line.quantity, notes: line.notes, addons: line.addons })) }, waiterId);
            await tx.systemSetting.create({ data: { restaurantId, settingKey: `kot:${data.id}`, data: JSON.stringify({ orderId: order.id, printJobId: printJob?.id || null }) } });
            if (tableId)
                await tx.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED', currentOrderId: order.id } });
            return { ...await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { product: true } }, table: true } }), printJobId: printJob?.id || null };
        });
    }
    async processDirectCheckout(data, restaurantId, cashierId) {
        if (!restaurantId || typeof data?.billNumber !== 'string' || !data.billNumber || typeof data.orderNumber !== 'string' || !data.orderNumber) {
            throw new common_1.BadRequestException('Bill and order identifiers are required');
        }
        const bill = await this.prisma.$transaction(tx => this.checkoutInTransaction(tx, data, restaurantId, cashierId), { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
        try {
            const inventory = await this.prisma.inventoryItem.findMany({ where: { restaurantId, isActive: true } });
            this.kdsGateway.server.to(restaurantId).emit('inventory_updated', inventory);
            this.kdsGateway.server.to(restaurantId).emit('ledger_updated', await (0, financial_1.ledgerView)(this.prisma, restaurantId));
            if (data.tableId)
                this.kdsGateway.server.to(restaurantId).emit('table_updated', { tableId: data.tableId, status: 'AVAILABLE' });
            const order = await this.prisma.order.findUnique({ where: { id: bill.orderId }, include: { items: { include: { product: true } }, table: true } });
            if (order && ['RECEIVED', 'COOKING', 'READY'].includes(order.status))
                this.kdsGateway.server.to(restaurantId).emit('kds_new_ticket', this.kdsGateway.ticket(order));
        }
        catch { }
        return bill;
    }
    async printPrebill(data, user) {
        if (typeof data?.requestId !== 'string' || !data.requestId || data.requestId.length > 200)
            throw new common_1.BadRequestException('A stable print request ID is required');
        return this.prisma.$transaction(async (tx) => {
            const { lines, settings } = await this.pricedItems(tx, data.items, user.restaurantId);
            const table = data.tableId ? await tx.table.findFirst({ where: { id: data.tableId, restaurantId: user.restaurantId } }) : null;
            if (data.tableId && !table)
                throw new common_1.BadRequestException('Table not found');
            const totals = (0, financial_1.billTotals)(lines, settings, data, table?.id);
            const job = await this.printQueue.enqueue(tx, user.restaurantId, 'RECEIPT', `prebill:${data.requestId}`, { ...await this.printQueue.branding(tx, user.restaurantId), kind: 'PREBILL', reference: `PRE-${data.requestId}`, orderType: data.orderType, table: table?.tableNumber, createdAt: new Date().toISOString(), items: lines.map(line => ({ name: line.variant ? ` ()` : line.product.name, quantity: line.quantity, price: line.price, notes: line.notes, addons: line.addons })), ...totals, discount: data.discount || 0, paymentMethod: 'UNPAID' }, user.id, false);
            return { id: job.id, kind: job.kind, reference: job.reference, state: job.state };
        });
    }
    async recipeForProduct(tx, productId) {
        const rows = await tx.recipeIngredient.findMany({ where: { productId }, include: { inventoryItem: true } });
        return rows.map((row) => ({ inventoryItemId: row.inventoryItemId, quantity: Number((row.quantity * (1 + row.wasteFactorPercent / 100)).toFixed(6)), costPrice: row.inventoryItem.costPrice }));
    }
    async checkoutInTransaction(tx, data, restaurantId, cashierId, storedPricing) {
        if (!restaurantId || typeof data?.billNumber !== 'string' || !data.billNumber || typeof data.orderNumber !== 'string' || !data.orderNumber)
            throw new common_1.BadRequestException('Bill and order identifiers are required');
        const existingBill = await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId, billNumber: data.billNumber } }, include: { order: true } });
        if (existingBill) {
            if (existingBill.order.orderNumber !== data.orderNumber)
                throw new common_1.BadRequestException('Bill identifier is already used by another order');
            return existingBill;
        }
        const cashier = await tx.user.findUnique({ where: { id: cashierId } });
        if (!cashier?.isActive || cashier.restaurantId !== restaurantId)
            throw new common_1.UnauthorizedException('Invalid cashier');
        const existingOrder = await tx.order.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } }, include: { bill: true, items: true } });
        const { lines, settings } = storedPricing || await this.pricedItems(tx, data.items, restaurantId, existingOrder?.items || []);
        const discount = data.discount ?? 0;
        let permissions = {};
        try {
            permissions = JSON.parse(cashier.permissions || '{}');
        }
        catch { }
        if (discount > 0 && !storedPricing && !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(cashier.role) && !permissions.canDiscount)
            throw new common_1.UnauthorizedException('Discount permission is required');
        const orderType = data.orderType || 'DINE_IN';
        if (!['DINE_IN', 'PARCEL', 'DELIVERY'].includes(orderType))
            throw new common_1.BadRequestException('Invalid order type');
        const table = data.tableId ? await tx.table.findUnique({ where: { id: data.tableId } }) : null;
        if (data.tableId && (!table || table.restaurantId !== restaurantId))
            throw new common_1.BadRequestException('Invalid dining table');
        const totals = (0, financial_1.billTotals)(lines, settings, { ...data, orderType }, table?.id);
        const { itemSubtotal, surcharge, packaging, deliveryFee, subtotal, cgst, sgst, grandTotal } = totals;
        const tenders = (0, financial_1.paymentAllocation)(data, grandTotal);
        const paymentMethod = Object.keys(tenders).length > 1 ? 'SPLIT' : Object.keys(tenders)[0] || 'CASH';
        if (existingOrder?.bill)
            throw new common_1.BadRequestException('This order is already settled');
        if (table?.currentOrderId && table.currentOrderId !== existingOrder?.id)
            throw new common_1.BadRequestException('This table has a different active order. Reload the table before payment.');
        if (existingOrder) {
            if (data.expectedOrderVersion && new Date(data.expectedOrderVersion).getTime() !== existingOrder.updatedAt.getTime())
                throw new common_1.BadRequestException('This order changed on another terminal. Reload it before payment.');
            (0, financial_1.ensurePersistedItemsPresent)(existingOrder.items, lines.map(i => ({ ...i, productId: i.product.id })));
        }
        const status = existingOrder?.status || (data.items.some((item) => item.status === 'NEW') ? 'COOKING' : 'SERVED');
        const billedItems = lines.map(i => ({ id: (0, crypto_1.randomUUID)(), productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes, addons: JSON.stringify(i.addons), status: status === 'COOKING' ? 'SENT' : 'SERVED' }));
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
            allocatedCgst = roundMoney(allocatedCgst + refundCgst);
            allocatedSgst = roundMoney(allocatedSgst + refundSgst);
            snapshots.push({ id: billedItems[index].id, productId: line.product.id, name: line.product.name, price: line.price, quantity: line.quantity, gstRate: line.product.gstRate, notes: line.notes, addons: line.addons, refundTotal, refundCgst, refundSgst, recipe: recipe.map(r => ({ inventoryItemId: r.inventoryItemId, quantity: r.quantity, costPrice: r.costPrice })) });
        }
        const saved = await tx.bill.create({ data: { restaurantId, billNumber: data.billNumber, orderId: order.id, orderType, subtotal, discount, cgst, sgst, grandTotal, deliveryFee, paymentMethod, tenders: JSON.stringify(tenders), invoiceItems: JSON.stringify(snapshots), cashierId, customerName: data.customerName || null, customerPhone: data.customerPhone || null, waiterName: data.waiter || null } });
        if (tenders.CREDIT > 0 && (!data.customerName?.trim() || !data.customerPhone?.trim()))
            throw new common_1.BadRequestException('Customer name and phone are required for credit');
        if (data.customerPhone?.trim()) {
            const customer = await tx.customer.upsert({ where: { restaurantId_mobile: { restaurantId, mobile: data.customerPhone.trim() } }, update: { name: data.customerName?.trim() || 'Guest', totalSpend: { increment: grandTotal }, creditBalance: { increment: tenders.CREDIT || 0 } }, create: { restaurantId, mobile: data.customerPhone.trim(), name: data.customerName?.trim() || 'Guest', totalSpend: grandTotal, creditBalance: tenders.CREDIT || 0 } });
            await tx.order.update({ where: { id: order.id }, data: { customerId: customer.id } });
            if (tenders.CREDIT > 0)
                await tx.ledgerEntry.create({ data: { id: `credit:${saved.id}`, customerId: customer.id, customerName: customer.name, amount: tenders.CREDIT, type: 'CREDIT', billNumber: saved.billNumber, recordedBy: cashierId } });
        }
        const delivery = ['DELIVERY', 'PARCEL'].includes(orderType) ? await tx.deliveryOrder.findUnique({ where: { restaurantId_orderNumber: { restaurantId, orderNumber: data.orderNumber } } }) : null;
        if (!delivery?.inventoryConsumed)
            await this.stockPolicy.consume(tx, snapshots, cashier, 'checkout', data.billNumber, order.id, data.stockAuthorization);
        if (table)
            await tx.table.update({ where: { id: table.id }, data: { status: 'AVAILABLE', currentOrderId: null } });
        await this.printQueue.receipt(tx, restaurantId, saved, { ...order, table }, cashier.name, true, `receipt:${saved.id}`, false, cashierId);
        const remaining = new Map();
        for (const item of existingOrder?.items || []) {
            const signature = (0, print_document_1.kitchenSignature)(item);
            remaining.set(signature, (remaining.get(signature) || 0) + item.quantity);
        }
        const unsent = snapshots.flatMap(item => {
            const signature = (0, print_document_1.kitchenSignature)(item);
            const previous = remaining.get(signature) || 0;
            remaining.set(signature, Math.max(0, previous - item.quantity));
            const quantity = Math.max(0, item.quantity - previous);
            return quantity > 0 ? [{ ...item, quantity }] : [];
        });
        if ([...remaining.values()].some(quantity => quantity > 0))
            throw new common_1.BadRequestException('Cooking instructions for already-sent food changed. Reload the latest order before payment.');
        await this.printQueue.kitchen(tx, restaurantId, `checkout:${saved.id}`, { reference: order.orderNumber, orderType, table: table?.tableNumber, items: unsent }, cashierId);
        return saved;
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
        const summary = await (0, financial_1.financialSummary)(this.prisma, restaurantId, start, end);
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
        return bills.map(financial_1.immutableHistoryBill);
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => kds_gateway_1.KdsGateway))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        kds_gateway_1.KdsGateway,
        stock_policy_service_1.StockPolicyService,
        print_queue_service_1.PrintQueueService])
], BillingService);
//# sourceMappingURL=billing.service.js.map