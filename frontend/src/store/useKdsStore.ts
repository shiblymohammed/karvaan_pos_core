import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { emitAction, ActionResult } from '../services/socket';
import { toast } from './useToastStore';

export interface KdsTicket {
  tableId?: string | null;
  pendingConfirmation?: boolean;
  id: string;
  orderNumber: string;
  tableNumber: string;
  orderType?: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  customerName?: string;
  items: Array<{ name: string; quantity: number; notes?: string; addons?: { name: string }[]; status: string; price?: number; productId?: string; category?: string; subItems?: { name: string; qty: number }[] }>;
  firedAt: string;
  status: 'RECEIVED' | 'COOKING' | 'READY' | 'SERVED';
  elapsedMinutes: number;
  readyAt?: string;
}

interface KdsState {
  tickets: KdsTicket[];
  addTicket: (ticket: Omit<KdsTicket, 'status' | 'elapsedMinutes'>) => Promise<ActionResult>;
  updateTicketStatus: (id: string, status: 'COOKING' | 'READY' | 'SERVED') => Promise<ActionResult>;
  updateElapsedTimes: () => void;
  clearTableTickets: (tableName: string) => void;
  transferKdsTable: (fromTableName: string, toTableName: string) => void;
}

export const useKdsStore = create<KdsState>()(
  persist(
    (set, get) => ({
      tickets: [],

  addTicket: async (ticket) => {
    set((state) => ({
      tickets: [
        {
          ...ticket,
          status: 'RECEIVED', pendingConfirmation: true,
          elapsedMinutes: 0,
        },
        ...state.tickets,
      ],
    }));
    // Broadcast to all other devices
    const result = await emitAction('fire_order', { ...ticket, status: 'COOKING', elapsedMinutes: 0 });
    if (result.status === 'ERROR') set({ tickets: get().tickets.filter(row => row.id !== ticket.id) });
    if (result.status === 'QUEUED') toast.info('Kitchen order saved on this device; awaiting server confirmation.');
    return result;
  },

  updateTicketStatus: async (id, status) => {
    const ticket = get().tickets.find(row => row.id === id);
    if (!ticket) return { status: 'ERROR', message: 'Kitchen ticket not found' };
    if (ticket.pendingConfirmation) return { status: 'QUEUED', message: 'Wait for server confirmation before changing this ticket again.' };
    set({ tickets: get().tickets.map(row => row.id === id ? { ...row, pendingConfirmation: true } : row) });
    const result = await emitAction('update_kds_status', { orderId: id, orderNumber: ticket.orderNumber, status });
    if (result.status === 'OK') set({ tickets: get().tickets.map(row => row.id === id ? { ...row, status: ['RECEIVED', 'COOKING', 'READY', 'SERVED'].indexOf(row.status) > ['RECEIVED', 'COOKING', 'READY', 'SERVED'].indexOf(status) ? row.status : status, pendingConfirmation: false } : row) });
    if (result.status === 'ERROR') set({ tickets: get().tickets.map(row => row.id === id ? { ...row, pendingConfirmation: false } : row) });
    if (result.status === 'QUEUED') toast.info('Kitchen status saved on this device; awaiting server confirmation.');
    return result;
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

