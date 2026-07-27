import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket } from '../services/socket';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLED';

export interface DiningTable {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  currentBill?: number;
  seatedTime?: string;
}

const INITIAL_TABLES: DiningTable[] = [
  { id: 't1', number: 'T1', capacity: 4, status: 'AVAILABLE' },
  { id: 't2', number: 'T2', capacity: 4, status: 'AVAILABLE' },
  { id: 't3', number: 'T3', capacity: 4, status: 'AVAILABLE' },
  { id: 't4', number: 'T4', capacity: 4, status: 'AVAILABLE' },
  { id: 't5', number: 'T5', capacity: 4, status: 'AVAILABLE' },
  { id: 't6', number: 'T6', capacity: 4, status: 'AVAILABLE' },
  { id: 't7', number: 'T7', capacity: 4, status: 'AVAILABLE' },
  { id: 't8', number: 'T8', capacity: 4, status: 'AVAILABLE' },
  { id: 'vip1', number: 'VIP-1', capacity: 6, status: 'AVAILABLE' },
  { id: 'vip2', number: 'VIP-2', capacity: 6, status: 'AVAILABLE' },
];

interface TableState {
  tables: DiningTable[];
  setTableStatus: (id: string, status: TableStatus, currentBill?: number) => void;
  transferTable: (fromId: string, toNumber: string) => void;
  updateTableBill: (id: string, amount: number) => void;
}

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => ({
      tables: INITIAL_TABLES,

  setTableStatus: (id, status, currentBill) => {
    set((state) => ({
      tables: state.tables.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            status,
            currentBill: status === 'AVAILABLE' ? undefined : (currentBill ?? t.currentBill),
            seatedTime: status === 'AVAILABLE' ? undefined : (t.seatedTime || 'Just now'),
          };
        }
        return t;
      }),
    }));
    // Broadcast to all other devices
    socket.emit('table_status_change', { tableId: id, status, subtotal: currentBill });
  },

  transferTable: (fromId, toNumber) => {
    set((state) => {
      const fromTable = state.tables.find((t) => t.id === fromId);
      if (!fromTable) return state;

      return {
        tables: state.tables.map((t) => {
          if (t.number === toNumber) {
            return {
              ...t,
              status: fromTable.status,
              currentBill: fromTable.currentBill,
              seatedTime: fromTable.seatedTime,
            };
          }
          if (t.id === fromId) {
            return { ...t, status: 'AVAILABLE', currentBill: undefined, seatedTime: undefined };
          }
          return t;
        }),
      };
    });
    // Broadcast transfer to all other terminals
    const state = get();
    const fromT = state.tables.find(t => t.id === fromId);
    const toT = state.tables.find(t => t.number === toNumber);
    if (fromT) socket.emit('table_status_change', { tableId: fromT.id, status: 'AVAILABLE', subtotal: undefined });
    if (toT) socket.emit('table_status_change', { tableId: toT.id, status: toT.status, subtotal: toT.currentBill });
  },

  updateTableBill: (id, amount) => {
    set((state) => ({
      tables: state.tables.map((t) => 
        t.id === id ? { ...t, currentBill: amount } : t
      ),
    }));
    const t = get().tables.find(tbl => tbl.id === id);
    if (t) socket.emit('table_status_change', { tableId: id, status: t.status, subtotal: amount });
  },
}),
  { name: 'pos-table-storage' }
));
