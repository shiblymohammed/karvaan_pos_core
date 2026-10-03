import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket, emitAction } from '../services/socket';

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
  mergedWith?: string[]; // Array of table IDs merged into this one
  mergedInto?: string;   // The primary table ID this table is merged into
}

const INITIAL_FLOORS: Floor[] = [
  { id: 'f-1', name: 'Ground Floor', zone: 'NON_AC', surchargeType: 'PERCENTAGE', surchargeValue: 0, sortOrder: 0 },
  { id: 'f-2', name: '1st Floor AC', zone: 'AC', surchargeType: 'PERCENTAGE', surchargeValue: 10, sortOrder: 1 },
  { id: 'f-3', name: 'Rooftop', zone: 'OUTDOOR', surchargeType: 'PERCENTAGE', surchargeValue: 5, sortOrder: 2 },
  { id: 'f-4', name: 'VIP Lounge', zone: 'VIP', surchargeType: 'FIXED', surchargeValue: 200, sortOrder: 3 },
];

const INITIAL_TABLES: DiningTable[] = [
  // Ground Floor (NON_AC) - Mix of regular and larger tables
  { id: 't1', number: 'T1', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't2', number: 'T2', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't3', number: 'T3', capacity: 6, status: 'AVAILABLE', floorId: 'f-1' }, // Slightly bigger
  { id: 't4', number: 'T4', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't5', number: 'T5', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't6', number: 'T6', capacity: 6, status: 'AVAILABLE', floorId: 'f-1' }, // Slightly bigger
  { id: 't7', number: 'T7', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  { id: 't8', number: 'T8', capacity: 4, status: 'AVAILABLE', floorId: 'f-1' },
  
  // 1st Floor AC - More tables with varied capacities
  { id: 't9', number: 'T9', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't10', number: 'T10', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't11', number: 'T11', capacity: 6, status: 'AVAILABLE', floorId: 'f-2' }, // Slightly bigger
  { id: 't12', number: 'T12', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't13', number: 'T13', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't14', number: 'T14', capacity: 6, status: 'AVAILABLE', floorId: 'f-2' }, // Slightly bigger
  { id: 't15', number: 'T15', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  { id: 't16', number: 'T16', capacity: 4, status: 'AVAILABLE', floorId: 'f-2' },
  
  // Rooftop - More outdoor seating
  { id: 't17', number: 'T17', capacity: 4, status: 'AVAILABLE', floorId: 'f-3' },
  { id: 't18', number: 'T18', capacity: 4, status: 'AVAILABLE', floorId: 'f-3' },
  { id: 't19', number: 'T19', capacity: 6, status: 'AVAILABLE', floorId: 'f-3' }, // Slightly bigger
  { id: 't20', number: 'T20', capacity: 4, status: 'AVAILABLE', floorId: 'f-3' },
  { id: 't21', number: 'T21', capacity: 4, status: 'AVAILABLE', floorId: 'f-3' },
  { id: 't22', number: 'T22', capacity: 6, status: 'AVAILABLE', floorId: 'f-3' }, // Slightly bigger
  
  // VIP Lounge - Premium larger tables
  { id: 'vip1', number: 'VIP-1', capacity: 8, status: 'AVAILABLE', floorId: 'f-4' }, // Larger VIP table
  { id: 'vip2', number: 'VIP-2', capacity: 8, status: 'AVAILABLE', floorId: 'f-4' }, // Larger VIP table
  { id: 'vip3', number: 'VIP-3', capacity: 6, status: 'AVAILABLE', floorId: 'f-4' },
  { id: 'vip4', number: 'VIP-4', capacity: 10, status: 'AVAILABLE', floorId: 'f-4' }, // Extra large for parties
];

interface TableState {
  tables: DiningTable[];
  floors: Floor[];
  setTableStatus: (id: string, status: TableStatus, currentBill?: number) => void;
  transferTable: (fromId: string, toNumber: string) => void;
  mergeTable: (primaryId: string, secondaryId: string) => void;
  unmergeTable: (id: string) => void;
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
    set((state) => {
      const table = state.tables.find(t => t.id === id);
      if (!table) return state;

      let newTables = [...state.tables];

      if (status === 'AVAILABLE' && table.mergedWith && table.mergedWith.length > 0) {
        // Unmerge secondary tables
        newTables = newTables.map(t => {
          if (table.mergedWith?.includes(t.id)) {
            emitAction('table_status_change', { tableId: t.id, status: 'AVAILABLE', subtotal: undefined, mergedInto: null });
            return { ...t, status: 'AVAILABLE', mergedInto: undefined };
          }
          return t;
        });
      }

      newTables = newTables.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            status,
            currentBill: status === 'AVAILABLE' ? undefined : (currentBill ?? t.currentBill),
            seatedTime: status === 'AVAILABLE' ? undefined : (t.seatedTime || new Date().toISOString()),
            mergedWith: status === 'AVAILABLE' ? undefined : t.mergedWith,
          };
        }
        return t;
      });
      return { tables: newTables };
    });
    const updatedTable = get().tables.find(t => t.id === id);
    emitAction('table_status_change', { 
      tableId: id, 
      status, 
      subtotal: currentBill,
      mergedWith: updatedTable?.mergedWith,
      mergedInto: updatedTable?.mergedInto
    });
  },

  transferTable: (fromId, toNumber) => {
    const state = get();
    const fromTable = state.tables.find((t) => t.id === fromId);
    const toTable = state.tables.find((t) => t.number === toNumber);
    
    if (!fromTable || !toTable) return;

    set((state) => {
      let newTables = [...state.tables];
      
      // If the fromTable has secondary merged tables, update them
      if (fromTable.mergedWith && fromTable.mergedWith.length > 0) {
        newTables = newTables.map(t => {
          if (fromTable.mergedWith?.includes(t.id)) {
            return { ...t, mergedInto: toTable.id };
          }
          return t;
        });
      }

      newTables = newTables.map((t) => {
        if (t.number === toNumber) {
          return {
            ...t,
            status: fromTable.status,
            currentBill: fromTable.currentBill,
            seatedTime: fromTable.seatedTime,
            mergedWith: fromTable.mergedWith,
          };
        }
        if (t.id === fromId) {
          return { ...t, status: 'AVAILABLE', currentBill: undefined, seatedTime: undefined, mergedWith: undefined };
        }
        return t;
      });

      return { tables: newTables };
    });

    // Broadcast transfer to all other terminals
    const finalToTable = get().tables.find(t => t.id === toTable.id);
    emitAction('table_status_change', { tableId: fromTable.id, status: 'AVAILABLE', subtotal: undefined, mergedWith: [], mergedInto: null });
    emitAction('table_status_change', { 
      tableId: toTable.id, 
      status: fromTable.status, 
      subtotal: fromTable.currentBill,
      mergedWith: finalToTable?.mergedWith,
      mergedInto: finalToTable?.mergedInto
    });

    // Sync Cart and KDS
    import('./cartStore').then(({ useCartStore }) => {
      useCartStore.getState().transferCartTable(fromTable.id, toTable.id, toTable.number);
    });
    import('./useKdsStore').then(({ useKdsStore }) => {
      useKdsStore.getState().transferKdsTable(`T${fromTable.number.replace('T', '')}`, `T${toTable.number.replace('T', '')}`);
    });
  },

  mergeTable: (primaryId, secondaryId) => {
    set((state) => {
      const primary = state.tables.find(t => t.id === primaryId);
      const secondary = state.tables.find(t => t.id === secondaryId);
      if (!primary || !secondary) return state;

      return {
        tables: state.tables.map(t => {
          if (t.id === primaryId) {
            return {
              ...t,
              status: t.status === 'AVAILABLE' ? 'OCCUPIED' : t.status,
              mergedWith: [...(t.mergedWith || []), secondaryId]
            };
          }
          if (t.id === secondaryId) {
            return {
              ...t,
              status: 'OCCUPIED',
              mergedInto: primaryId,
              currentBill: undefined,
              seatedTime: undefined,
            };
          }
          return t;
        })
      };
    });
    // Broadcast status change
    const pTable = get().tables.find(t => t.id === primaryId);
    const sTable = get().tables.find(t => t.id === secondaryId);
    if (pTable) emitAction('table_status_change', { tableId: pTable.id, status: pTable.status, mergedWith: pTable.mergedWith });
    if (sTable) emitAction('table_status_change', { tableId: sTable.id, status: 'OCCUPIED', subtotal: undefined, mergedInto: primaryId });
  },

  unmergeTable: (id) => {
    set((state) => {
      const table = state.tables.find(t => t.id === id);
      if (!table) return state;
      
      let newTables = [...state.tables];
      
      if (table.mergedInto) {
        // Unmerge secondary table
        const primaryId = table.mergedInto;
        newTables = newTables.map(t => {
          if (t.id === id) {
            return { ...t, status: 'AVAILABLE', mergedInto: undefined };
          }
          if (t.id === primaryId) {
            return { ...t, mergedWith: (t.mergedWith || []).filter(mId => mId !== id) };
          }
          return t;
        });
        const updatedPrimary = get().tables.find(t => t.id === primaryId);
        emitAction('table_status_change', { tableId: id, status: 'AVAILABLE', subtotal: undefined, mergedInto: null });
        if (updatedPrimary) emitAction('table_status_change', { tableId: primaryId, status: updatedPrimary.status, mergedWith: updatedPrimary.mergedWith });
      } else if (table.mergedWith && table.mergedWith.length > 0) {
        // Unmerge all secondary tables from this primary table
        newTables = newTables.map(t => {
          if (t.id === id) {
            return { ...t, mergedWith: [] };
          }
          if (table.mergedWith?.includes(t.id)) {
            emitAction('table_status_change', { tableId: t.id, status: 'AVAILABLE', subtotal: undefined, mergedInto: null });
            return { ...t, status: 'AVAILABLE', mergedInto: undefined };
          }
          return t;
        });
        emitAction('table_status_change', { tableId: id, status: table.status, mergedWith: [] });
      }
      return { tables: newTables };
    });
  },

  updateTableBill: (id, amount) => {
    set((state) => ({
      tables: state.tables.map((t) => 
        t.id === id ? { ...t, currentBill: amount } : t
      ),
    }));
    const t = get().tables.find(tbl => tbl.id === id);
    if (t) emitAction('table_status_change', { tableId: id, status: t.status, subtotal: amount });
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

