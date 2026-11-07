import { getServerUrl, getTerminalId } from './serverConfig';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from './apiClient';
import { createId } from './createId';

const key = (billNumber: string) => `karvaan-direct-receipt:${encodeURIComponent(getServerUrl())}:${useAuthStore.getState().currentUser?.restaurantId}:${getTerminalId()}:${encodeURIComponent(billNumber)}`;
export const directReceiptWasAttempted = (billNumber: string) => !!localStorage.getItem(key(billNumber));
/** Mark before sending: an interrupted hardware write must not trigger an automatic second copy. */
export async function printDirectReceiptOnce(billNumber: string, send: () => Promise<unknown>): Promise<void> {
  const receiptKey = key(billNumber);
  const run = async () => {
    if (localStorage.getItem(receiptKey)) throw new Error('A receipt was already sent or attempted. Check the paper; use a marked reprint from bill history if another copy is needed.');
    localStorage.setItem(receiptKey, 'SENDING');
    try {
      // The server fences other terminals and queued originals, including after a lost checkout acknowledgement.
      const claim = await apiClient.post('/printer/queue/direct-receipt', { billNumber, terminalId: getTerminalId(), requestId: createId() });
      if (claim?.allowed !== true) throw new Error('The restaurant server did not confirm this print claim. Check the bill before printing another copy.');
      await send(); localStorage.setItem(receiptKey, 'SENT');
    }
    catch (error) { localStorage.setItem(receiptKey, 'UNCERTAIN'); throw error; }
  };
  if (navigator.locks) await navigator.locks.request(receiptKey, run); else await run();
}
