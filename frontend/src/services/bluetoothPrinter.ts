import { registerPlugin } from '@capacitor/core';
import { uint8ArrayToBase64, buildBillReceipt, buildKotReceipt } from './tauriCommands';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface BluetoothPrinterPlugin {
  listPairedDevices(): Promise<{ devices: BluetoothDevice[] }>;
  print(options: { address: string; data: string }): Promise<{ success: boolean }>;
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
}

// Register the native Capacitor plugin
export const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

// LocalStorage Keys for Main Receipt Printer
const STORAGE_KEY_BT_ADDR = 'karvaan_pos_bt_printer_address';
const STORAGE_KEY_BT_NAME = 'karvaan_pos_bt_printer_name';
const STORAGE_KEY_BT_PAPER = 'karvaan_pos_bt_paper_width';

// LocalStorage Keys for Kitchen Order Ticket (KOT) Printer
const STORAGE_KEY_BT_KOT_ADDR = 'karvaan_pos_bt_kot_address';
const STORAGE_KEY_BT_KOT_NAME = 'karvaan_pos_bt_kot_name';
const STORAGE_KEY_BT_KOT_ENABLED = 'karvaan_pos_bt_kot_enabled';
const STORAGE_KEY_BT_KOT_PAPER = 'karvaan_pos_bt_kot_paper_width';

/** Detect if running inside a Capacitor native app */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
  return cap.platform === 'android' || cap.platform === 'ios';
}

/** Get currently configured Main Bluetooth printer */
export function getSavedBtPrinter(): { address: string; name: string; paperWidth: 58 | 80 } | null {
  if (typeof window === 'undefined') return null;
  const address = localStorage.getItem(STORAGE_KEY_BT_ADDR);
  const name = localStorage.getItem(STORAGE_KEY_BT_NAME) || 'Thermal Bluetooth Printer';
  const paper = (Number(localStorage.getItem(STORAGE_KEY_BT_PAPER)) || 58) as 58 | 80;
  if (!address) return null;
  return { address, name, paperWidth: paper === 80 ? 80 : 58 };
}

/** Save preferred Main Bluetooth printer */
export function setSavedBtPrinter(address: string, name: string, paperWidth: 58 | 80 = 58): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_BT_ADDR, address);
  localStorage.setItem(STORAGE_KEY_BT_NAME, name);
  localStorage.setItem(STORAGE_KEY_BT_PAPER, String(paperWidth));
}

/** Remove saved Main Bluetooth printer */
export function clearSavedBtPrinter(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_BT_ADDR);
  localStorage.removeItem(STORAGE_KEY_BT_NAME);
  localStorage.removeItem(STORAGE_KEY_BT_PAPER);
}

/** Get currently configured Kitchen (KOT) Bluetooth printer */
export function getSavedBtKotPrinter(): { address: string; name: string; enabled: boolean; paperWidth: 58 | 80 } | null {
  if (typeof window === 'undefined') return null;
  const address = localStorage.getItem(STORAGE_KEY_BT_KOT_ADDR);
  const name = localStorage.getItem(STORAGE_KEY_BT_KOT_NAME) || 'Kitchen Bluetooth Printer';
  const enabled = localStorage.getItem(STORAGE_KEY_BT_KOT_ENABLED) === 'true';
  const paper = (Number(localStorage.getItem(STORAGE_KEY_BT_KOT_PAPER)) || 58) as 58 | 80;
  if (!address && !enabled) return null;
  return { address: address || '', name, enabled, paperWidth: paper === 80 ? 80 : 58 };
}

/** Save preferred Kitchen (KOT) Bluetooth printer */
export function setSavedBtKotPrinter(
  address: string,
  name: string,
  enabled: boolean = true,
  paperWidth: 58 | 80 = 58
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_BT_KOT_ADDR, address);
  localStorage.setItem(STORAGE_KEY_BT_KOT_NAME, name);
  localStorage.setItem(STORAGE_KEY_BT_KOT_ENABLED, enabled ? 'true' : 'false');
  localStorage.setItem(STORAGE_KEY_BT_KOT_PAPER, String(paperWidth));
}

/** Enable or disable separate KOT Bluetooth printer */
export function setBtKotPrinterEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_BT_KOT_ENABLED, enabled ? 'true' : 'false');
}

/** Remove saved Kitchen (KOT) Bluetooth printer */
export function clearSavedBtKotPrinter(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_BT_KOT_ADDR);
  localStorage.removeItem(STORAGE_KEY_BT_KOT_NAME);
  localStorage.removeItem(STORAGE_KEY_BT_KOT_ENABLED);
  localStorage.removeItem(STORAGE_KEY_BT_KOT_PAPER);
}

/** List paired Bluetooth devices from Android system settings */
export async function listPairedBluetoothPrinters(): Promise<BluetoothDevice[]> {
  if (!isCapacitor()) {
    throw new Error('Native Bluetooth scanning is only available inside the Capacitor Android APK');
  }
  try {
    const res = await BluetoothPrinter.listPairedDevices();
    return res?.devices || [];
  } catch (err: any) {
    console.error('listPairedBluetoothPrinters error:', err);
    throw new Error(err?.message || 'Failed to list Bluetooth devices');
  }
}

/** Check if Bluetooth adapter is enabled */
export async function checkBluetoothEnabled(): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const res = await BluetoothPrinter.isBluetoothEnabled();
    return !!res?.enabled;
  } catch {
    return false;
  }
}

/** Send raw ESC/POS bytes directly to the paired Bluetooth thermal printer without any external apps */
export async function printViaBluetoothNative(bytes: Uint8Array, targetAddress?: string): Promise<boolean> {
  if (!isCapacitor()) {
    throw new Error('Native Bluetooth printing is only available inside the Capacitor Android APK');
  }

  const address = targetAddress || getSavedBtPrinter()?.address;
  if (!address) {
    throw new Error('No Bluetooth printer configured. Please select your printer in Settings.');
  }

  const base64Data = uint8ArrayToBase64(bytes);

  try {
    const res = await BluetoothPrinter.print({
      address,
      data: base64Data,
    });
    return !!res?.success;
  } catch (err: any) {
    console.error('printViaBluetoothNative error:', err);
    throw new Error(err?.message || 'Bluetooth printing failed');
  }
}

/** Send a test bill print directly via Bluetooth */
export async function testBluetoothNativePrint(
  address: string,
  restaurantName: string,
  paperWidth: 58 | 80 = 58
): Promise<boolean> {
  const bytes = buildBillReceipt({
    restaurantName: restaurantName || 'Karvaan POS',
    restaurantAddress: 'Direct In-App Bluetooth Print',
    gstin: 'Zero Popups - 100% Native',
    billNumber: 'BT-TEST-01',
    orderType: 'APK NATIVE TEST',
    tableName: 'Table 1',
    items: [
      { name: 'Thermal ESC/POS Test', qty: 1, price: 100 },
      { name: 'Capacitor Android Driver', qty: 1, price: 50 },
    ],
    subtotal: 150,
    discount: 0,
    gst: 7.5,
    grandTotal: 157.5,
    paymentMethod: 'CASH',
    cashier: 'Cashier',
    time: new Date().toLocaleTimeString(),
    paperWidth,
  });

  return await printViaBluetoothNative(bytes, address);
}

/** Send a test Kitchen Order Ticket (KOT) directly via Bluetooth */
export async function testBluetoothKotPrint(
  address: string,
  paperWidth: 58 | 80 = 58
): Promise<boolean> {
  const bytes = buildKotReceipt({
    orderNumber: 'KOT-TEST-01',
    tableName: 'Table 5 (Dine In)',
    items: [
      { name: 'Butter Chicken Special', qty: 1, notes: 'Medium spice, extra gravy' },
      { name: 'Garlic Butter Naan', qty: 3 },
      { name: 'Fresh Lime Soda', qty: 2, notes: 'Sweet & salt' },
    ],
    time: new Date().toLocaleTimeString(),
    paperWidth,
  });

  return await printViaBluetoothNative(bytes, address);
}
