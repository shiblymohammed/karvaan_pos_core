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
exports.KdsGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../prisma/prisma.service");
const billing_service_1 = require("../billing/billing.service");
const session_service_1 = require("../auth/session.service");
const roles_guard_1 = require("../auth/roles.guard");
const STAFF_ROLES = [...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'WAITER', 'KITCHEN', 'DELIVERY'];
const SALES_ROLES = [...roles_guard_1.ADMIN_ROLES, 'CASHIER'];
let KdsGateway = class KdsGateway {
    constructor(prisma, billingService, jwtService, sessions) {
        this.prisma = prisma;
        this.billingService = billingService;
        this.jwtService = jwtService;
        this.sessions = sessions;
    }
    async authenticate(client, roles = STAFF_ROLES) {
        const token = client.handshake.auth?.token || client.handshake.query.token;
        const requested = client.handshake.auth?.restaurantId || client.handshake.query.restaurantId;
        if (typeof token !== 'string' || typeof requested !== 'string')
            throw new common_1.ForbiddenException('Invalid restaurant session');
        const user = await this.sessions.validate(this.jwtService.verify(token));
        if (!user.restaurantId || user.restaurantId !== requested || !roles.includes(user.role)) {
            throw new common_1.ForbiddenException('Insufficient restaurant permissions');
        }
        client.data.user = user;
        return user;
    }
    async run(client, roles, action) {
        try {
            const user = await this.authenticate(client, roles);
            const data = await action(user);
            return { status: 'OK', data };
        }
        catch (error) {
            return { status: 'ERROR', message: error instanceof common_1.HttpException ? error.message : 'Unable to save action; please retry', code: error instanceof common_1.HttpException ? error.getStatus() : 500 };
        }
    }
    list(value) {
        if (!Array.isArray(value) || value.length > 1000)
            throw new common_1.BadRequestException('Invalid action list');
        return value;
    }
    async owned(tx, model, id, restaurantId) {
        const record = await tx[model].findUnique({ where: { id } });
        if (record && record.restaurantId !== restaurantId)
            throw new common_1.ForbiddenException('Record belongs to another restaurant');
        return record;
    }
    async staff(restaurantId) {
        const users = await this.prisma.user.findMany({ where: { restaurantId, isActive: true }, select: { id: true, name: true, username: true, role: true, phone: true, isActive: true, permissions: true } });
        return users.map(user => ({ ...user, pin: '', permissions: (() => { try {
                return JSON.parse(user.permissions || '{}');
            }
            catch {
                return {};
            } })() }));
    }
    ticket(order) {
        return { id: order.id, orderNumber: order.orderNumber, restaurantId: order.restaurantId, orderType: order.orderType, tableNumber: order.table?.tableNumber || (order.orderType === 'DELIVERY' ? '🛵 Delivery' : order.orderType === 'PARCEL' ? '📦 Parcel' : 'Takeaway'), status: order.status, firedAt: order.createdAt, elapsedMinutes: 0, items: order.items.map((item) => ({ id: item.id, productId: item.productId, name: item.product.name, price: item.price, quantity: item.quantity, notes: item.notes, status: item.status })) };
    }
    async handleConnection(client) {
        try {
            const user = await this.authenticate(client);
            await client.join(user.restaurantId);
            const restaurantId = user.restaurantId;
            const [orders, parked, deliveries, staff, inventory, tables, categories, products, recipes, rawSettings] = await Promise.all([
                this.prisma.order.findMany({ where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } }, include: { items: { include: { product: true } }, table: true }, take: 100, orderBy: { createdAt: 'desc' } }),
                this.prisma.parkedOrder.findMany({ where: { restaurantId }, take: 100 }),
                this.prisma.deliveryOrder.findMany({ where: { restaurantId, status: { notIn: ['DELIVERED', 'CANCELLED'] } }, take: 100 }),
                this.staff(restaurantId), this.prisma.inventoryItem.findMany({ where: { restaurantId } }),
                this.prisma.table.findMany({ where: { restaurantId } }), this.prisma.category.findMany({ where: { restaurantId }, orderBy: { sortOrder: 'asc' } }),
                this.prisma.product.findMany({ where: { restaurantId }, include: { category: true } }),
                this.prisma.recipeIngredient.findMany({ where: { product: { restaurantId } }, include: { product: true } }),
                this.prisma.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } }),
            ]);
            let settings = {};
            try {
                settings = JSON.parse(rawSettings?.data || '{}');
            }
            catch { }
            const recipeMap = new Map();
            for (const r of recipes) {
                if (!recipeMap.has(r.productId))
                    recipeMap.set(r.productId, { menuItemId: r.productId, menuItemName: r.product.name, ingredients: [] });
                recipeMap.get(r.productId).ingredients.push({ ingredientId: r.inventoryItemId, quantity: r.quantity });
            }
            client.emit('sync_master_state', {
                kdsTickets: orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, orderType: o.orderType, tableNumber: o.table?.tableNumber || (o.orderType === 'DELIVERY' ? '🛵 Delivery' : 'Takeaway'), status: o.status, firedAt: o.createdAt, elapsedMinutes: 0, items: o.items.map(i => ({ id: i.id, productId: i.productId, name: i.product.name, price: i.price, quantity: i.quantity, notes: i.notes, status: i.status })) })),
                parkedOrders: parked.map(p => { try {
                    return JSON.parse(p.data);
                }
                catch {
                    return null;
                } }).filter(Boolean),
                deliveryOrders: deliveries.map(d => ({ ...d, items: JSON.parse(d.items), deliveryBoyId: d.riderId, deliveryBoyName: d.riderName, placedAt: d.createdAt })),
                staffMembers: staff, inventoryStock: inventory, recipes: Array.from(recipeMap.values()),
                tables: tables.map(t => ({ ...t, number: t.tableNumber, floorId: settings.tableConfig?.find((c) => c.id === t.id)?.floorId || 'f-1' })),
                categories, products: products.map(p => ({ ...p, category: p.category.name, prepTime: p.prepTimeMinutes })), settings,
            });
        }
        catch {
            client.disconnect(true);
        }
    }
    handleFireOrder(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => {
            const order = await this.billingService.saveKitchenOrder(data, user.restaurantId, user.id);
            const ticket = this.ticket(order);
            this.server.to(user.restaurantId).emit('kds_new_ticket', ticket);
            return ticket;
        });
    }
    handleStatusUpdate(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER', 'KITCHEN'], async (user) => {
            if (!['COOKING', 'READY', 'SERVED'].includes(data?.status))
                throw new common_1.BadRequestException('Invalid kitchen status');
            const order = await this.prisma.order.findFirst({ where: { restaurantId: user.restaurantId, OR: [{ id: data.orderId }, { orderNumber: data.orderNumber || data.orderId }] } });
            if (!order)
                throw new common_1.BadRequestException('Kitchen order not found');
            await this.prisma.order.update({ where: { id: order.id }, data: { status: data.status } });
            this.server.to(user.restaurantId).emit('kds_status_changed', { ...data, orderId: order.id });
        });
    }
    handleClearTableTickets(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => {
            if (typeof data?.tableName !== 'string')
                throw new common_1.BadRequestException('Table name is required');
            this.server.to(user.restaurantId).emit('table_tickets_cleared', data);
        });
    }
    handleSyncParkedOrders(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER', 'DELIVERY'], async (user) => {
            const orders = this.list(data);
            await this.prisma.$transaction(async (tx) => {
                for (const order of orders) {
                    if (!order?.id)
                        throw new common_1.BadRequestException('Parked order ID is required');
                    const existing = await tx.parkedOrder.findUnique({ where: { orderId: order.id } });
                    if (existing && existing.restaurantId !== user.restaurantId)
                        throw new common_1.ForbiddenException('Invalid parked order');
                    await tx.parkedOrder.upsert({ where: { orderId: order.id }, update: { data: JSON.stringify(order) }, create: { orderId: order.id, restaurantId: user.restaurantId, data: JSON.stringify(order) } });
                }
                await tx.parkedOrder.deleteMany({ where: { restaurantId: user.restaurantId, orderId: { notIn: orders.map(o => o.id) } } });
            });
            this.server.to(user.restaurantId).emit('parked_orders_updated', orders);
        });
    }
    handleTransferTable(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => {
            if (typeof data?.fromTableName !== 'string' || typeof data.toTableName !== 'string')
                throw new common_1.BadRequestException('Dining tables are required');
            await this.prisma.$transaction(async (tx) => {
                const tables = await tx.table.findMany({ where: { restaurantId: user.restaurantId, tableNumber: { in: [data.fromTableName, data.toTableName] } } });
                const from = tables.find(t => t.tableNumber === data.fromTableName);
                const to = tables.find(t => t.tableNumber === data.toTableName);
                if (!from || !to)
                    throw new common_1.BadRequestException('Invalid dining table');
                await tx.order.updateMany({ where: { restaurantId: user.restaurantId, tableId: from.id, status: { in: ['RECEIVED', 'COOKING', 'READY'] } }, data: { tableId: to.id } });
            });
            this.server.to(user.restaurantId).emit('kds_table_transferred', data);
        });
    }
    handleTableStatus(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => {
            if (!['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED'].includes(data?.status))
                throw new common_1.BadRequestException('Invalid table status');
            const table = await this.owned(this.prisma, 'table', data.tableId, user.restaurantId);
            if (!table)
                throw new common_1.BadRequestException('Table not found');
            await this.prisma.table.update({ where: { id: table.id }, data: { status: data.status, ...(data.status === 'AVAILABLE' ? { currentOrderId: null } : {}) } });
            this.server.to(user.restaurantId).emit('table_updated', data);
        });
    }
    handleSyncDeliveryOrders(data, client) {
        return this.run(client, [...SALES_ROLES, 'DELIVERY', 'KITCHEN'], async (user) => {
            const orders = this.list(data);
            await this.prisma.$transaction(async (tx) => {
                for (const order of orders) {
                    const orderNumber = order.orderNumber || order.id;
                    const existing = await tx.deliveryOrder.findUnique({ where: { restaurantId_orderNumber: { restaurantId: user.restaurantId, orderNumber } } });
                    if (user.role === 'DELIVERY' && (!existing || existing.riderId !== user.id))
                        continue;
                    if (user.role === 'KITCHEN' && !existing)
                        throw new common_1.ForbiddenException('Kitchen staff cannot create deliveries');
                    if (!['RECEIVED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(order.status))
                        throw new common_1.BadRequestException('Invalid delivery status');
                    const riderId = order.deliveryBoyId || order.riderId;
                    if (riderId) {
                        const rider = await this.owned(tx, 'user', riderId, user.restaurantId);
                        if (!rider || rider.role !== 'DELIVERY' || !rider.isActive)
                            throw new common_1.BadRequestException('Invalid rider');
                    }
                    const values = { status: order.status, paymentStatus: order.paymentStatus || 'PENDING', paymentMethod: order.paymentMethod || 'CASH', collectedAmount: order.collectedAmount ?? null };
                    const adminValues = { ...values, riderId: order.deliveryBoyId || order.riderId || null, riderName: order.deliveryBoyName || order.riderName || null, customerName: order.customerName || 'Guest', customerPhone: order.customerPhone || null, deliveryAddress: order.deliveryAddress || null, deliveryLat: order.deliveryLat ?? null, deliveryLng: order.deliveryLng ?? null, grandTotal: order.grandTotal || 0, deliveryFee: order.deliveryFee || 0, items: JSON.stringify(order.items || []), notes: order.notes || null };
                    await tx.deliveryOrder.upsert({ where: { restaurantId_orderNumber: { restaurantId: user.restaurantId, orderNumber } }, update: user.role === 'KITCHEN' ? { status: order.status } : user.role === 'DELIVERY' ? values : adminValues, create: { ...adminValues, restaurantId: user.restaurantId, orderNumber } });
                }
            });
            const records = await this.prisma.deliveryOrder.findMany({ where: { restaurantId: user.restaurantId } });
            this.server.to(user.restaurantId).emit('delivery_orders_updated', records.map(d => ({ ...d, items: JSON.parse(d.items), deliveryBoyId: d.riderId, deliveryBoyName: d.riderName, placedAt: d.createdAt })));
        });
    }
    handleSyncStaff(data, client) {
        return this.run(client, ['ADMIN', 'REST_ADMIN'], async (user) => {
            const staff = this.list(data);
            await this.prisma.$transaction(async (tx) => {
                for (const member of staff) {
                    if (!member?.id || !member.name || !STAFF_ROLES.includes(member.role))
                        throw new common_1.BadRequestException('Invalid staff member');
                    const existing = await this.owned(tx, 'user', member.id, user.restaurantId);
                    if (member.id === user.id && (member.role !== user.role || member.isActive === false))
                        throw new common_1.ForbiddenException('Cannot revoke your own administrator access');
                    if (!existing && !member.pin && !member.password)
                        throw new common_1.BadRequestException('New staff require a PIN or password');
                    const credentials = {};
                    if (member.pin)
                        credentials.pin = await bcrypt.hash(member.pin, 10);
                    if (member.password)
                        credentials.password = await bcrypt.hash(member.password, 10);
                    const values = { name: member.name, username: member.username || null, role: member.role, phone: member.phone || null, isActive: member.isActive !== false, permissions: JSON.stringify(member.permissions || {}), ...credentials };
                    await tx.user.upsert({ where: { id: member.id }, update: values, create: { id: member.id, restaurantId: user.restaurantId, ...values } });
                }
                await tx.user.updateMany({ where: { restaurantId: user.restaurantId, id: { notIn: [...staff.map(s => s.id), user.id] } }, data: { isActive: false } });
            }, { timeout: 30000 });
            this.server.to(user.restaurantId).emit('staff_updated', await this.staff(user.restaurantId));
        });
    }
    handleSyncInventory(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            const inventory = this.list(data);
            await this.prisma.$transaction(async (tx) => {
                for (const item of inventory) {
                    if (!item?.name || !Number.isFinite(item.currentStock) || item.currentStock < 0)
                        throw new common_1.BadRequestException('Invalid inventory quantity');
                    if (item.id)
                        await this.owned(tx, 'inventoryItem', item.id, user.restaurantId);
                    const values = { currentStock: item.currentStock, category: item.category || 'General', unit: item.unit || 'pcs', minThreshold: item.reorderLevel ?? item.minThreshold ?? 5, costPrice: item.costPerUnit ?? item.costPrice ?? 0 };
                    await tx.inventoryItem.upsert({ where: { restaurantId_name: { restaurantId: user.restaurantId, name: item.name } }, update: values, create: { id: item.id || undefined, restaurantId: user.restaurantId, name: item.name, ...values } });
                }
            });
            this.server.to(user.restaurantId).emit('inventory_updated', await this.prisma.inventoryItem.findMany({ where: { restaurantId: user.restaurantId } }));
        });
    }
    handleSyncRecipes(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            await this.prisma.$transaction(async (tx) => {
                for (const recipe of this.list(data)) {
                    const product = await this.owned(tx, 'product', recipe.menuItemId, user.restaurantId);
                    if (!product)
                        throw new common_1.BadRequestException('Recipe product not found');
                    await tx.recipeIngredient.deleteMany({ where: { productId: product.id } });
                    for (const item of this.list(recipe.ingredients)) {
                        const stock = await this.owned(tx, 'inventoryItem', item.ingredientId, user.restaurantId);
                        if (!stock || !Number.isFinite(item.quantity) || item.quantity <= 0)
                            throw new common_1.BadRequestException('Invalid recipe ingredient');
                        await tx.recipeIngredient.create({ data: { productId: product.id, inventoryItemId: stock.id, quantity: item.quantity, unit: stock.unit } });
                    }
                }
            });
            this.server.to(user.restaurantId).emit('recipes_updated', data);
        });
    }
    handleSyncMenu(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            await this.prisma.$transaction(async (tx) => {
                const incomingCategories = this.list(data.categories);
                const incomingProducts = this.list(data.products);
                const newTombstones = [];
                for (const category of incomingCategories) {
                    await this.owned(tx, 'category', category.id, user.restaurantId);
                    const values = { name: category.name, sortOrder: category.sortOrder || 0, iconName: category.iconName || null, imageUrl: category.imageUrl || null };
                    await tx.category.upsert({ where: { id: category.id }, update: values, create: { id: category.id, restaurantId: user.restaurantId, ...values } });
                }
                for (const product of incomingProducts) {
                    await this.owned(tx, 'product', product.id, user.restaurantId);
                    if (!Number.isFinite(product.price) || product.price < 0 || !Number.isFinite(product.gstRate ?? 5) || (product.gstRate ?? 5) < 0 || (product.gstRate ?? 5) > 100)
                        throw new common_1.BadRequestException('Invalid product price or tax');
                    const category = await tx.category.findFirst({ where: { restaurantId: user.restaurantId, name: product.category } });
                    if (!category)
                        throw new common_1.BadRequestException('Product category not found');
                    const values = { name: product.name, price: product.price, categoryId: category.id, gstRate: product.gstRate ?? 5, prepTimeMinutes: product.prepTime ?? 12, isAvailable: product.isAvailable !== false, description: product.description || null, imageEmoji: product.imageEmoji || null, imageUrl: product.imageUrl || null };
                    await tx.product.upsert({ where: { id: product.id }, update: values, create: { id: product.id, restaurantId: user.restaurantId, ...values } });
                }
                if (incomingProducts.length > 0) {
                    const incProdIds = new Set(incomingProducts.map((p) => p.id));
                    const existingProds = await tx.product.findMany({ where: { restaurantId: user.restaurantId } });
                    for (const ep of existingProds) {
                        if (!incProdIds.has(ep.id)) {
                            const orderItemCount = await tx.orderItem.count({ where: { productId: ep.id } });
                            if (orderItemCount === 0) {
                                await tx.recipeIngredient.deleteMany({ where: { productId: ep.id } });
                                await tx.product.delete({ where: { id: ep.id } });
                                newTombstones.push({ id: ep.id, model: 'product', deletedAt: new Date().toISOString() });
                            }
                            else if (ep.isAvailable) {
                                await tx.product.update({ where: { id: ep.id }, data: { isAvailable: false } });
                            }
                        }
                    }
                }
                if (incomingCategories.length > 0) {
                    const incCatIds = new Set(incomingCategories.map((c) => c.id));
                    const existingCats = await tx.category.findMany({ where: { restaurantId: user.restaurantId } });
                    for (const ec of existingCats) {
                        if (!incCatIds.has(ec.id)) {
                            const prodCount = await tx.product.count({ where: { categoryId: ec.id } });
                            if (prodCount === 0) {
                                await tx.category.delete({ where: { id: ec.id } });
                                newTombstones.push({ id: ec.id, model: 'category', deletedAt: new Date().toISOString() });
                            }
                        }
                    }
                }
                if (newTombstones.length > 0) {
                    const tKey = { restaurantId_settingKey: { restaurantId: user.restaurantId, settingKey: 'sync_tombstones' } };
                    const rec = await tx.systemSetting.findUnique({ where: tKey });
                    let list = [];
                    try {
                        list = JSON.parse(rec?.data || '[]');
                    }
                    catch { }
                    list.push(...newTombstones);
                    if (list.length > 500)
                        list = list.slice(-500);
                    await tx.systemSetting.upsert({ where: tKey, update: { data: JSON.stringify(list) }, create: { restaurantId: user.restaurantId, settingKey: 'sync_tombstones', data: JSON.stringify(list) } });
                }
            });
            client.broadcast.to(user.restaurantId).emit('sync_master_state', { categories: data.categories, products: data.products });
        });
    }
    handleSyncWaste(data, client) {
        return this.run(client, [...roles_guard_1.ADMIN_ROLES, 'KITCHEN'], async (user) => {
            await this.prisma.$transaction(async (tx) => {
                for (const log of this.list(data)) {
                    if (!log.id || !Number.isFinite(log.quantity) || log.quantity <= 0)
                        throw new common_1.BadRequestException('Invalid waste log');
                    await this.owned(tx, 'wasteLog', log.id, user.restaurantId);
                    await tx.wasteLog.upsert({ where: { id: log.id }, update: {}, create: { id: log.id, restaurantId: user.restaurantId, itemName: log.itemName || log.ingredientName, quantity: log.quantity, unit: log.unit || 'pcs', reason: log.reason || 'OTHER', loggedBy: user.name } });
                }
            });
            this.server.to(user.restaurantId).emit('waste_updated', data);
        });
    }
    handleSettleBill(data, client) {
        return this.run(client, SALES_ROLES, async (user) => {
            const bill = await this.billingService.processDirectCheckout(data, user.restaurantId, user.id);
            this.server.to(user.restaurantId).emit('bill_settled', bill);
            return bill;
        });
    }
};
exports.KdsGateway = KdsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], KdsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('fire_order'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleFireOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_kds_status'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleStatusUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('clear_table_tickets'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleClearTableTickets", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_parked_orders'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncParkedOrders", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('transfer_kds_table'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleTransferTable", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('table_status_change'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleTableStatus", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_delivery_orders'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncDeliveryOrders", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_staff'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncStaff", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_inventory'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncInventory", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_recipes'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncRecipes", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_menu'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncMenu", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_waste'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncWaste", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('settle_bill'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSettleBill", null);
exports.KdsGateway = KdsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => billing_service_1.BillingService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_service_1.BillingService,
        jwt_1.JwtService,
        session_service_1.SessionService])
], KdsGateway);
//# sourceMappingURL=kds.gateway.js.map