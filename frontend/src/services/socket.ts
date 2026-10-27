import { io } from 'socket.io-client';
import { getServerUrl } from './serverConfig';
import { enqueueAction, getPendingActions, clearAction, getActionContext, sameContext, markActionError, markActionAttempt, actionResources, withQueueLease } from './offlineQueue';
import { InventoryBackendError, verifyInventoryBackend, verifyWasteBackend } from './inventoryBackend';
import { verifyAdminBackend } from './adminBackend';
import { initializeCatalogConfig, suspendCatalogConfig } from '../store/catalogConfig';
import { applyConfigSnapshot } from './configSnapshot';
import { normalizeWasteLog } from './inventoryData';
import { applyParkedSnapshot } from './parkedSnapshot';
import { useSettingsStore, applyRemoteSettings } from '../store/useSettingsStore';


// ─── Backend WebSocket Connection ─────────────────────────────────────────────
// URL is resolved at runtime: env var → localStorage Setup Screen → localhost:3001
export const socket = io(getServerUrl(), {
  transports: ['websocket', 'polling'],
  autoConnect: false, // Connect manually with auth details
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  extraHeaders: {
    'Bypass-Tunnel-Reminder': 'true'
  }
});

/**
 * Emit a bill settlement to the backend so it is persisted to SQLite.
 * This should be called from POSScreen and DeliveryDispatchScreen after every checkout.
 */
export function emitSettleBill(billData: {
  billNumber: string;
  orderNumber: string;
  orderType: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  discount: number;
  deliveryFee?: number;
  grandTotal: number;
  method?: string;
  paymentMethod?: string;
  tenders?: Record<string, number>;
  waiter?: string;
  customerName?: string;
  customerPhone?: string;
  items?: any[];
  tableId?: string | null;
  expectedOrderVersion?: string | null;
  stockAuthorization?: string;
}) {
  return emitAction('settle_bill', billData);
}


import { getOperatingMode } from './serverConfig';
import { toast } from '../store/useToastStore';
import { apiClient } from './apiClient';
import { applyLedgerSnapshot } from '../store/useLedgerStore';
import { assertCurrentSession } from './sessionGuard';

export function isCurrentSocketSession() {
  try {
    const session = assertCurrentSession(), auth = socket.auth as any;
    return !!session.accessToken && auth?.token === session.accessToken && auth?.restaurantId === session.currentUser?.restaurantId;
  } catch { return false; }
}
function onServer(event: string, listener: (...args: any[]) => void) {
  socket.on(event, (...args: any[]) => { if (isCurrentSocketSession()) listener(...args); });
}

export interface ActionResult { status: 'OK' | 'QUEUED' | 'ERROR'; data?: any; message?: string; reason?: string; stockChallenge?: string; shortages?: any[]; }
let flushing: Promise<Map<number, ActionResult>> | null = null;

export function flushPendingActions(): Promise<Map<number, ActionResult>> {
  if (flushing) return flushing;
  flushing = (async () => {
    const results = new Map<number, ActionResult>();
    let context;
    const blocked = new Set<string>();
    let inventoryCheck: Promise<void> | undefined;
    let adminCheck: Promise<void> | undefined;
    let wasteCheck: Promise<void> | undefined;
    try { context = getActionContext(); } catch { return results; }
    return withQueueLease(context, async ownsLease => {
    for (const action of await getPendingActions(context)) {
      const resources = actionResources(action.type, action.payload);
      if (action.error) { for (const resource of resources) blocked.add(resource); continue; }
      if (resources.some(resource => blocked.has(resource))) continue;
      if (!socket.connected || !sameContext(context, getActionContext()) || !await ownsLease()) break;
      if (typeof (socket.auth as any)?.token === 'string' && (socket.auth as any).token !== assertCurrentSession().accessToken) break;
      try {
        if (['sync_staff', 'sync_recipes', 'update_settings'].includes(action.type)) await (adminCheck ||= verifyAdminBackend());
        if (action.type === 'record_inventory_waste') await (wasteCheck ||= verifyWasteBackend());
        if (['receive_inventory_purchase', 'apply_inventory_changes'].includes(action.type)) {
          await (inventoryCheck ||= verifyInventoryBackend());
          if (!socket.connected || !sameContext(context, getActionContext())) break;
        }
        if (!socket.connected || !sameContext(context, getActionContext()) || !await ownsLease()) break;
        const payload = Array.isArray(action.payload) ? action.payload : { ...action.payload, actionId: action.payload?.actionId || action.actionId };
        const result: ActionResult = await socket.timeout(15000).emitWithAck(action.type, payload);
        if (!sameContext(context, getActionContext()) || !await ownsLease()) break;
        if (result?.status !== 'OK') {
          const message = result?.message || 'The server did not save this action';
          await markActionError(action.id!, message, { reason: result.reason, stockChallenge: result.stockChallenge, shortages: result.shortages });
          results.set(action.id!, { ...result, status: 'ERROR', message });
          toast.error(message);
          window.dispatchEvent(new CustomEvent('offline-action-error', { detail: { actionId: action.id, message } }));
          for (const resource of resources) blocked.add(resource);
          continue;
        }
        await clearAction(action.id!);
        results.set(action.id!, result);
      } catch (error) {
        if (!sameContext(context, getActionContext())) break;
        if (error instanceof InventoryBackendError) {
          await markActionError(action.id!, error.message);
          results.set(action.id!, { status: 'ERROR', message: error.message });
          toast.error(error.message);
        } else await markActionAttempt(action.id!, `No server confirmation received${error instanceof Error ? ` (${error.message})` : ''}. This action may already be saved on the server; retry its original entry instead of creating it again.`);
        // A lost acknowledgment can mean the write committed. Retain the stable action for an idempotent retry.
        for (const resource of resources) blocked.add(resource);
        continue;
      }
    }
    return results;
    }, results);
  })().catch(() => new Map<number, ActionResult>()).finally(() => { flushing = null; });
  return flushing;
}
socket.on('connect', () => { void flushPendingActions(); });

export async function syncPendingNow() {
  if (!socket.connected) throw new Error('Cannot sync: no connection to the restaurant server.');
  const context = getActionContext();
  const before = await getPendingActions(context);
  const results = await flushPendingActions();
  if (!sameContext(context, getActionContext())) throw new Error('The signed-in session changed during sync.');
  const remaining = await getPendingActions(context);
  return { confirmed: before.filter(action => results.get(action.id!)?.status === 'OK').length, pending: remaining.length, failed: remaining.filter(action => action.error).length };
}

// Every action is saved locally before it is sent, including actions created while online.
export async function emitAction(type: string, payload: any): Promise<ActionResult> {
  try {
    if (getOperatingMode() === 'ANDROID_MASTER') throw new Error('Tablet server mode is unavailable. Connect to the restaurant backend.');
    const context = getActionContext();
    const id = await enqueueAction(type, payload, context);
    if (!socket.connected) return { status: 'QUEUED' };
    const results = await flushPendingActions();
    if (results.has(id)) return results.get(id)!;
    // An action can be added while an earlier flush is running.
    if (socket.connected && sameContext(context, getActionContext())) {
      const next = await flushPendingActions();
      if (next.has(id)) return next.get(id)!;
    }
    return { status: 'QUEUED' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save action';
    window.dispatchEvent(new CustomEvent('offline-action-error', { detail: { message } }));
    return { status: 'ERROR', message };
  }
}
const queueRetry = setInterval(() => { if (socket.connected) void flushPendingActions(); }, 15000);
// Tablet clients use the same authenticated Socket.IO connection as desktop.
export function startMasterSyncPolling() {}
export function stopMasterSyncPolling() {}

socket.on('disconnect', () => {
  console.log('🔌 [POS] Disconnected from Backend WebSocket');
});

// We use dynamic imports to avoid circular dependencies with the stores
// These listeners are set up AFTER all modules have loaded

let listenersInitialized = false;
export function initSocketListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;
  socket.on('connect', () => {
    // Give stores a moment to load, then push local menu to server if the server is empty
    
  });

  // Lazy-load stores in parallel to avoid circular dep at module parse time
  Promise.all([
    import('../store/useKdsStore'),
    import('../store/useTableStore'),
    import('../store/cartStore'),
    import('../store/useDeliveryStore'),
    import('../store/useStaffStore'),
    import('../store/useInventoryStore'),
    import('../store/useMenuStore'),
  ]).then(([{ useKdsStore }, { useTableStore }, { useCartStore }, { useDeliveryStore }, { useStaffStore }, { useInventoryStore, applyInventorySnapshot }, { useMenuStore }]) => {

        // --- On connect: receive master state snapshot ---
        onServer('sync_master_state', (masterState: any) => {
          suspendCatalogConfig();
          if (masterState.ledgerEntries) applyLedgerSnapshot(masterState.ledgerEntries);
          if (masterState.menuRevision !== undefined) useMenuStore.setState({ serverRevision: masterState.menuRevision });
          console.log('📥 [POS] Received Master State from Server');

          if (masterState.settings) {
            void applyConfigSnapshot('update_settings', masterState.settings.serverRevision ?? 0, () => useSettingsStore.getState().serverRevision, () => { if (applyRemoteSettings(masterState.settings)) initializeCatalogConfig(); });
          }
          if (masterState.kdsTickets) {
            useKdsStore.setState({ tickets: masterState.kdsTickets });
          }

          if (masterState.parkedOrders) {
            void applyParkedSnapshot(masterState.parkedOrders, heldOrders => useCartStore.setState({ heldOrders }), masterState.parkedRevision);
          }

          if (masterState.deliveryOrders) {
            useDeliveryStore.setState({ orders: masterState.deliveryOrders });
          }

          if (masterState.staffMembers) {
            void applyConfigSnapshot('sync_staff', masterState.staffRevision ?? 0, () => useStaffStore.getState().serverRevision, () => useStaffStore.setState({ staff: masterState.staffMembers, serverRevision: masterState.staffRevision ?? 0 }));
          }

          if (masterState.inventoryStock) {
            applyInventorySnapshot(masterState.inventoryStock);
          }

          if (masterState.recipes) {
            void applyConfigSnapshot('sync_recipes', masterState.recipeRevision ?? 0, () => useInventoryStore.getState().recipeRevision, () => useInventoryStore.setState({ recipes: masterState.recipes, recipeRevision: masterState.recipeRevision ?? 0 }));
          }

          if (masterState.wasteLogs) {
            useInventoryStore.setState({ wasteLogs: masterState.wasteLogs.map(normalizeWasteLog) });
          }

          if (masterState.categories) {
            
            useMenuStore.setState({ categories: masterState.categories });
            
          }

          if (masterState.products) {
            
            useMenuStore.setState({ products: masterState.products.filter((product: any) => !product.isArchived) });
            
          }

          if (masterState.tables) {
            useTableStore.setState({ tables: masterState.tables });
          } else if (masterState.tableStatuses) {
            const currentTables = useTableStore.getState().tables;
            const updatedTables = currentTables.map(t => {
              const statusData = masterState.tableStatuses[t.id];
              if (statusData) {
                return { ...t, status: statusData.status, currentBill: statusData.subtotal };
              }
              return { ...t, status: 'AVAILABLE', currentBill: null };
            });
            useTableStore.setState({ tables: updatedTables });
          }
          initializeCatalogConfig();
        });

        
        // --- KDS Ticket created on another terminal ---
        onServer('kds_new_ticket', (ticket: any) => {
          const currentTickets = useKdsStore.getState().tickets;
          if (currentTickets.some(t => t.orderNumber === ticket.orderNumber)) {
            useKdsStore.setState({ tickets: [ticket, ...currentTickets.filter(t => t.orderNumber !== ticket.orderNumber)] });
          } else if (!currentTickets.find(t => t.id === ticket.id)) {
            console.log('🍳 [POS] New KDS Ticket from another terminal:', ticket.orderNumber);
            useKdsStore.setState({ tickets: [ticket, ...currentTickets] });
          }
        });

        // --- KDS Status updated on another terminal ---
        onServer('kds_status_changed', (payload: { orderId: string; status: 'COOKING' | 'READY' | 'SERVED' }) => {
          const currentTickets = useKdsStore.getState().tickets;
          console.log('🔔 [POS] KDS Status update from another terminal:', payload);
          useKdsStore.setState({
            tickets: currentTickets.map(t => t.id === payload.orderId ? { ...t, status: payload.status, pendingConfirmation: false } : t)
          });
        });

        // --- Table tickets cleared on another terminal ---
        onServer('table_tickets_cleared', (payload: { tableName: string }) => {
          const currentTickets = useKdsStore.getState().tickets;
          console.log('🧹 [POS] Table cleared from another terminal:', payload.tableName);
          useKdsStore.setState({
            tickets: currentTickets.filter(t => {
              return !(t.tableNumber === payload.tableName && t.status === 'SERVED');
            })
          });
        });

        onServer('kds_table_transferred', (payload: { fromTableName: string; toTableName: string }) => {
          useKdsStore.setState({ tickets: useKdsStore.getState().tickets.map(t => t.tableNumber === payload.fromTableName ? { ...t, tableNumber: payload.toTableName } : t) });
        });

        // --- Parked Orders updated on another terminal ---
        onServer('parked_orders_updated', (snapshot: any) => {
          const parkedOrders = Array.isArray(snapshot) ? snapshot : snapshot.orders;
          console.log('🛒 [POS] Parked orders updated from another terminal. Count:', parkedOrders.length);
          void applyParkedSnapshot(parkedOrders, heldOrders => useCartStore.setState({ heldOrders }), snapshot.revision);
        });

        // --- Table status updated on another terminal ---
        onServer('table_updated', (payload: { tableId: string; status: string; subtotal?: number; mergedWith?: string[]; mergedInto?: string | null }) => {
          const currentTables = useTableStore.getState().tables;
          console.log('🪑 [POS] Table status updated from another terminal:', payload.tableId, payload.status);
          useTableStore.setState({
            tables: currentTables.map(t => t.id === payload.tableId
              ? { 
                  ...t, 
                  status: payload.status as any, 
                  currentBill: payload.subtotal || t.currentBill,
                  mergedWith: payload.mergedWith !== undefined ? payload.mergedWith : t.mergedWith,
                  mergedInto: payload.mergedInto !== undefined ? (payload.mergedInto === null ? undefined : payload.mergedInto) : t.mergedInto
                }
              : t
            )
          });
        });

        // --- Delivery Orders updated on another terminal ---
        onServer('delivery_orders_updated', (deliveryOrders: any[]) => {
          console.log('🛵 [POS] Delivery orders updated from another terminal. Count:', deliveryOrders.length);
          useDeliveryStore.setState({ orders: deliveryOrders });
        });
        onServer('ledger_updated', applyLedgerSnapshot);

        // --- Staff Roster updated on another terminal ---
        onServer('staff_updated', (snapshot: any) => {
          const staffMembers = Array.isArray(snapshot) ? snapshot : snapshot.staff;
          console.log('👥 [POS] Staff roster updated from another terminal. Count:', staffMembers.length);
          void applyConfigSnapshot('sync_staff', snapshot.revision ?? 0, () => useStaffStore.getState().serverRevision, () => useStaffStore.setState({ staff: staffMembers, serverRevision: snapshot.revision ?? 0 }));
        });

        // --- Inventory updated on another terminal ---
        onServer('inventory_updated', (inventory: any[]) => {
          console.log('📦 [POS] Inventory stock updated from another terminal. Count:', inventory.length);
          applyInventorySnapshot(inventory);
        });

        // --- Recipes updated on another terminal ---
        onServer('recipes_updated', (snapshot: any) => {
          const recipes = Array.isArray(snapshot) ? snapshot : snapshot.recipes;
          console.log('🍳 [POS] Recipes updated from another terminal. Count:', recipes.length);
          void applyConfigSnapshot('sync_recipes', snapshot.revision ?? 0, () => useInventoryStore.getState().recipeRevision, () => useInventoryStore.setState({ recipes, recipeRevision: snapshot.revision ?? 0 }));
        });

        // --- Waste Logs updated on another terminal ---
        onServer('waste_updated', (wasteLogs: any[]) => {
          console.log('🗑️ [POS] Waste logs updated from another terminal. Count:', wasteLogs.length);
          useInventoryStore.setState({ wasteLogs: wasteLogs.map(normalizeWasteLog) });
        });

        // --- Settings updated on another terminal ---
        onServer('settings_updated', (settings: any) => {
          console.log('⚙️ [POS] Settings updated from another terminal.');
          // Use setState on the store to update immediately without firing the PUT loop
          void applyConfigSnapshot('update_settings', settings.serverRevision ?? 0, () => useSettingsStore.getState().serverRevision, () => { if (applyRemoteSettings(settings)) initializeCatalogConfig(); });
        });

        // --- Bill settled on this or another terminal ---
        onServer('bill_settled', (billData: any) => {
          // Bill is now safely stored in SQLite by the backend.
          // We do NOT append it to any localStorage array here to prevent
          // accumulation of 2+ years of historical data in browser storage.
          // Historical bills are always queried via GET /history/bills?date=...
          console.log(`✅ [POS] Bill ${billData.billNumber} acknowledged by backend DB.`);
        });

  });
}
