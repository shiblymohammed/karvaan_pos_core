import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';

export interface LedgerEntry {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  billNumber: string;
  date: string;
  status: 'UNPAID' | 'PAID';
}

interface LedgerState {
  entries: LedgerEntry[];
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'status'>) => void;
  settleDebt: (id: string) => void;
  getOutstandingBalance: (phone: string) => number;
}

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      entries: [],

  addEntry: (entry) => set((state) => ({
    entries: [{ ...entry, id: `led-${Date.now()}`, status: 'UNPAID' }, ...state.entries]
  })),

  settleDebt: (id) => set((state) => ({
    entries: state.entries.map(e => e.id === id ? { ...e, status: 'PAID' } : e)
  })),

  getOutstandingBalance: (phone) => {
    return get().entries
      .filter(e => e.customerPhone === phone && e.status === 'UNPAID')
      .reduce((sum, e) => sum + e.amount, 0);
  }
}),
  { name: 'pos-ledger-storage', storage: createJSONStorage(() => tenantStorage) }
));
