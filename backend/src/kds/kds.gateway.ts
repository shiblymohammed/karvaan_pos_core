import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allows local desktop, tablet PWA, and web app to connect simultaneously
  },
})
export class KdsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  // ─── In-Memory Hot Cache (for <50ms real-time broadcast performance) ───────────
  // This is NOT the source of truth — that's the SQLite database via Prisma.
  // This cache holds ACTIVE operational state only (orders in flight, tables).
  private activeTickets: any[] = [];
  private tableStatuses: Record<string, any> = {};

  async handleConnection(client: Socket) {
    console.log(`📡 [WebSocket] Terminal Connected: ${client.id}`);

    try {
      // ── Load active state from DATABASE (the real source of truth) ──────────

      // 1. Active KDS tickets: orders in RECEIVED, COOKING, READY state
      const activeOrders = await this.prisma.order.findMany({
        where: { status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
        include: {
          items: { include: { product: true } },
          table: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Safety cap — never load unbounded data into browser
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

      // Update hot cache
      this.activeTickets = kdsTickets;

      // 2. Parked orders: load from ParkedOrder table
      const parkedRaw = await this.prisma.parkedOrder.findMany({
        orderBy: { heldAt: 'desc' },
        take: 50,
      });
      const parkedOrders = parkedRaw.map((p) => {
        try { return JSON.parse(p.data); } catch { return null; }
      }).filter(Boolean);

      // 3. Delivery orders: ACTIVE only (not DELIVERED/CANCELLED) for current operational view
      const deliveryOrders = await this.prisma.deliveryOrder.findMany({
        where: { status: { in: ['RECEIVED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { rider: { select: { id: true, name: true, phone: true } } },
      });

      // 4. Staff members: ACTIVE only
      const staffMembers = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true, phone: true, isActive: true, permissions: true, pin: true },
      });

      // 5. Inventory items (current stock levels)
      const inventoryStock = await this.prisma.inventoryItem.findMany({
        orderBy: { name: 'asc' },
      });

      // 6. Table statuses
      const tables = await this.prisma.table.findMany();
      const tableStatusMap: Record<string, any> = {};
      for (const t of tables) {
        tableStatusMap[t.id] = { status: t.status, subtotal: null, tableId: t.id, tableNumber: t.tableNumber };
      }
      this.tableStatuses = tableStatusMap;

      // ── Send consolidated master state to this terminal ─────────────────────
      client.emit('sync_master_state', {
        kdsTickets,
        parkedOrders,
        deliveryOrders,
        staffMembers,
        inventoryStock,
        tableStatuses: tableStatusMap,
        recipes: [],   // Recipes managed by frontend inventory store
        wasteLogs: [], // Fetched on demand via /history/waste
      });

      console.log(`✅ [WebSocket] Synced DB state to terminal ${client.id}: ${activeOrders.length} tickets, ${deliveryOrders.length} deliveries, ${staffMembers.length} staff`);
    } catch (err) {
      console.error(`❌ [WebSocket] Error loading master state for ${client.id}: ${err.message}`);
      // Still emit an empty state so UI doesn't freeze
      client.emit('sync_master_state', {
        kdsTickets: [], parkedOrders: [], deliveryOrders: [],
        staffMembers: [], inventoryStock: [], tableStatuses: {}, recipes: [], wasteLogs: [],
      });
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 [WebSocket] Terminal Disconnected: ${client.id}`);
  }

  // ─── KDS TICKET PERSISTENCE ──────────────────────────────────────────────────

  @SubscribeMessage('fire_order')
  async handleFireOrder(@MessageBody() orderData: any, @ConnectedSocket() client: Socket) {
    console.log(`🍳 [KDS Gateway] Fired KOT Order #${orderData.orderNumber} to Kitchen.`);

    const newTicket = {
      ...orderData,
      firedAt: orderData.firedAt || new Date().toISOString(),
      slaThresholdMinutes: 12,
    };

    // ── Persist to database if this is a structured order ──────────────────
    try {
      if (orderData.items && Array.isArray(orderData.items)) {
        // Check if order already exists (avoid duplicate KOT on reconnect)
        const existing = await this.prisma.order.findUnique({
          where: { orderNumber: orderData.orderNumber },
        }).catch(() => null);

        if (!existing && orderData.orderType !== 'DELIVERY') {
          await this.prisma.order.create({
            data: {
              orderNumber: orderData.orderNumber,
              orderType: orderData.orderType || 'DINE_IN',
              status: 'RECEIVED',
              totalAmount: orderData.items.reduce(
                (sum: number, i: any) => sum + i.price * i.quantity, 0
              ),
              notes: orderData.notes || null,
              items: {
                create: orderData.items.map((i: any) => ({
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
    } catch (e) {
      console.warn('[KDS] Non-fatal persist error for fire_order:', e.message);
    }

    // ── Always update hot cache and broadcast ───────────────────────────────
    this.activeTickets.push(newTicket);
    this.server.emit('kds_new_ticket', newTicket);
    return { status: 'OK' };
  }

  @SubscribeMessage('update_kds_status')
  async handleStatusUpdate(@MessageBody() payload: { orderId: string; status: string; itemId?: string }) {
    console.log(`🔔 [KDS Gateway] Order ${payload.orderId} → ${payload.status}`);

    // Update hot cache
    const ticketIndex = this.activeTickets.findIndex((t) => t.id === payload.orderId);
    if (ticketIndex !== -1) {
      this.activeTickets[ticketIndex].status = payload.status;
    }

    // Persist status change to database
    try {
      await this.prisma.order.update({
        where: { id: payload.orderId },
        data: { status: payload.status },
      }).catch(() => {}); // Non-fatal if order ID is frontend-only
    } catch (_) {}

    this.server.emit('kds_status_changed', payload);
    return { status: 'OK' };
  }

  @SubscribeMessage('clear_table_tickets')
  async handleClearTableTickets(@MessageBody() payload: { tableName: string }) {
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

  // ─── PARKED ORDERS — PERSIST TO DATABASE ─────────────────────────────────────

  @SubscribeMessage('sync_parked_orders')
  async handleSyncParkedOrders(@MessageBody() orders: any[], @ConnectedSocket() client: Socket) {
    console.log(`🛒 [Parked Orders] Sync from terminal ${client.id}: ${orders?.length || 0} orders`);
    if (!Array.isArray(orders)) { return { status: 'OK' }; }

    try {
      // Upsert each parked order to DB
      for (const order of orders) {
        if (!order?.id) continue;
        await this.prisma.parkedOrder.upsert({
          where: { orderId: order.id },
          update: { data: JSON.stringify(order), updatedAt: new Date() },
          create: { orderId: order.id, data: JSON.stringify(order) },
        });
      }

      // Remove DB parked orders that are no longer in the list (resumed/cancelled)
      const activeIds = orders.map((o) => o.id).filter(Boolean);
      await this.prisma.parkedOrder.deleteMany({
        where: { orderId: { notIn: activeIds } },
      });
    } catch (e) {
      console.warn('[Parked] Persist error (non-fatal):', e.message);
    }

    this.server.emit('parked_orders_updated', orders);
    return { status: 'OK' };
  }

  // ─── TABLE STATUS — PERSIST TO DATABASE ─────────────────────────────────────

  @SubscribeMessage('table_status_change')
  async handleTableStatus(@MessageBody() payload: { tableId: string; status: string; subtotal?: number }) {
    console.log(`🪑 [Table Gateway] Table ${payload.tableId} → ${payload.status}`);

    this.tableStatuses[payload.tableId] = { status: payload.status, subtotal: payload.subtotal };

    try {
      await this.prisma.table.update({
        where: { id: payload.tableId },
        data: { status: payload.status },
      }).catch(() => {}); // Non-fatal if table ID is frontend-only
    } catch (_) {}

    this.server.emit('table_updated', payload);
    return { status: 'OK' };
  }

  // ─── DELIVERY ORDERS — PERSIST TO DATABASE ───────────────────────────────────

  @SubscribeMessage('sync_delivery_orders')
  async handleSyncDeliveryOrders(@MessageBody() orders: any[], @ConnectedSocket() client: Socket) {
    console.log(`🛵 [Delivery Gateway] Sync from ${client.id}: ${orders?.length || 0} orders`);
    if (!Array.isArray(orders)) { return { status: 'OK' }; }

    try {
      for (const order of orders) {
        if (!order?.id) continue;
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
    } catch (e) {
      console.warn('[Delivery] Persist error (non-fatal):', e.message);
    }

    this.server.emit('delivery_orders_updated', orders);
    return { status: 'OK' };
  }

  // ─── STAFF — PERSIST TO DATABASE ─────────────────────────────────────────────

  @SubscribeMessage('sync_staff')
  async handleSyncStaff(@MessageBody() staff: any[], @ConnectedSocket() client: Socket) {
    console.log(`👥 [Staff Gateway] Sync from ${client.id}: ${staff?.length || 0} members`);
    if (!Array.isArray(staff)) { return { status: 'OK' }; }

    try {
      for (const member of staff) {
        if (!member?.id || !member?.name || !member?.pin) continue;
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
    } catch (e) {
      console.warn('[Staff] Persist error (non-fatal):', e.message);
    }

    this.server.emit('staff_updated', staff);
    return { status: 'OK' };
  }

  // ─── INVENTORY — PERSIST TO DATABASE ─────────────────────────────────────────

  @SubscribeMessage('sync_inventory')
  async handleSyncInventory(@MessageBody() inventory: any[], @ConnectedSocket() client: Socket) {
    console.log(`📦 [Inventory Gateway] Sync from ${client.id}: ${inventory?.length || 0} items`);
    if (!Array.isArray(inventory)) { return { status: 'OK' }; }

    try {
      for (const item of inventory) {
        if (!item?.name) continue;
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
    } catch (e) {
      console.warn('[Inventory] Persist error (non-fatal):', e.message);
    }

    this.server.emit('inventory_updated', inventory);
    return { status: 'OK' };
  }

  // ─── RECIPES & WASTE — BROADCAST ONLY (managed by frontend store) ────────────

  @SubscribeMessage('sync_recipes')
  handleSyncRecipes(@MessageBody() recipes: any[]) {
    if (Array.isArray(recipes)) {
      this.server.emit('recipes_updated', recipes);
    }
    return { status: 'OK' };
  }

  @SubscribeMessage('sync_waste')
  async handleSyncWaste(@MessageBody() wasteLogs: any[], @ConnectedSocket() client: Socket) {
    console.log(`🗑️ [Waste Gateway] Sync from ${client.id}: ${wasteLogs?.length || 0} logs`);
    if (!Array.isArray(wasteLogs)) { return { status: 'OK' }; }

    // Persist new waste logs to database
    try {
      for (const log of wasteLogs) {
        if (!log?.itemName || !log?.reason) continue;
        // Upsert by a unique timestamp+name key to avoid duplicates
        const existing = await this.prisma.wasteLog.findFirst({
          where: {
            itemName: log.itemName,
            createdAt: { gte: new Date(Date.now() - 5000) } // Within last 5s = duplicate
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
    } catch (e) {
      console.warn('[Waste] Persist error (non-fatal):', e.message);
    }

    this.server.emit('waste_updated', wasteLogs);
    return { status: 'OK' };
  }

  // ─── BILL SETTLEMENT — PERSIST TO DATABASE ───────────────────────────────────

  @SubscribeMessage('settle_bill')
  async handleSettleBill(@MessageBody() billData: any) {
    console.log(`💳 [Gateway] Bill settled: ${billData.billNumber}`);

    try {
      // Ensure we have a parent Order record
      let orderId: string | undefined;
      const existing = await this.prisma.order.findUnique({
        where: { orderNumber: billData.orderNumber },
      }).catch(() => null);

      if (existing) {
        orderId = existing.id;
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'SERVED', discount: billData.discount || 0 },
        }).catch(() => {});
      }

      // Persist the Bill record
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

    } catch (e) {
      console.warn('[Bill] Persist error (non-fatal):', e.message);
    }

    this.server.emit('bill_settled', billData);
    return { status: 'OK' };
  }

  // Helper: create a minimal Order shell for bills fired directly from frontend (no prior DB order)
  private async getOrCreateOrderId(billData: any): Promise<string> {
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
}
