import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { socket, emitAction } from '../services/socket';

export interface KdsTicket {
  id: string;
  orderNumber: string;
  tableNumber: string;
  orderType?: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  customerName?: string;
  items: Array<{ name: string; quantity: number; notes?: string; status: string; price?: number; productId?: string; category?: string; subItems?: { name: string; qty: number }[] }>;
  firedAt: string;
  status: 'RECEIVED' | 'COOKING' | 'READY' | 'SERVED';
  elapsedMinutes: number;
  readyAt?: string;
}

interface KdsState {
  tickets: KdsTicket[];
  addTicket: (ticket: Omit<KdsTicket, 'status' | 'elapsedMinutes'>) => void;
  updateTicketStatus: (id: string, status: 'COOKING' | 'READY' | 'SERVED') => void;
  updateElapsedTimes: () => void;
  clearTableTickets: (tableName: string) => void;
  transferKdsTable: (fromTableName: string, toTableName: string) => void;
}

export const useKdsStore = create<KdsState>()(
  persist(
    (set, get) => ({
      tickets: [],

  addTicket: (ticket) => {
    set((state) => ({
      tickets: [
        {
          ...ticket,
          status: 'COOKING',
          elapsedMinutes: 0,
        },
        ...state.tickets,
      ],
    }));
    // Broadcast to all other devices
    emitAction('fire_order', { ...ticket, status: 'COOKING', elapsedMinutes: 0 });
  },

  updateTicketStatus: (id, status) => {
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, status, readyAt: status === 'READY' ? new Date().toISOString() : t.readyAt } : t)),
    }));
    // Sync to DeliveryStore if it's a delivery order
    const ticket = get().tickets.find(t => t.id === id);
    if (ticket && (ticket.orderType === 'DELIVERY' || ticket.orderType === 'PARCEL') && status === 'READY') {
      import('./useDeliveryStore').then(({ useDeliveryStore }) => {
        // We match by orderNumber. We need to find the delivery order id.
        const dOrders = useDeliveryStore.getState().orders;
        const matched = dOrders.find(o => o.orderNumber === ticket.orderNumber);
        if (matched) {
          useDeliveryStore.getState().updateOrderStatus(matched.id, 'READY');
        }
      });
    }

    // Broadcast to all other devices
    emitAction('update_kds_status', { orderId: id, orderNumber: ticket?.orderNumber, status });
  },

  updateElapsedTimes: () => {
    set((state) => {
      const now = new Date();
      return {
        tickets: state.tickets
          .map((t) => {
            if (t.status === 'READY' || t.status === 'SERVED') return t;
            const fired = new Date(t.firedAt);
            const elapsed = Math.floor((now.getTime() - fired.getTime()) / 60000);
            return { ...t, elapsedMinutes: elapsed };
          })
          .filter((t) => {
            // Prune tickets older than 24 hours to prevent localStorage memory leaks
            const fired = new Date(t.firedAt);
            const ageHours = (now.getTime() - fired.getTime()) / (1000 * 60 * 60);
            return ageHours < 24;
          }),
      };
    });
  },

  clearTableTickets: (tableName) => {
    set((state) => ({
      tickets: state.tickets.filter((t) => {
        return !(t.tableNumber === tableName && t.status === 'SERVED');
      }),
    }));
    // Broadcast to all other devices
    emitAction('clear_table_tickets', { tableName });
  },

  transferKdsTable: (fromTableName, toTableName) => {
    set((state) => ({
      tickets: state.tickets.map((t) => 
        t.tableNumber === fromTableName ? { ...t, tableNumber: toTableName } : t
      )
    }));
    emitAction('transfer_kds_table', { fromTableName, toTableName });
  },
}), { name: 'pos-kds-storage', storage: createJSONStorage(() => tenantStorage) }));

