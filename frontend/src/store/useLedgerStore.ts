import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      entries: [
    {
      id: 'led-1',
      customerId: 'cust-1',
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      amount: 1450.50,
      billNumber: 'INV-102934',
      date: new Date().toLocaleDateString(),
      status: 'UNPAID'
    }
  ],

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
  { name: 'pos-ledger-storage' }
));
