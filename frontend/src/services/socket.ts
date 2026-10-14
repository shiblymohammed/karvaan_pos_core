import { io } from 'socket.io-client';
import { getServerUrl } from './serverConfig';
import { enqueueAction, getPendingActions, clearAction, getActionContext, sameContext, markActionError, markActionAttempt, actionResources } from './offlineQueue';
import { InventoryBackendError, verifyInventoryBackend } from './inventoryBackend';
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
}) {
  return emitAction('settle_bill', billData);
}


import { getOperatingMode } from './serverConfig';
import { toast } from '../store/useToastStore';
import { apiClient } from './apiClient';
import { applyLedgerSnapshot } from '../store/useLedgerStore';

export interface ActionResult { status: 'OK' | 'QUEUED' | 'ERROR'; data?: any; message?: string; }
let flushing: Promise<Map<number, ActionResult>> | null = null;

export function flushPendingActions(): Promise<Map<number, ActionResult>> {
  if (flushing) return flushing;
  flushing = (async () => {
    const results = new Map<number, ActionResult>();
    let context;
    const blocked = new Set<string>();
    let inventoryCheck: Promise<void> | undefined;
    try { context = getActionContext(); } catch { return results; }
    for (const action of await getPendingActions(context)) {
      const resources = actionResources(action.type, action.payload);
      if (action.error) { for (const resource of resources) blocked.add(resource); continue; }
      if (resources.some(resource => blocked.has(resource))) continue;
      if (!socket.connected || !sameContext(context, getActionContext())) break;
      try {
        if (['receive_inventory_purchase', 'apply_inventory_changes'].includes(action.type)) {
          await (inventoryCheck ||= verifyInventoryBackend());
          if (!socket.connected || !sameContext(context, getActionContext())) break;
        }
        const payload = Array.isArray(action.payload) ? action.payload : { ...action.payload, actionId: action.payload?.actionId || action.actionId };
        const result: ActionResult = await socket.timeout(15000).emitWithAck(action.type, payload);
        if (!sameContext(context, getActionContext())) break;
        if (result?.status !== 'OK') {
          const message = result?.message || 'The server did not save this action';
          await markActionError(action.id!, message);
          results.set(action.id!, { status: 'ERROR', message });
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

  // Lazy-load stores to avoid circular dep at module parse time
  import('../store/useKdsStore').then(({ useKdsStore }) => {
    import('../store/useTableStore').then(({ useTableStore }) => {
      import('../store/cartStore').then(({ useCartStore }) => {
        import('../store/useDeliveryStore').then(({ useDeliveryStore }) => {
          import('../store/useStaffStore').then(({ useStaffStore }) => {
                import('../store/useInventoryStore').then(({ useInventoryStore, applyInventorySnapshot }) => {
              import('../store/useMenuStore').then(({ useMenuStore }) => {

        // --- On connect: receive master state snapshot ---
        socket.on('sync_master_state', (masterState: any) => {
          if (masterState.ledgerEntries) applyLedgerSnapshot(masterState.ledgerEntries);
          if (masterState.menuRevision !== undefined) useMenuStore.setState({ serverRevision: masterState.menuRevision });
          console.log('📥 [POS] Received Master State from Server');

          if (masterState.settings) {
            applyRemoteSettings(masterState.settings);
            if (masterState.settings.paidAddons) void import('../store/useAddonStore').then(({ useAddonStore }) => useAddonStore.setState({ addons: masterState.settings.paidAddons }));
            if (masterState.settings.floorConfig) useTableStore.setState({ floors: masterState.settings.floorConfig });
          }
          if (masterState.kdsTickets) {
            useKdsStore.setState({ tickets: masterState.kdsTickets });
          }

          if (masterState.parkedOrders) {
            useCartStore.setState({ heldOrders: masterState.parkedOrders });
          }

          if (masterState.deliveryOrders) {
            useDeliveryStore.setState({ orders: masterState.deliveryOrders });
          }

          if (masterState.staffMembers) {
            useStaffStore.setState({ staff: masterState.staffMembers });
          }

          if (masterState.inventoryStock) {
            applyInventorySnapshot(masterState.inventoryStock);
          }

          if (masterState.recipes) {
            useInventoryStore.setState({ recipes: masterState.recipes });
          }

          if (masterState.wasteLogs) {
            useInventoryStore.setState({ wasteLogs: masterState.wasteLogs });
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
        });

        
        // --- KDS Ticket created on another terminal ---
        socket.on('kds_new_ticket', (ticket: any) => {
          const currentTickets = useKdsStore.getState().tickets;
          if (currentTickets.some(t => t.orderNumber === ticket.orderNumber)) {
            useKdsStore.setState({ tickets: [ticket, ...currentTickets.filter(t => t.orderNumber !== ticket.orderNumber)] });
          } else if (!currentTickets.find(t => t.id === ticket.id)) {
            console.log('🍳 [POS] New KDS Ticket from another terminal:', ticket.orderNumber);
            useKdsStore.setState({ tickets: [ticket, ...currentTickets] });
          }
        });

        // --- KDS Status updated on another terminal ---
        socket.on('kds_status_changed', (payload: { orderId: string; status: 'COOKING' | 'READY' | 'SERVED' }) => {
          const currentTickets = useKdsStore.getState().tickets;
          console.log('🔔 [POS] KDS Status update from another terminal:', payload);
          useKdsStore.setState({
            tickets: currentTickets.map(t => t.id === payload.orderId ? { ...t, status: payload.status } : t)
          });
        });

        // --- Table tickets cleared on another terminal ---
        socket.on('table_tickets_cleared', (payload: { tableName: string }) => {
          const currentTickets = useKdsStore.getState().tickets;
          console.log('🧹 [POS] Table cleared from another terminal:', payload.tableName);
          useKdsStore.setState({
            tickets: currentTickets.filter(t => {
              return !(t.tableNumber === payload.tableName && t.status === 'SERVED');
            })
          });
        });

        socket.on('kds_table_transferred', (payload: { fromTableName: string; toTableName: string }) => {
          useKdsStore.setState({ tickets: useKdsStore.getState().tickets.map(t => t.tableNumber === payload.fromTableName ? { ...t, tableNumber: payload.toTableName } : t) });
        });

        // --- Parked Orders updated on another terminal ---
        socket.on('parked_orders_updated', (parkedOrders: any[]) => {
          console.log('🛒 [POS] Parked orders updated from another terminal. Count:', parkedOrders.length);
          useCartStore.setState({ heldOrders: parkedOrders });
        });

        // --- Table status updated on another terminal ---
        socket.on('table_updated', (payload: { tableId: string; status: string; subtotal?: number; mergedWith?: string[]; mergedInto?: string | null }) => {
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
        socket.on('delivery_orders_updated', (deliveryOrders: any[]) => {
          console.log('🛵 [POS] Delivery orders updated from another terminal. Count:', deliveryOrders.length);
          useDeliveryStore.setState({ orders: deliveryOrders });
        });
        socket.on('ledger_updated', applyLedgerSnapshot);

        // --- Staff Roster updated on another terminal ---
        socket.on('staff_updated', (staffMembers: any[]) => {
          console.log('👥 [POS] Staff roster updated from another terminal. Count:', staffMembers.length);
          useStaffStore.setState({ staff: staffMembers });
        });

        // --- Inventory updated on another terminal ---
        socket.on('inventory_updated', (inventory: any[]) => {
          console.log('📦 [POS] Inventory stock updated from another terminal. Count:', inventory.length);
          applyInventorySnapshot(inventory);
        });

        // --- Recipes updated on another terminal ---
        socket.on('recipes_updated', (recipes: any[]) => {
          console.log('🍳 [POS] Recipes updated from another terminal. Count:', recipes.length);
          useInventoryStore.setState({ recipes });
        });

        // --- Waste Logs updated on another terminal ---
        socket.on('waste_updated', (wasteLogs: any[]) => {
          console.log('🗑️ [POS] Waste logs updated from another terminal. Count:', wasteLogs.length);
          useInventoryStore.setState({ wasteLogs });
        });

        // --- Settings updated on another terminal ---
        socket.on('settings_updated', (settings: any) => {
          console.log('⚙️ [POS] Settings updated from another terminal.');
          // Use setState on the store to update immediately without firing the PUT loop
          applyRemoteSettings(settings);
        });

        // --- Bill settled on this or another terminal ---
        socket.on('bill_settled', (billData: any) => {
          // Bill is now safely stored in SQLite by the backend.
          // We do NOT append it to any localStorage array here to prevent
          // accumulation of 2+ years of historical data in browser storage.
          // Historical bills are always queried via GET /history/bills?date=...
          console.log(`✅ [POS] Bill ${billData.billNumber} acknowledged by backend DB.`);
        });

              });
            });
          });
        });
      });
    });
  });
}
