import { forwardRef, Inject } from '@nestjs/common';
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
import { BillingService } from '../billing/billing.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*', // Allows local desktop, tablet PWA, and web app to connect simultaneously
  },
})
export class KdsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── In-Memory Hot Cache (for <50ms real-time broadcast performance) ───────────
  // This is NOT the source of truth — that's the SQLite database via Prisma.
  // This cache holds ACTIVE operational state only (orders in flight, tables).
  private activeTickets: any[] = [];
  private tableStatuses: Record<string, any> = {};

  async handleConnection(client: Socket) {
    console.log(`📡 [WebSocket] Terminal Connected: ${client.id}`);
    
    const restaurantId = client.handshake.query.restaurantId as string;
    const token = client.handshake.query.token as string;
    client.join(restaurantId);
    
    if (!restaurantId || !token) {
      console.log(`📡 [WebSocket] Connection rejected: Missing restaurantId or token for ${client.id}`);
      client.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token);
    } catch (e) {
      console.log(`📡 [WebSocket] Connection rejected: Invalid token for ${client.id}`);
      client.disconnect();
      return;
    }

    try {
      // ── Load active state from DATABASE (the real source of truth) ──────────

      // 1. Active KDS tickets: orders in RECEIVED, COOKING, READY state
      const activeOrders = await this.prisma.order.findMany({
        where: { restaurantId, status: { in: ['RECEIVED', 'COOKING', 'READY'] } },
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
          subItems: i.addons ? JSON.parse(i.addons) : undefined,
        })),
      }));

      // Update hot cache
      this.activeTickets = kdsTickets;

      // 2. Parked orders: load from ParkedOrder table
      const parkedRaw = await this.prisma.parkedOrder.findMany({
        where: { restaurantId },
        orderBy: { heldAt: 'desc' },
        take: 50,
      });
      const parkedOrders = parkedRaw.map((p) => {
        try { return JSON.parse(p.data); } catch { return null; }
      }).filter(Boolean);

      // 3. Delivery orders: ACTIVE only (not DELIVERED/CANCELLED) for current operational view
      const deliveryOrders = await this.prisma.deliveryOrder.findMany({
        where: { restaurantId, status: { in: ['RECEIVED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { rider: { select: { id: true, name: true, phone: true } } },
      });

      // 4. Staff members: ACTIVE only
      const staffMembers = await this.prisma.user.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true, username: true, role: true, phone: true, isActive: true, permissions: true, pin: true },
      });

      // 5. Inventory items (current stock levels)
      const inventoryStock = await this.prisma.inventoryItem.findMany({
        where: { restaurantId },
        orderBy: { name: 'asc' },
      });

      // 6. Tables, Categories, and Products
      const tables = await this.prisma.table.findMany({ where: { restaurantId }, orderBy: { tableNumber: 'asc' } });
      const categories = await this.prisma.category.findMany({ where: { restaurantId }, orderBy: { sortOrder: 'asc' } });
      const rawProducts = await this.prisma.product.findMany({ where: { restaurantId }, orderBy: { name: 'asc' }, include: { category: true } });
      const products = rawProducts.map(p => ({ ...p, category: p.category?.name || 'All' }));

      const tableStatusMap: Record<string, any> = {};
      for (const t of tables) {
        tableStatusMap[t.id] = { status: t.status, subtotal: null, tableId: t.id, tableNumber: t.tableNumber };
      }
      this.tableStatuses = tableStatusMap;

      // 7. Recipes
      const rawRecipes = await this.prisma.recipeIngredient.findMany({
        where: { product: { restaurantId } }
      });
      const recipeMap = new Map<string, any>();
      for (const r of rawRecipes) {
        if (!recipeMap.has(r.productId)) {
          recipeMap.set(r.productId, { menuItemId: r.productId, ingredients: [] });
        }
        recipeMap.get(r.productId).ingredients.push({
          ingredientId: r.inventoryItemId,
          quantity: r.quantity
        });
      }
      const recipes = Array.from(recipeMap.values());

      // ── Send consolidated master state to this terminal ─────────────────────
      client.emit('sync_master_state', {
        kdsTickets,
        parkedOrders,
        deliveryOrders,
        staffMembers,
        inventoryStock,
        tableStatuses: tableStatusMap,
        tables,
        categories,
        products,
        recipes,
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
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'OK' };
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
        const existing = await this.prisma.order.findFirst({
          where: { restaurantId, orderNumber: orderData.orderNumber },
        }).catch(() => null);

        if (!existing && orderData.orderType !== 'DELIVERY') {
          await this.prisma.order.create({
            data: {
              restaurantId,
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
                  addons: i.subItems ? JSON.stringify(i.subItems) : null,
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
    this.server.to(restaurantId).emit('kds_new_ticket', newTicket);
    return { status: 'OK' };
  }

  @SubscribeMessage('update_kds_status')
  async handleStatusUpdate(@MessageBody() payload: { orderId: string; status: string; itemId?: string }, @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
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

    this.server.to(restaurantId).emit('kds_status_changed', payload);
    return { status: 'OK' };
  }

  @SubscribeMessage('clear_table_tickets')
  async handleClearTableTickets(@MessageBody() payload: { tableName: string }, @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`🧹 [KDS Gateway] Clearing KDS tickets for table: ${payload.tableName}`);

    this.activeTickets = this.activeTickets.filter((t) => {
      if (payload.tableName.includes('Takeaway') || payload.tableName === 'Walk-in') {
        return !(t.tableNumber === payload.tableName && t.status === 'SERVED');
      }
      return t.tableNumber !== payload.tableName;
    });

    this.server.to(restaurantId).emit('table_tickets_cleared', payload);
    return { status: 'OK' };
  }

  // ─── PARKED ORDERS — PERSIST TO DATABASE ─────────────────────────────────────

  @SubscribeMessage('sync_parked_orders')
  async handleSyncParkedOrders(@MessageBody() orders: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId || !Array.isArray(orders)) return { status: 'OK' };
    console.log(`🛒 [Parked Orders] Sync from terminal ${client.id}: ${orders.length} orders`);

    try {
      // Upsert each parked order to DB
      for (const order of orders) {
        if (!order?.id) continue;
        const existing = await this.prisma.parkedOrder.findUnique({ where: { orderId: order.id } }).catch(() => null);
        if (existing) {
          await this.prisma.parkedOrder.update({
            where: { id: existing.id },
            data: { data: JSON.stringify(order), updatedAt: new Date() }
          });
        } else {
          await this.prisma.parkedOrder.create({
            data: { orderId: order.id, restaurantId, data: JSON.stringify(order) }
          });
        }
      }

      // Remove DB parked orders that are no longer in the list (resumed/cancelled)
      const activeIds = orders.map((o) => o.id).filter(Boolean);
      await this.prisma.parkedOrder.deleteMany({
        where: { restaurantId, orderId: { notIn: activeIds } },
      });
    } catch (e) {
      console.warn('[Parked] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('parked_orders_updated', orders);
    return { status: 'OK' };
  }

  // ─── TABLE STATUS — PERSIST TO DATABASE ─────────────────────────────────────

  @SubscribeMessage('table_status_change')
  async handleTableStatus(@MessageBody() payload: { tableId: string; status: string; subtotal?: number; mergedWith?: string[]; mergedInto?: string | null }, @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`🪑 [Table Gateway] Table ${payload.tableId} → ${payload.status}`);

    this.tableStatuses[payload.tableId] = { status: payload.status, subtotal: payload.subtotal };

    try {
      await this.prisma.table.update({
        where: { id: payload.tableId },
        data: { status: payload.status },
      }).catch(() => {}); // Non-fatal if table ID is frontend-only
    } catch (_) {}

    this.server.to(restaurantId).emit('table_updated', payload);
    return { status: 'OK' };
  }

  // ─── DELIVERY ORDERS — PERSIST TO DATABASE ───────────────────────────────────

  @SubscribeMessage('sync_delivery_orders')
  async handleSyncDeliveryOrders(@MessageBody() orders: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId || !Array.isArray(orders)) return { status: 'OK' };
    console.log(`🛵 [Delivery Gateway] Sync from ${client.id}: ${orders.length} orders`);

    try {
      for (const order of orders) {
        if (!order?.id) continue;
        const existing = await this.prisma.deliveryOrder.findFirst({
          where: { restaurantId, orderNumber: order.orderNumber || order.id },
        }).catch(() => null);

        if (existing) {
          await this.prisma.deliveryOrder.update({
            where: { id: existing.id },
            data: {
              status: order.status,
              riderId: order.deliveryBoyId || null,
              riderName: order.deliveryBoyName || null,
              paymentStatus: order.paymentStatus || 'PENDING',
              paymentMethod: order.paymentMethod || 'CASH',
              collectedAmount: order.collectedAmount || null,
              deliveredAt: order.status === 'DELIVERED' ? new Date() : null,
              updatedAt: new Date(),
            }
          });
        } else {
          await this.prisma.deliveryOrder.create({
            data: {
              restaurantId,
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
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Delivery] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('delivery_orders_updated', orders);
    return { status: 'OK' };
  }

  // ─── STAFF — PERSIST TO DATABASE ─────────────────────────────────────────────

  @SubscribeMessage('sync_staff')
  async handleSyncStaff(@MessageBody() staff: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`👥 [Staff Gateway] Sync from ${client.id}: ${staff?.length || 0} members`);
    if (!Array.isArray(staff)) { return { status: 'OK' }; }

    try {
      for (const member of staff) {
        if (!member?.id || !member?.name || !member?.pin) continue;
        await this.prisma.user.upsert({
          where: { id: member.id },
          update: {
            name: member.name,
            username: member.username || null,
            password: member.password || null,
            role: member.role || 'CASHIER',
            phone: member.phone || null,
            isActive: member.isActive !== false,
            permissions: member.permissions ? JSON.stringify(member.permissions) : null,
          },
          create: {
            id: member.id,
            name: member.name,
            username: member.username || null,
            password: member.password || null,
            pin: member.pin,
            role: member.role || 'CASHIER',
            phone: member.phone || null,
            isActive: member.isActive !== false,
            permissions: member.permissions ? JSON.stringify(member.permissions) : null,
            restaurantId,
          },
        }).catch((e) => console.warn('[Staff] Upsert skip:', e.message));
      }
    } catch (e) {
      console.warn('[Staff] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('staff_updated', staff);
    return { status: 'OK' };
  }

  // ─── INVENTORY — PERSIST TO DATABASE ─────────────────────────────────────────

  @SubscribeMessage('sync_inventory')
  async handleSyncInventory(@MessageBody() inventory: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`📦 [Inventory Gateway] Sync from ${client.id}: ${inventory?.length || 0} items`);
    if (!Array.isArray(inventory)) { return { status: 'OK' }; }

    try {
      for (const item of inventory) {
        if (!item?.name) continue;
        await this.prisma.inventoryItem.upsert({
          where: { restaurantId_name: { restaurantId, name: item.name } },
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
            restaurantId,
          },
        }).catch((e) => console.warn('[Inventory] Upsert skip:', e.message));
      }
    } catch (e) {
      console.warn('[Inventory] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('inventory_updated', inventory);
    return { status: 'OK' };
  }

  // ─── RECIPES — PERSIST TO DATABASE ──────────────────────────────────────────

  @SubscribeMessage('sync_recipes')
  async handleSyncRecipes(@MessageBody() recipes: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId || !Array.isArray(recipes)) return { status: 'ERROR' };
    console.log(`📜 [Recipe Gateway] Sync from ${client.id}: ${recipes.length} recipes`);
    
    try {
      for (const recipe of recipes) {
        if (!recipe?.menuItemId || !Array.isArray(recipe.ingredients)) continue;
        const productId = recipe.menuItemId;
        
        const product = await this.prisma.product.findUnique({ where: { id: productId } }).catch(() => null);
        if (!product) continue;
        
        // Transaction: clear old ingredients, insert new ones
        await this.prisma.$transaction(async (tx) => {
          await tx.recipeIngredient.deleteMany({ where: { productId } });
          
          for (const item of recipe.ingredients) {
            if (!item.ingredientId) continue;
            
            const invItem = await tx.inventoryItem.findFirst({
              where: { 
                OR: [{ id: item.ingredientId }, { name: item.ingredientId }],
                restaurantId 
              }
            });
            
            if (invItem) {
              await tx.recipeIngredient.create({
                data: {
                  productId,
                  inventoryItemId: invItem.id,
                  quantity: item.quantity,
                  unit: invItem.unit || 'pcs'
                }
              });
            }
          }
        });
      }
    } catch(e) {
      console.warn('[Recipes] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('recipes_updated', recipes);
    return { status: 'OK' };
  }

  @SubscribeMessage('sync_menu')
  async handleSyncMenu(@MessageBody() payload: { products: any[], categories: any[] }, @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`🍔 [Menu Gateway] Sync from ${client.id}: ${payload.products?.length || 0} products`);

    try {
      if (payload.categories && Array.isArray(payload.categories)) {
        for (const cat of payload.categories) {
          if (!cat.id) continue;
          await this.prisma.category.upsert({
            where: { id: cat.id },
            update: { name: cat.name, sortOrder: cat.sortOrder, iconName: cat.iconName, imageUrl: cat.imageUrl },
            create: { id: cat.id, name: cat.name, sortOrder: cat.sortOrder, iconName: cat.iconName, imageUrl: cat.imageUrl, restaurantId }
          }).catch((e: any) => console.warn('[Menu] Cat upsert skip:', e.message));
        }
      }
      
      if (payload.products && Array.isArray(payload.products)) {
        for (const prod of payload.products) {
          if (!prod.id) continue;
          
          const cat = payload.categories?.find((c: any) => c.name === prod.category);
          let categoryId = cat ? cat.id : null;
          
          if (!categoryId) {
             const firstCat = await this.prisma.category.findFirst({ where: { restaurantId } });
             if (firstCat) categoryId = firstCat.id;
          }
          if (!categoryId) continue;

          await this.prisma.product.upsert({
            where: { id: prod.id },
            update: { name: prod.name, price: prod.price, categoryId, prepTimeMinutes: prod.prepTime, isAvailable: prod.isAvailable, description: prod.description, imageEmoji: prod.imageEmoji, imageUrl: prod.imageUrl, gstRate: prod.gstRate },
            create: { id: prod.id, name: prod.name, price: prod.price, categoryId, prepTimeMinutes: prod.prepTime, isAvailable: prod.isAvailable, description: prod.description, imageEmoji: prod.imageEmoji, imageUrl: prod.imageUrl, gstRate: prod.gstRate, restaurantId }
          }).catch((e: any) => console.warn('[Menu] Prod upsert skip:', e.message));
        }
      }
    } catch (e: any) {
      console.warn('[Menu] Persist error (non-fatal):', e.message);
    }
    
    // Broadcast back to all EXCEPT sender to prevent loop
    client.broadcast.to(restaurantId).emit('sync_master_state', { categories: payload.categories, products: payload.products });
    return { status: 'OK' };
  }

  @SubscribeMessage('sync_waste')
  async handleSyncWaste(@MessageBody() wasteLogs: any[], @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`🗑️ [Waste Gateway] Sync from ${client.id}: ${wasteLogs?.length || 0} logs`);
    if (!Array.isArray(wasteLogs)) { return { status: 'OK' }; }

    // Persist new waste logs to database
    try {
      for (const log of wasteLogs) {
        if (!log?.itemName || !log?.reason) continue;
        // Upsert by a unique timestamp+name key to avoid duplicates
        const existing = await this.prisma.wasteLog.findFirst({
          where: {
            restaurantId,
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
              restaurantId,
            },
          }).catch((e) => console.warn('[Waste] Create skip:', e.message));
        }
      }
    } catch (e) {
      console.warn('[Waste] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('waste_updated', wasteLogs);
    return { status: 'OK' };
  }

  // ─── BILL SETTLEMENT — PERSIST TO DATABASE ───────────────────────────────────

  @SubscribeMessage('settle_bill')
  async handleSettleBill(@MessageBody() billData: any, @ConnectedSocket() client: Socket) {
    const restaurantId = client.handshake.query.restaurantId as string;
    if (!restaurantId) return { status: 'ERROR' };
    console.log(`💳 [Gateway] Bill settled: ${billData.billNumber}`);

    try {
      // Use unified Billing Service path to guarantee ACID safety and inventory deduction
      await this.billingService.processDirectCheckout(billData, restaurantId);
    } catch (e) {
      console.warn('[Bill] Persist error (non-fatal):', e.message);
    }

    this.server.to(restaurantId).emit('bill_settled', billData);
    return { status: 'OK' };
  }

  // Helper: create a minimal Order shell for bills fired directly from frontend (no prior DB order)
  private async getOrCreateOrderId(billData: any, restaurantId: string): Promise<string> {
    const orderNumber = billData.orderNumber || `KORD-${Date.now()}`;
    const order = await this.prisma.order.upsert({
      where: { restaurantId_orderNumber: { restaurantId, orderNumber } },
      update: { status: 'SERVED' },
      create: {
        orderNumber,
        orderType: billData.orderType || 'DINE_IN',
        status: 'SERVED',
        totalAmount: billData.subtotal || 0,
        discount: billData.discount || 0,
        restaurantId,
      },
    });
    return order.id;
  }
}
