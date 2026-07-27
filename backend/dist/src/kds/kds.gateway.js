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
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../prisma/prisma.service");
let KdsGateway = class KdsGateway {
    constructor(prisma) {
        this.prisma = prisma;
        this.activeTickets = [];
        this.tableStatuses = {};
    }
    async handleConnection(client) {
        console.log(`📡 [WebSocket] Terminal Connected: ${client.id}`);
        try {
            const activeOrders = await this.prisma.order.findMany({
                where: { status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
                include: {
                    items: { include: { product: true } },
                    table: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });
            const kdsTickets = activeOrders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                tableNumber: o.table?.tableNumber || 'Takeaway',
                status: o.status,
                firedAt: o.createdAt,
                slaThresholdMinutes: 12,
                items: o.items.map((i) => ({
                    id: i.id,
                    name: i.product.name,
                    quantity: i.quantity,
                    notes: i.notes,
                    status: i.status,
                })),
            }));
            this.activeTickets = kdsTickets;
            const parkedRaw = await this.prisma.parkedOrder.findMany({
                orderBy: { heldAt: 'desc' },
                take: 50,
            });
            const parkedOrders = parkedRaw.map((p) => {
                try {
                    return JSON.parse(p.data);
                }
                catch {
                    return null;
                }
            }).filter(Boolean);
            const deliveryOrders = await this.prisma.deliveryOrder.findMany({
                where: { status: { in: ['RECEIVED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } },
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: { rider: { select: { id: true, name: true, phone: true } } },
            });
            const staffMembers = await this.prisma.user.findMany({
                where: { isActive: true },
                select: { id: true, name: true, role: true, phone: true, isActive: true, permissions: true, pin: true },
            });
            const inventoryStock = await this.prisma.inventoryItem.findMany({
                orderBy: { name: 'asc' },
            });
            const tables = await this.prisma.table.findMany();
            const tableStatusMap = {};
            for (const t of tables) {
                tableStatusMap[t.id] = { status: t.status, subtotal: null, tableId: t.id, tableNumber: t.tableNumber };
            }
            this.tableStatuses = tableStatusMap;
            client.emit('sync_master_state', {
                kdsTickets,
                parkedOrders,
                deliveryOrders,
                staffMembers,
                inventoryStock,
                tableStatuses: tableStatusMap,
                recipes: [],
                wasteLogs: [],
            });
            console.log(`✅ [WebSocket] Synced DB state to terminal ${client.id}: ${activeOrders.length} tickets, ${deliveryOrders.length} deliveries, ${staffMembers.length} staff`);
        }
        catch (err) {
            console.error(`❌ [WebSocket] Error loading master state for ${client.id}: ${err.message}`);
            client.emit('sync_master_state', {
                kdsTickets: [], parkedOrders: [], deliveryOrders: [],
                staffMembers: [], inventoryStock: [], tableStatuses: {}, recipes: [], wasteLogs: [],
            });
        }
    }
    handleDisconnect(client) {
        console.log(`🔌 [WebSocket] Terminal Disconnected: ${client.id}`);
    }
    async handleFireOrder(orderData, client) {
        console.log(`🍳 [KDS Gateway] Fired KOT Order #${orderData.orderNumber} to Kitchen.`);
        const newTicket = {
            ...orderData,
            firedAt: orderData.firedAt || new Date().toISOString(),
            slaThresholdMinutes: 12,
        };
        try {
            if (orderData.items && Array.isArray(orderData.items)) {
                const existing = await this.prisma.order.findUnique({
                    where: { orderNumber: orderData.orderNumber },
                }).catch(() => null);
                if (!existing && orderData.orderType !== 'DELIVERY') {
                    await this.prisma.order.create({
                        data: {
                            orderNumber: orderData.orderNumber,
                            orderType: orderData.orderType || 'DINE_IN',
                            status: 'RECEIVED',
                            totalAmount: orderData.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
                            notes: orderData.notes || null,
                            items: {
                                create: orderData.items.map((i) => ({
                                    productId: i.productId || 'unknown',
                                    quantity: i.quantity,
                                    price: i.price,
                                    notes: i.notes || null,
                                    status: 'SENT',
                                })),
                            },
                        },
                    }).catch((e) => console.warn('[KDS] Order persist skipped (no product FK):', e.message));
                }
            }
        }
        catch (e) {
            console.warn('[KDS] Non-fatal persist error for fire_order:', e.message);
        }
        this.activeTickets.push(newTicket);
        this.server.emit('kds_new_ticket', newTicket);
        return { status: 'OK' };
    }
    async handleStatusUpdate(payload) {
        console.log(`🔔 [KDS Gateway] Order ${payload.orderId} → ${payload.status}`);
        const ticketIndex = this.activeTickets.findIndex((t) => t.id === payload.orderId);
        if (ticketIndex !== -1) {
            this.activeTickets[ticketIndex].status = payload.status;
        }
        try {
            await this.prisma.order.update({
                where: { id: payload.orderId },
                data: { status: payload.status },
            }).catch(() => { });
        }
        catch (_) { }
        this.server.emit('kds_status_changed', payload);
        return { status: 'OK' };
    }
    async handleClearTableTickets(payload) {
        console.log(`🧹 [KDS Gateway] Clearing KDS tickets for table: ${payload.tableName}`);
        this.activeTickets = this.activeTickets.filter((t) => {
            if (payload.tableName.includes('Takeaway') || payload.tableName === 'Walk-in') {
                return !(t.tableNumber === payload.tableName && t.status === 'SERVED');
            }
            return t.tableNumber !== payload.tableName;
        });
        this.server.emit('table_tickets_cleared', payload);
        return { status: 'OK' };
    }
    async handleSyncParkedOrders(orders, client) {
        console.log(`🛒 [Parked Orders] Sync from terminal ${client.id}: ${orders?.length || 0} orders`);
        if (!Array.isArray(orders)) {
            return { status: 'OK' };
        }
        try {
            for (const order of orders) {
                if (!order?.id)
                    continue;
                await this.prisma.parkedOrder.upsert({
                    where: { orderId: order.id },
                    update: { data: JSON.stringify(order), updatedAt: new Date() },
                    create: { orderId: order.id, data: JSON.stringify(order) },
                });
            }
            const activeIds = orders.map((o) => o.id).filter(Boolean);
            await this.prisma.parkedOrder.deleteMany({
                where: { orderId: { notIn: activeIds } },
            });
        }
        catch (e) {
            console.warn('[Parked] Persist error (non-fatal):', e.message);
        }
        this.server.emit('parked_orders_updated', orders);
        return { status: 'OK' };
    }
    async handleTableStatus(payload) {
        console.log(`🪑 [Table Gateway] Table ${payload.tableId} → ${payload.status}`);
        this.tableStatuses[payload.tableId] = { status: payload.status, subtotal: payload.subtotal };
        try {
            await this.prisma.table.update({
                where: { id: payload.tableId },
                data: { status: payload.status },
            }).catch(() => { });
        }
        catch (_) { }
        this.server.emit('table_updated', payload);
        return { status: 'OK' };
    }
    async handleSyncDeliveryOrders(orders, client) {
        console.log(`🛵 [Delivery Gateway] Sync from ${client.id}: ${orders?.length || 0} orders`);
        if (!Array.isArray(orders)) {
            return { status: 'OK' };
        }
        try {
            for (const order of orders) {
                if (!order?.id)
                    continue;
                await this.prisma.deliveryOrder.upsert({
                    where: { orderNumber: order.orderNumber || order.id },
                    update: {
                        status: order.status,
                        riderId: order.deliveryBoyId || null,
                        riderName: order.deliveryBoyName || null,
                        paymentStatus: order.paymentStatus || 'PENDING',
                        paymentMethod: order.paymentMethod || 'CASH',
                        collectedAmount: order.collectedAmount || null,
                        deliveredAt: order.status === 'DELIVERED' ? new Date() : null,
                        updatedAt: new Date(),
                    },
                    create: {
                        orderNumber: order.orderNumber || order.id,
                        customerName: order.customerName || 'Customer',
                        customerPhone: order.customerPhone || null,
                        deliveryAddress: order.deliveryAddress || null,
                        riderId: order.deliveryBoyId || null,
                        riderName: order.deliveryBoyName || null,
                        status: order.status || 'RECEIVED',
                        paymentMethod: order.paymentMethod || 'CASH',
                        paymentStatus: order.paymentStatus || 'PENDING',
                        grandTotal: order.grandTotal || 0,
                        deliveryFee: order.deliveryFee || 0,
                        items: JSON.stringify(order.items || []),
                        notes: order.notes || null,
                    },
                }).catch((e) => console.warn('[Delivery] Upsert skip:', e.message));
            }
        }
        catch (e) {
            console.warn('[Delivery] Persist error (non-fatal):', e.message);
        }
        this.server.emit('delivery_orders_updated', orders);
        return { status: 'OK' };
    }
    async handleSyncStaff(staff, client) {
        console.log(`👥 [Staff Gateway] Sync from ${client.id}: ${staff?.length || 0} members`);
        if (!Array.isArray(staff)) {
            return { status: 'OK' };
        }
        try {
            for (const member of staff) {
                if (!member?.id || !member?.name || !member?.pin)
                    continue;
                await this.prisma.user.upsert({
                    where: { pin: member.pin },
                    update: {
                        name: member.name,
                        role: member.role || 'CASHIER',
                        phone: member.phone || null,
                        isActive: member.isActive !== false,
                        permissions: member.permissions ? JSON.stringify(member.permissions) : null,
                    },
                    create: {
                        id: member.id,
                        name: member.name,
                        pin: member.pin,
                        role: member.role || 'CASHIER',
                        phone: member.phone || null,
                        isActive: member.isActive !== false,
                        permissions: member.permissions ? JSON.stringify(member.permissions) : null,
                    },
                }).catch((e) => console.warn('[Staff] Upsert skip (duplicate PIN?):', e.message));
            }
        }
        catch (e) {
            console.warn('[Staff] Persist error (non-fatal):', e.message);
        }
        this.server.emit('staff_updated', staff);
        return { status: 'OK' };
    }
    async handleSyncInventory(inventory, client) {
        console.log(`📦 [Inventory Gateway] Sync from ${client.id}: ${inventory?.length || 0} items`);
        if (!Array.isArray(inventory)) {
            return { status: 'OK' };
        }
        try {
            for (const item of inventory) {
                if (!item?.name)
                    continue;
                await this.prisma.inventoryItem.upsert({
                    where: { name: item.name },
                    update: {
                        currentStock: item.currentStock ?? item.currentQty ?? 0,
                        category: item.category || 'General',
                        unit: item.unit || 'pcs',
                        minThreshold: item.minThreshold || item.minLevel || 5,
                        costPrice: item.costPrice || 0,
                    },
                    create: {
                        name: item.name,
                        category: item.category || 'General',
                        currentStock: item.currentStock ?? item.currentQty ?? 0,
                        unit: item.unit || 'pcs',
                        minThreshold: item.minThreshold || item.minLevel || 5,
                        costPrice: item.costPrice || 0,
                    },
                }).catch((e) => console.warn('[Inventory] Upsert skip:', e.message));
            }
        }
        catch (e) {
            console.warn('[Inventory] Persist error (non-fatal):', e.message);
        }
        this.server.emit('inventory_updated', inventory);
        return { status: 'OK' };
    }
    handleSyncRecipes(recipes) {
        if (Array.isArray(recipes)) {
            this.server.emit('recipes_updated', recipes);
        }
        return { status: 'OK' };
    }
    async handleSyncWaste(wasteLogs, client) {
        console.log(`🗑️ [Waste Gateway] Sync from ${client.id}: ${wasteLogs?.length || 0} logs`);
        if (!Array.isArray(wasteLogs)) {
            return { status: 'OK' };
        }
        try {
            for (const log of wasteLogs) {
                if (!log?.itemName || !log?.reason)
                    continue;
                const existing = await this.prisma.wasteLog.findFirst({
                    where: {
                        itemName: log.itemName,
                        createdAt: { gte: new Date(Date.now() - 5000) }
                    },
                }).catch(() => null);
                if (!existing) {
                    await this.prisma.wasteLog.create({
                        data: {
                            itemName: log.itemName,
                            quantity: log.quantity || 1,
                            unit: log.unit || 'pcs',
                            reason: log.reason,
                            orderId: log.orderId || null,
                            billNumber: log.billNumber || null,
                            loggedBy: log.loggedBy || null,
                        },
                    }).catch((e) => console.warn('[Waste] Create skip:', e.message));
                }
            }
        }
        catch (e) {
            console.warn('[Waste] Persist error (non-fatal):', e.message);
        }
        this.server.emit('waste_updated', wasteLogs);
        return { status: 'OK' };
    }
    async handleSettleBill(billData) {
        console.log(`💳 [Gateway] Bill settled: ${billData.billNumber}`);
        try {
            let orderId;
            const existing = await this.prisma.order.findUnique({
                where: { orderNumber: billData.orderNumber },
            }).catch(() => null);
            if (existing) {
                orderId = existing.id;
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'SERVED', discount: billData.discount || 0 },
                }).catch(() => { });
            }
            await this.prisma.bill.upsert({
                where: { billNumber: billData.billNumber },
                update: {},
                create: {
                    billNumber: billData.billNumber,
                    orderId: orderId || await this.getOrCreateOrderId(billData),
                    orderType: billData.orderType || 'DINE_IN',
                    subtotal: billData.subtotal || 0,
                    cgst: billData.cgst || 0,
                    sgst: billData.sgst || 0,
                    discount: billData.discount || 0,
                    deliveryFee: billData.deliveryFee || 0,
                    grandTotal: billData.grandTotal || 0,
                    paymentMethod: billData.method || billData.paymentMethod || 'CASH',
                    customerName: billData.customerName || null,
                    customerPhone: billData.customerPhone || null,
                    waiterName: billData.waiter || null,
                    settledAt: new Date(),
                },
            }).catch((e) => console.warn('[Bill] Persist skip:', e.message));
        }
        catch (e) {
            console.warn('[Bill] Persist error (non-fatal):', e.message);
        }
        this.server.emit('bill_settled', billData);
        return { status: 'OK' };
    }
    async getOrCreateOrderId(billData) {
        const orderNumber = billData.orderNumber || `KORD-${Date.now()}`;
        const order = await this.prisma.order.upsert({
            where: { orderNumber },
            update: { status: 'SERVED' },
            create: {
                orderNumber,
                orderType: billData.orderType || 'DINE_IN',
                status: 'SERVED',
                totalAmount: billData.subtotal || 0,
                discount: billData.discount || 0,
            },
        });
        return order.id;
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
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleFireOrder", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update_kds_status'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleStatusUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('clear_table_tickets'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleClearTableTickets", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_parked_orders'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSyncParkedOrders", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('table_status_change'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleTableStatus", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_delivery_orders'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSyncDeliveryOrders", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_staff'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSyncStaff", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_inventory'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSyncInventory", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_recipes'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], KdsGateway.prototype, "handleSyncRecipes", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sync_waste'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSyncWaste", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('settle_bill'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KdsGateway.prototype, "handleSettleBill", null);
exports.KdsGateway = KdsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KdsGateway);
//# sourceMappingURL=kds.gateway.js.map