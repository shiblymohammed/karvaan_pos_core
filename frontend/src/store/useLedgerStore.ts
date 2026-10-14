import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { authorizedFetch } from '../services/authFetch';
import { emitAction, ActionResult } from '../services/socket';
import { useAuthStore } from './useAuthStore';
import { toast } from './useToastStore';

export interface LedgerEntry {
  id: string; customerId: string; customerName: string; customerPhone: string;
  amount: number; originalAmount?: number; paidAmount?: number; billNumber: string;
  date: string; status: 'UNPAID' | 'PAID';
}
interface LedgerState {
  entries: LedgerEntry[];
  legacyEntries: LedgerEntry[];
  fetchEntries: () => Promise<void>;
  settleDebt: (id: string, amount?: number, method?: 'CASH' | 'UPI' | 'CARD') => Promise<ActionResult>;
  getOutstandingBalance: (phone: string) => number;
}
export const useLedgerStore = create<LedgerState>()(persist((set, get) => ({
  entries: [], legacyEntries: [],
  fetchEntries: async () => {
    const userId = useAuthStore.getState().currentUser?.id;
    try {
      const response = await authorizedFetch('/billing/ledger');
      if (!response.ok) throw new Error('Customer balances could not be loaded');
      const rows = await response.json();
      if (userId === useAuthStore.getState().currentUser?.id) applyLedgerSnapshot(rows);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Customer balances could not be loaded'); }
  },
  settleDebt: async (id, amount, method = 'CASH') => {
    const entry = get().entries.find(entry => entry.id === id);
    if (!entry || !id.startsWith('credit:')) return { status: 'ERROR', message: 'This older device entry needs review before server repayment.' };
    const result = await emitAction('ledger_payment', { entryId: id, amount: amount ?? entry.amount, paymentMethod: method });
    if (result.status === 'QUEUED') toast.info('Repayment saved on this device; awaiting server confirmation.');
    if (result.status === 'OK') await get().fetchEntries();
    return result;
  },
  getOutstandingBalance: phone => get().entries.filter(entry => entry.customerPhone === phone && entry.status === 'UNPAID').reduce((sum, entry) => sum + entry.amount, 0),
}), { name: 'pos-ledger-storage', storage: createJSONStorage(() => tenantStorage) }));

export function applyLedgerSnapshot(rows: LedgerEntry[]) {
  const state = useLedgerStore.getState();
  const legacy = state.entries.filter(entry => !entry.id.startsWith('credit:') && !entry.id.startsWith('refund:'));
  const archive = new Map([...state.legacyEntries || [], ...legacy].map(entry => [entry.id, entry]));
  useLedgerStore.setState({ entries: rows, legacyEntries: [...archive.values()] });
}
