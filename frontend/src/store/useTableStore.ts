import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket } from '../services/socket';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLED';

export interface Floor {
  id: string;
  name: string;
  zone: string; // 'AC' | 'NON_AC' | 'OUTDOOR' | 'VIP' | 'PARTY_HALL'
  surchargeType: 'PERCENTAGE' | 'FIXED';
  surchargeValue: number;
  sortOrder: number;
}

export interface DiningTable {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  floorId: string;
  currentBill?: number;
  seatedTime?: string;
}

const INITIAL_FLOORS: Floor[] = [
  { id: 'f-1', name: 'Ground Floor', zone: 'NON_AC', surchargeType: 'PERCENTAGE', surchargeValue: 0, sortOrder: 0 },
  { id: 'f-2', name: '1st Floor AC', zone: 'AC', surchargeType: 'PERCENTAGE', surchargeValue: 10, sortOrder: 1 },
  { id: 'f-3', name: 'Rooftop', zone: 'OUTDOOR', surchargeType: 'PERCENTAGE', surchargeValue: 5, sortOrder: 2 },
  { id: 'f-4', name: 'VIP Lounge', zone: 'VIP', surchargeType: 'FIXED', surchargeValue: 200, sortOrder: 3 },
];

const INITIAL_TABLES: DiningTable[] = [
  { id: 't1', number: 'T1', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't2', number: 'T2', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't3', number: 'T3', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't4', number: 'T4', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't5', number: 'T5', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't6', number: 'T6', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't7', number: 'T7', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't8', number: 'T8', capacity: 4, status: 'AVAILABLE', floorId: 'f-3' },
  { id: 'vip1', number: 'VIP-1', capacity: 6, status: 'AVAILABLE', floorId: 'f-4' },
  { id: 'vip2', number: 'VIP-2', capacity: 6, status: 'AVAILABLE', floorId: 'f-4' },
];

interface TableState {
  tables: DiningTable[];
  floors: Floor[];
  setTableStatus: (id: string, status: TableStatus, currentBill?: number) => void;
  transferTable: (fromId: string, toNumber: string) => void;
  updateTableBill: (id: string, amount: number) => void;
  
  // Table Management
  addTable: (table: Omit<DiningTable, 'id' | 'status'>) => void;
  updateTable: (id: string, updates: Partial<Omit<DiningTable, 'id'>>) => void;
  deleteTable: (id: string) => void;
  bulkAddTables: (count: number, prefix: string, capacity: number, floorId: string) => void;

  // Floor Management
  addFloor: (floor: Omit<Floor, 'id' | 'sortOrder'>) => void;
  updateFloor: (id: string, updates: Partial<Omit<Floor, 'id'>>) => void;
  deleteFloor: (id: string) => void;
  reorderFloor: (id: string, direction: 'up' | 'down') => void;
}

export const useTableStore = create<TableState>()(
  persist(
    (set, get) => ({
      tables: INITIAL_TABLES,
      floors: INITIAL_FLOORS,

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

  // ─── Table CRUD ─────────────────────────────────────────────────────────────
  addTable: (table) => {
    set((state) => ({
      tables: [...state.tables, { ...table, id: `t-${Date.now()}`, status: 'AVAILABLE' }],
    }));
  },
  
  updateTable: (id, updates) => {
    set((state) => ({
      tables: state.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },
  
  deleteTable: (id) => {
    set((state) => ({
      tables: state.tables.filter((t) => t.id !== id),
    }));
  },

  bulkAddTables: (count, prefix, capacity, floorId) => {
    set((state) => {
      const newTables: DiningTable[] = [];
      const timestamp = Date.now();
      // Find highest existing number with this prefix to start from
      let maxNum = 0;
      state.tables.forEach(t => {
        if (t.number.startsWith(prefix)) {
          const numPart = t.number.slice(prefix.length);
          const num = parseInt(numPart);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      
      for (let i = 1; i <= count; i++) {
        newTables.push({
          id: `t-${timestamp}-${i}`,
          number: `${prefix}${maxNum + i}`,
          capacity,
          status: 'AVAILABLE',
          floorId
        });
      }
      return { tables: [...state.tables, ...newTables] };
    });
  },

  // ─── Floor CRUD ─────────────────────────────────────────────────────────────
  addFloor: (floor) => {
    set((state) => ({
      floors: [
        ...state.floors,
        { ...floor, id: `f-${Date.now()}`, sortOrder: state.floors.length },
      ],
    }));
  },

  updateFloor: (id, updates) => {
    set((state) => ({
      floors: state.floors.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  },

  deleteFloor: (id) => {
    set((state) => {
      // Don't delete if it's the last floor
      if (state.floors.length <= 1) return state;
      
      const newFloors = state.floors.filter((f) => f.id !== id);
      const fallbackFloorId = newFloors[0].id;
      
      return {
        floors: newFloors,
        // Reassign orphaned tables
        tables: state.tables.map((t) => 
          t.floorId === id ? { ...t, floorId: fallbackFloorId } : t
        )
      };
    });
  },

  reorderFloor: (id, direction) => {
    set((state) => {
      const sorted = [...state.floors].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((f) => f.id === id);
      if (idx === -1) return state;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return state;

      const newSorted = sorted.map((f, i) => {
        if (i === idx) return { ...f, sortOrder: sorted[swapIdx].sortOrder };
        if (i === swapIdx) return { ...f, sortOrder: sorted[idx].sortOrder };
        return f;
      });

      return { floors: newSorted };
    });
  },
}),
  { name: 'pos-table-storage' }
));
