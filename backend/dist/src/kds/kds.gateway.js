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
const workflow_service_1 = require("../billing/workflow.service");
const session_service_1 = require("../auth/session.service");
const roles_guard_1 = require("../auth/roles.guard");
const settings_service_1 = require("../settings/settings.service");
const financial_1 = require("../billing/financial");
const STAFF_ROLES = [...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'WAITER', 'KITCHEN', 'DELIVERY'];
const SALES_ROLES = [...roles_guard_1.ADMIN_ROLES, 'CASHIER'];
let KdsGateway = class KdsGateway {
    constructor(prisma, billingService, workflows, jwtService, sessions, settingsService) {
        this.prisma = prisma;
        this.billingService = billingService;
        this.workflows = workflows;
        this.jwtService = jwtService;
        this.sessions = sessions;
        this.settingsService = settingsService;
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
            const details = error instanceof common_1.HttpException ? error.getResponse() : null;
            return { status: 'ERROR', message: typeof details?.message === 'string' ? details.message : error instanceof common_1.HttpException ? error.message : 'Unable to save action; please retry', code: error instanceof common_1.HttpException ? error.getStatus() : 500, ...(details?.reason === 'STOCK_APPROVAL_REQUIRED' ? { reason: details.reason, stockChallenge: details.stockChallenge, shortages: details.shortages } : {}) };
        }
    }
    list(value) {
        if (!Array.isArray(value) || value.length > 1000)
            throw new common_1.BadRequestException('Invalid action list');
        return value;
    }
    async broadcastOperations(restaurantId, includeWaste = false) {
        try {
            const [ledger, deliveries, inventory, orders] = await Promise.all([
                this.workflows.ledger(restaurantId), this.workflows.deliveryState(restaurantId),
                this.prisma.inventoryItem.findMany({ where: { restaurantId, isActive: true } }),
                this.prisma.order.findMany({ where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } }, include: { items: { include: { product: true } }, table: true } }),
            ]);
            this.server.to(restaurantId).emit('ledger_updated', ledger);
            this.server.to(restaurantId).emit('delivery_orders_updated', deliveries);
            this.server.to(restaurantId).emit('inventory_updated', inventory);
            if (includeWaste)
                this.server.to(restaurantId).emit('waste_updated', await this.workflows.wasteState(restaurantId));
            for (const order of orders)
                this.server.to(restaurantId).emit('kds_new_ticket', this.ticket(order));
        }
        catch {
            console.error('Action committed; live notification could not be refreshed.');
        }
    }
    handleCreateDelivery(data, client) {
        return this.run(client, SALES_ROLES, async (user) => { const result = await this.workflows.createDelivery(data, user); await this.broadcastOperations(user.restaurantId); return result; });
    }
    handlePark(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => { const result = await this.workflows.park(data, user); try {
            this.server.to(user.restaurantId).emit('parked_orders_updated', await this.workflows.parkedSnapshot(user.restaurantId));
        }
        catch { } return result; });
    }
    handleUnpark(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => { const result = await this.workflows.park(data, user, true); try {
            this.server.to(user.restaurantId).emit('parked_orders_updated', await this.workflows.parkedSnapshot(user.restaurantId));
        }
        catch { } return result; });
    }
    handleUpdateDelivery(data, client) {
        return this.run(client, [...SALES_ROLES, 'DELIVERY', 'KITCHEN'], async (user) => { const result = await this.workflows.updateDelivery(data, user); await this.broadcastOperations(user.restaurantId); return result; });
    }
    handleDeliveryPayment(data, client) {
        return this.run(client, [...SALES_ROLES, 'DELIVERY'], async (user) => { const result = await this.workflows.collectDelivery(data, user); await this.broadcastOperations(user.restaurantId); return result; });
    }
    handleLedgerPayment(data, client) {
        return this.run(client, SALES_ROLES, async (user) => { const result = await this.workflows.repay(data, user); await this.broadcastOperations(user.restaurantId); return result; });
    }
    handleInventoryChanges(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            const result = await this.workflows.inventory(data, user);
            await this.broadcastOperations(user.restaurantId);
            if (data.changes?.some((change) => change.remove)) {
                try {
                    const state = await this.workflows.adminConfig(user.restaurantId);
                    this.server.to(user.restaurantId).emit('recipes_updated', { recipes: state.recipes, revision: state.recipeRevision });
                }
                catch { }
            }
            return result;
        });
    }
    handleInventoryPurchase(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => { const result = await this.workflows.receiveInventoryPurchase(data, user); await this.broadcastOperations(user.restaurantId); return result; });
    }
    handleReturn(data, client) {
        return this.run(client, SALES_ROLES, async (user) => { const result = await this.workflows.refund(data, user); await this.broadcastOperations(user.restaurantId, true); return result; });
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
        return { id: order.id, orderNumber: order.orderNumber, restaurantId: order.restaurantId, orderType: order.orderType, tableNumber: order.table?.tableNumber || (order.orderType === 'DELIVERY' ? '🛵 Delivery' : order.orderType === 'PARCEL' ? '📦 Parcel' : 'Takeaway'), status: order.status, firedAt: order.createdAt, elapsedMinutes: 0, items: order.items.map((item) => ({ id: item.id, productId: item.productId, name: item.product.name, price: item.price, quantity: item.quantity, notes: item.notes, addons: (0, financial_1.readJson)(item.addons, []), variant: item.variant || null, status: item.status })) };
    }
    async handleConnection(client) {
        try {
            const user = await this.authenticate(client);
            await client.join(user.restaurantId);
            const restaurantId = user.restaurantId;
            const [orders, parked, inventory, tables, settings, admin, menu] = await Promise.all([
                this.prisma.order.findMany({ where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } }, include: { items: { include: { product: true } }, table: true }, take: 100, orderBy: { createdAt: 'desc' } }),
                this.workflows.parkedSnapshot(restaurantId),
                this.prisma.inventoryItem.findMany({ where: { restaurantId, isActive: true } }),
                this.prisma.table.findMany({ where: { restaurantId } }),
                this.settingsService.getSettings(restaurantId), this.workflows.adminConfig(restaurantId), this.workflows.menu(restaurantId),
            ]);
            client.emit('sync_master_state', {
                menuRevision: menu.serverRevision, staffRevision: admin.staffRevision, recipeRevision: admin.recipeRevision,
                ledgerEntries: await this.workflows.ledger(restaurantId),
                kdsTickets: orders.map(order => this.ticket(order)),
                parkedOrders: parked.orders, parkedRevision: parked.revision,
                deliveryOrders: await this.workflows.deliveryState(restaurantId),
                staffMembers: admin.staff, inventoryStock: inventory, recipes: admin.recipes,
                wasteLogs: await this.workflows.wasteState(restaurantId),
                tables: tables.map(t => ({ ...t, number: t.tableNumber, floorId: settings.tableConfig?.find((c) => c.id === t.id)?.floorId || 'f-1' })),
                categories: menu.categories, products: menu.products, settings,
            });
        }
        catch (error) {
            const message = error?.message || 'WebSocket connection failed';
            console.error('WebSocket connection failed for client:', client.id, message, error);
            client.emit('auth_error', { message });
            setTimeout(() => {
                try {
                    client.disconnect(true);
                }
                catch { }
            }, 100);
        }
    }
    handleFireOrder(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER'], async (user) => {
            const order = await this.billingService.saveKitchenOrder(data, user.restaurantId, user.id);
            const ticket = this.ticket(order);
            this.server.to(user.restaurantId).emit('kds_new_ticket', ticket);
            return { ...ticket, printJobId: order.printJobId || null };
        });
    }
    handleStatusUpdate(data, client) {
        return this.run(client, [...SALES_ROLES, 'WAITER', 'KITCHEN'], async (user) => {
            const result = await this.workflows.kitchenStatus(data, user);
            try {
                const order = await this.prisma.order.findUnique({ where: { id: result.orderId } });
                this.server.to(user.restaurantId).emit('kds_status_changed', { orderId: result.orderId, status: order.status });
            }
            catch (error) {
                console.error('Kitchen notification failed', error);
            }
            await this.broadcastOperations(user.restaurantId);
            return result;
        });
    }
    handleRiderRemittance(data, client) {
        return this.run(client, SALES_ROLES, async (user) => {
            const result = await this.workflows.remitRiderCash(data, user);
            await this.broadcastOperations(user.restaurantId);
            return result;
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
                    if (existing && existing.data !== JSON.stringify(order))
                        throw new common_1.BadRequestException('This older client cannot overwrite a parked order. Refresh the app before editing.');
                    await tx.parkedOrder.upsert({ where: { orderId: order.id }, update: { data: JSON.stringify(order) }, create: { orderId: order.id, restaurantId: user.restaurantId, data: JSON.stringify(order) } });
                }
            });
            this.server.to(user.restaurantId).emit('parked_orders_updated', await this.workflows.parkedState(user.restaurantId));
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
        return this.run(client, [...SALES_ROLES, 'DELIVERY', 'KITCHEN'], async () => { throw new common_1.BadRequestException('Refresh the app to use delivery commands. Legacy snapshots cannot change payment records.'); });
    }
    handleSyncStaff(data, client) {
        return this.run(client, ['ADMIN', 'REST_ADMIN'], async (user) => {
            const staff = this.list(data.staff);
            const result = await this.workflows.versionedConfig(data, user, 'staff', async (tx) => {
                for (const member of staff) {
                    if (!member?.id || !member.name || !STAFF_ROLES.includes(member.role))
                        throw new common_1.BadRequestException('Invalid staff member');
                    const existing = await this.owned(tx, 'user', member.id, user.restaurantId);
                    if (typeof member.name !== 'string' || !member.name.trim())
                        throw new common_1.BadRequestException('Staff name is required');
                    if (member.password && (typeof member.password !== 'string' || member.password.length < 8 || member.password.length > 128))
                        throw new common_1.BadRequestException('Staff passwords must contain 8–128 characters');
                    if (member.pin && (typeof member.pin !== 'string' || !/^\d{4,8}$/.test(member.pin)))
                        throw new common_1.BadRequestException('Staff PINs must contain 4–8 digits');
                    if (!existing && (typeof member.username !== 'string' || !member.username.trim()))
                        throw new common_1.BadRequestException('New staff require a login username');
                    if (member.username !== undefined && member.username !== null && typeof member.username !== 'string')
                        throw new common_1.BadRequestException('Invalid staff username');
                    if (member.username && await tx.user.findFirst({ where: { username: member.username.trim(), id: { not: member.id } } }))
                        throw new common_1.ConflictException('This username is already in use. Choose a different username.');
                    if (member.id === user.id && (member.role !== user.role || member.isActive === false))
                        throw new common_1.ForbiddenException('Cannot revoke your own administrator access');
                    if (!existing && !member.pin && !member.password)
                        throw new common_1.BadRequestException('New staff require a PIN or password');
                    const credentials = {};
                    if (member.pin)
                        credentials.pin = await bcrypt.hash(member.pin, 10);
                    if (member.password)
                        credentials.password = await bcrypt.hash(member.password, 10);
                    const values = { name: member.name.trim(), username: member.username?.trim() || null, role: member.role, phone: member.phone || null, isActive: member.isActive !== false, permissions: JSON.stringify(member.permissions || {}), ...credentials };
                    await tx.user.upsert({ where: { id: member.id }, update: values, create: { id: member.id, restaurantId: user.restaurantId, ...values } });
                }
                await tx.user.updateMany({ where: { restaurantId: user.restaurantId, id: { notIn: [...staff.map(s => s.id), user.id] } }, data: { isActive: false } });
            });
            try {
                const state = await this.workflows.adminConfig(user.restaurantId);
                this.server.to(user.restaurantId).emit('staff_updated', { staff: state.staff, revision: state.staffRevision });
            }
            catch { }
            return result;
        });
    }
    handleSyncInventory(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async () => { throw new common_1.BadRequestException('Refresh the app to apply stock movements. Legacy snapshots cannot overwrite stock.'); });
    }
    handleSyncRecipes(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            const recipes = this.list(data.recipes);
            const result = await this.workflows.versionedConfig(data, user, 'recipes', async (tx) => {
                for (const recipe of recipes) {
                    const product = await this.owned(tx, 'product', recipe.menuItemId, user.restaurantId);
                    if (!product || product.isArchived)
                        throw new common_1.BadRequestException('Recipe product is unavailable or archived; reload the menu');
                    if (recipe.prepInstructions !== undefined && (typeof recipe.prepInstructions !== 'string' || recipe.prepInstructions.length > 10000))
                        throw new common_1.BadRequestException('Invalid preparation instructions');
                    if (recipe.batchSize !== undefined && (!Number.isFinite(recipe.batchSize) || recipe.batchSize <= 0))
                        throw new common_1.BadRequestException('Invalid preparation batch size');
                    await tx.product.update({ where: { id: product.id }, data: { ...(recipe.prepInstructions !== undefined ? { recipeInstructions: recipe.prepInstructions } : {}), ...(recipe.batchSize !== undefined ? { recipeBatchSize: recipe.batchSize } : {}) } });
                    await tx.recipeIngredient.deleteMany({ where: { productId: product.id } });
                    for (const item of this.list(recipe.ingredients)) {
                        const stock = await this.owned(tx, 'inventoryItem', item.ingredientId, user.restaurantId);
                        if (!stock || !stock.isActive || !Number.isFinite(item.quantity) || item.quantity <= 0)
                            throw new common_1.BadRequestException('Invalid recipe ingredient');
                        const wasteFactorPercent = item.wasteFactorPercent ?? 0;
                        if (!Number.isFinite(wasteFactorPercent) || wasteFactorPercent < 0 || wasteFactorPercent > 100)
                            throw new common_1.BadRequestException('Waste percentage must be between 0 and 100');
                        await tx.recipeIngredient.create({ data: { productId: product.id, inventoryItemId: stock.id, quantity: item.quantity, unit: stock.unit, wasteFactorPercent } });
                    }
                }
                await tx.recipeIngredient.deleteMany({ where: { product: { restaurantId: user.restaurantId, isArchived: false }, productId: { notIn: recipes.map(recipe => recipe.menuItemId) } } });
            });
            try {
                const state = await this.workflows.adminConfig(user.restaurantId);
                this.server.to(user.restaurantId).emit('recipes_updated', { recipes: state.recipes, revision: state.recipeRevision });
            }
            catch { }
            return result;
        });
    }
    handleUpdateSettings(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, user => this.settingsService.updateSettings({ ...data.settings, actionId: data.actionId, expectedRevision: data.expectedRevision }, user.restaurantId));
    }
    handleSyncMenu(data, client) {
        return this.run(client, roles_guard_1.ADMIN_ROLES, async (user) => {
            await this.prisma.$transaction(async (tx) => {
                const receiptKey = { restaurantId_settingKey: { restaurantId: user.restaurantId, settingKey: `command:menu:${data.actionId}` } };
                if (data.actionId && await tx.systemSetting.findUnique({ where: receiptKey }))
                    return;
                const versionKey = { restaurantId_settingKey: { restaurantId: user.restaurantId, settingKey: 'menu_revision' } };
                const version = await tx.systemSetting.findUnique({ where: versionKey });
                const revision = version ? JSON.parse(version.data) : 0;
                if (data.expectedRevision !== revision)
                    throw new common_1.ConflictException('Menu changed on another terminal. Reload and review your changes.');
                const incomingCategories = this.list(data.categories);
                const incomingProducts = this.list(data.products);
                const newTombstones = [];
                for (const category of incomingCategories) {
                    await this.owned(tx, 'category', category.id, user.restaurantId);
                    const values = { name: category.name, sortOrder: category.sortOrder || 0, iconName: category.iconName || null, imageUrl: category.imageUrl || null };
                    await tx.category.upsert({ where: { id: category.id }, update: values, create: { id: category.id, restaurantId: user.restaurantId, ...values } });
                }
                for (const product of incomingProducts) {
                    const existingProduct = await this.owned(tx, 'product', product.id, user.restaurantId);
                    if (existingProduct?.isArchived)
                        throw new common_1.ConflictException('This menu item was deleted. Reload the menu before editing; create a new item to add it again.');
                    if (!Number.isFinite(product.price) || product.price < 0 || !Number.isFinite(product.gstRate ?? 5) || (product.gstRate ?? 5) < 0 || (product.gstRate ?? 5) > 100)
                        throw new common_1.BadRequestException('Invalid product price or tax');
                    const category = await tx.category.findFirst({ where: { restaurantId: user.restaurantId, name: product.category } });
                    if (!category)
                        throw new common_1.BadRequestException('Product category not found');
                    const variants = product.variants ? (typeof product.variants === 'string' ? product.variants : JSON.stringify(product.variants)) : null;
                    const values = { name: product.name, price: product.price, categoryId: category.id, gstRate: product.gstRate ?? 5, prepTimeMinutes: product.prepTime ?? 12, isAvailable: product.isAvailable !== false, description: product.description || null, imageEmoji: product.imageEmoji || null, imageUrl: product.imageUrl || null, variants };
                    await tx.product.upsert({ where: { id: product.id }, update: values, create: { id: product.id, restaurantId: user.restaurantId, ...values } });
                }
                {
                    const incProdIds = new Set(incomingProducts.map((p) => p.id));
                    const existingProds = await tx.product.findMany({ where: { restaurantId: user.restaurantId, isArchived: false } });
                    for (const ep of existingProds) {
                        if (!incProdIds.has(ep.id)) {
                            await tx.product.update({ where: { id: ep.id }, data: { isAvailable: false, isArchived: true } });
                            newTombstones.push({ id: ep.id, model: 'product', deletedAt: new Date().toISOString() });
                        }
                    }
                }
                {
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
                await tx.systemSetting.upsert({ where: versionKey, update: { data: JSON.stringify(revision + 1) }, create: { restaurantId: user.restaurantId, settingKey: 'menu_revision', data: JSON.stringify(revision + 1) } });
                if (data.actionId)
                    await tx.systemSetting.create({ data: { restaurantId: user.restaurantId, settingKey: receiptKey.restaurantId_settingKey.settingKey, data: 'true' } });
            });
            try {
                const menu = await this.workflows.menu(user.restaurantId);
                this.server.to(user.restaurantId).emit('sync_master_state', { ...menu, menuRevision: menu.serverRevision });
            }
            catch (error) {
                console.error('Menu notification failed', error);
            }
        });
    }
    handleSyncWaste(data, client) {
        return this.run(client, [...roles_guard_1.ADMIN_ROLES, 'KITCHEN'], async () => { throw new common_1.BadRequestException('Refresh the app to record waste and its stock deduction in one transaction. Older waste snapshots require review.'); });
    }
    handleInventoryWaste(data, client) {
        return this.run(client, [...roles_guard_1.ADMIN_ROLES, 'KITCHEN'], async (user) => { const result = await this.workflows.recordWaste(data, user); await this.broadcastOperations(user.restaurantId, true); return result; });
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
    (0, websockets_1.SubscribeMessage)('create_delivery'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleCreateDelivery", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('park_order'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handlePark", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('remove_parked_order'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleUnpark", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_delivery'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleUpdateDelivery", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('collect_delivery_payment'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleDeliveryPayment", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ledger_payment'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleLedgerPayment", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('apply_inventory_changes'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleInventoryChanges", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('receive_inventory_purchase'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleInventoryPurchase", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('record_return'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleReturn", null);
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
    (0, websockets_1.SubscribeMessage)('remit_rider_cash'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleRiderRemittance", null);
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
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncDeliveryOrders", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_staff'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncStaff", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_inventory'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncInventory", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_recipes'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncRecipes", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_settings'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleUpdateSettings", null);
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
    (0, websockets_1.SubscribeMessage)('record_inventory_waste'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleInventoryWaste", null);
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
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => workflow_service_1.WorkflowService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_service_1.BillingService,
        workflow_service_1.WorkflowService,
        jwt_1.JwtService,
        session_service_1.SessionService,
        settings_service_1.SettingsService])
], KdsGateway);
//# sourceMappingURL=kds.gateway.js.map