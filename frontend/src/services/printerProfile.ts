import { getServerUrl, getTerminalId } from './serverConfig';
import { useAuthStore } from '../store/useAuthStore';

export interface NetworkPrinter { id: string; name: string; role: 'CASHIER' | 'KITCHEN' | 'BAR' | 'LABEL'; ip: string; port: string; paperSize: '58mm' | '80mm' | 'label'; status?: 'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'; }
export interface PrinterProfile { printers: NetworkPrinter[]; receiptPrinterId?: string; kitchenPrinterId?: string; receiptPort?: string; drawerPort?: string; }
const key = () => `karvaan-printers:${encodeURIComponent(getServerUrl())}:${useAuthStore.getState().currentUser?.restaurantId}:${getTerminalId()}`;
export function getPrinterProfile(): PrinterProfile { try { return { printers: [], ...JSON.parse(localStorage.getItem(key()) || '{}') }; } catch { return { printers: [] }; } }
export function savePrinterProfile(profile: PrinterProfile) { localStorage.setItem(key(), JSON.stringify(profile)); }
export function canBackendPrintLocally() {
  const host = new URL(getServerUrl()).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
