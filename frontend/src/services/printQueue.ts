import { create } from 'zustand';
import { apiClient } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { getServerUrl } from './serverConfig';

export interface PrintAgent { id: string; name: string; lastSeenAt?: string; revokedAt?: string; pairingExpiresAt?: string; }
export interface PrintDestination { id?: string; role: 'RECEIPT' | 'KITCHEN'; agentId: string; name: string; transport: 'TCP' | 'WINDOWS'; address: string; port: number; paperWidth: number; autoPrint: boolean; revision: number; }
export interface PrintJob { id: string; kind: string; reference: string; state: string; error?: string; parentId?: string; createdAt?: string; reviewedAt?: string; }
export interface PrintOverview { agents: PrintAgent[]; destinations: PrintDestination[]; jobs: PrintJob[]; }
const scope = () => `${getServerUrl()}:${useAuthStore.getState().currentUser?.restaurantId}:${useAuthStore.getState().accessToken}`;
export const usePrintQueue = create<{ data: PrintOverview | null; error: string; scope: string; refresh: () => Promise<PrintOverview>; clear: () => void }>((set, get) => ({
  data: null, error: '', scope: '',
  clear: () => set({ data: null, error: '', scope: '' }),
  refresh: async () => {
    const current = scope();
    if (get().scope !== current) set({ data: null, error: '', scope: current });
    try {
      const data = await apiClient.get('/printer/queue') as PrintOverview;
      if (scope() !== current) throw new Error('Account changed while checking printers');
      set({ data, error: '', scope: current }); return data;
    } catch (error) {
      if (scope() === current) set({ error: error instanceof Error ? error.message : 'Could not check printing' });
      throw error;
    }
  },
}));
export const printStateLabel = (state: string) => ({ QUEUED: 'Waiting for printing computer', CLAIMED: 'Preparing to send', SENDING: 'Sending to printer', SENT: 'Sent to printer', FAILED: 'Could not send', UNCERTAIN: 'Check paper before reprinting', CANCELLED: 'Cancelled' }[state] || state);
