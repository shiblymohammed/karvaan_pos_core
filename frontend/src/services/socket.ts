import { io } from 'socket.io-client';
import { getServerUrl } from './serverConfig';
import { enqueueAction, getPendingActions, clearAction } from './offlineQueue';


// ─── Backend WebSocket Connection ─────────────────────────────────────────────
// URL is resolved at runtime: env var → localStorage Setup Screen → localhost:3001
export const socket = io(getServerUrl(), {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: Infinity, // Reconnect indefinitely for long-running restaurant shifts
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
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
  waiter?: string;
  customerName?: string;
  customerPhone?: string;
  items?: any[];
}) {
  emitAction('settle_bill', billData);
  console.log(`💾 [POS] Bill ${billData.billNumber} emitted for persistence via emitAction.`);
}


import { getOperatingMode } from './serverConfig';
import { apiClient } from './apiClient';

socket.on('connect', async () => {
  console.log('📡 [POS] Connected to Backend WebSocket:', socket.id);
  
  // 1. Flush offline queue first
  const pendingActions = await getPendingActions();
  if (pendingActions.length > 0) {
    console.log(`🚀 [POS] Flushing ${pendingActions.length} pending actions from offline queue...`);
    for (const action of pendingActions) {
      emitAction(action.type, action.payload);
      if (action.id) await clearAction(action.id);
    }
  }
});

/**
 * Universal emitter for actions.
 * If NODE_SERVER: Uses WebSocket.
 * If WAITER_CLIENT: Uses HTTP POST to the Android Master's local server.
 * If ANDROID_MASTER: Directly executes locally (handled internally by apiClient).
 */
export function emitAction(type: string, payload: any) {
  const mode = getOperatingMode();
  
  if (mode === 'NODE_SERVER') {
    if (socket.connected) {
      socket.emit(type, payload);
    } else {
      enqueueAction(type, payload);
    }
  } else {
    // WAITER_CLIENT or ANDROID_MASTER
    apiClient.post('/api/action', { type, payload })
      .catch(err => {
        console.warn(`[Client] Failed to send action ${type} to master:`, err);
        enqueueAction(type, payload);
      });
  }
}

// ─── Master Sync Polling (For Waiter Client Mode) ───────────────────────────
let syncInterval: any = null;

export function startMasterSyncPolling() {
  if (getOperatingMode() !== 'WAITER_CLIENT') return;
  if (syncInterval) return;

  console.log('🔄 [Waiter Client] Starting short-polling to Android Master...');
  syncInterval = setInterval(async () => {
    try {
      const state = await apiClient.get('/api/sync');
      if (state && state.success) {
        // We will dispatch a local socket event to reuse the existing socket.on listeners
        (socket as any)._callbacks['$sync_master_state']?.forEach((cb: any) => cb(state.data));
      }
    } catch (err) {
      // Silently fail, tablet might be asleep
    }
  }, 3000);
}

export function stopMasterSyncPolling() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

socket.on('disconnect', () => {
  console.log('🔌 [POS] Disconnected from Backend WebSocket');
});

// We use dynamic imports to avoid circular dependencies with the stores
// These listeners are set up AFTER all modules have loaded

export function initSocketListeners() {
  // Lazy-load stores to avoid circular dep at module parse time
  import('../store/useKdsStore').then(({ useKdsStore }) => {
    import('../store/useTableStore').then(({ useTableStore }) => {
      import('../store/cartStore').then(({ useCartStore }) => {
        import('../store/useDeliveryStore').then(({ useDeliveryStore }) => {
          import('../store/useStaffStore').then(({ useStaffStore }) => {
            import('../store/useInventoryStore').then(({ useInventoryStore }) => {

        // --- On connect: receive master state snapshot ---
        socket.on('sync_master_state', (masterState: any) => {
          console.log('📥 [POS] Received Master State from Server');

          if (masterState.kdsTickets && masterState.kdsTickets.length > 0) {
            useKdsStore.setState({ tickets: masterState.kdsTickets });
          }

          if (masterState.parkedOrders && masterState.parkedOrders.length > 0) {
            useCartStore.setState({ heldOrders: masterState.parkedOrders });
          }

          if (masterState.deliveryOrders && masterState.deliveryOrders.length > 0) {
            useDeliveryStore.setState({ orders: masterState.deliveryOrders });
          }

          if (masterState.staffMembers && masterState.staffMembers.length > 0) {
            useStaffStore.setState({ staff: masterState.staffMembers });
          }

          if (masterState.inventoryStock && masterState.inventoryStock.length > 0) {
            useInventoryStore.setState({ ingredients: masterState.inventoryStock });
          }

          if (masterState.recipes && masterState.recipes.length > 0) {
            useInventoryStore.setState({ recipes: masterState.recipes });
          }

          if (masterState.wasteLogs && masterState.wasteLogs.length > 0) {
            useInventoryStore.setState({ wasteLogs: masterState.wasteLogs });
          }

          if (masterState.tableStatuses && Object.keys(masterState.tableStatuses).length > 0) {
            const currentTables = useTableStore.getState().tables;
            const updatedTables = currentTables.map(t => {
              const statusData = masterState.tableStatuses[t.id];
              if (statusData) {
                return { ...t, status: statusData.status, currentBill: statusData.subtotal };
              }
              return t;
            });
            useTableStore.setState({ tables: updatedTables });
          }
        });

        // --- KDS Ticket created on another terminal ---
        socket.on('kds_new_ticket', (ticket: any) => {
          const currentTickets = useKdsStore.getState().tickets;
          if (!currentTickets.find(t => t.id === ticket.id)) {
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
              if (payload.tableName.includes('Takeaway') || payload.tableName === 'Walk-in') {
                return !(t.tableNumber === payload.tableName && t.status === 'SERVED');
              }
              return t.tableNumber !== payload.tableName;
            })
          });
        });

        // --- Parked Orders updated on another terminal ---
        socket.on('parked_orders_updated', (parkedOrders: any[]) => {
          console.log('🛒 [POS] Parked orders updated from another terminal. Count:', parkedOrders.length);
          useCartStore.setState({ heldOrders: parkedOrders });
        });

        // --- Table status updated on another terminal ---
        socket.on('table_updated', (payload: { tableId: string; status: string; subtotal?: number }) => {
          const currentTables = useTableStore.getState().tables;
          console.log('🪑 [POS] Table status updated from another terminal:', payload.tableId, payload.status);
          useTableStore.setState({
            tables: currentTables.map(t => t.id === payload.tableId
              ? { ...t, status: payload.status as any, currentBill: payload.subtotal || t.currentBill }
              : t
            )
          });
        });

        // --- Delivery Orders updated on another terminal ---
        socket.on('delivery_orders_updated', (deliveryOrders: any[]) => {
          console.log('🛵 [POS] Delivery orders updated from another terminal. Count:', deliveryOrders.length);
          useDeliveryStore.setState({ orders: deliveryOrders });
        });

        // --- Staff Roster updated on another terminal ---
        socket.on('staff_updated', (staffMembers: any[]) => {
          console.log('👥 [POS] Staff roster updated from another terminal. Count:', staffMembers.length);
          useStaffStore.setState({ staff: staffMembers });
        });

        // --- Inventory updated on another terminal ---
        socket.on('inventory_updated', (inventory: any[]) => {
          console.log('📦 [POS] Inventory stock updated from another terminal. Count:', inventory.length);
          useInventoryStore.setState({ ingredients: inventory });
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
}
