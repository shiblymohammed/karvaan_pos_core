import { registerPlugin } from '@capacitor/core';
import { uint8ArrayToBase64, buildBillReceipt } from './tauriCommands';

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

const STORAGE_KEY_BT_ADDR = 'karvaan_pos_bt_printer_address';
const STORAGE_KEY_BT_NAME = 'karvaan_pos_bt_printer_name';

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

/** Get currently configured Bluetooth printer */
export function getSavedBtPrinter(): { address: string; name: string } | null {
  if (typeof window === 'undefined') return null;
  const address = localStorage.getItem(STORAGE_KEY_BT_ADDR);
  const name = localStorage.getItem(STORAGE_KEY_BT_NAME) || 'Thermal Bluetooth Printer';
  if (!address) return null;
  return { address, name };
}

/** Save preferred Bluetooth printer */
export function setSavedBtPrinter(address: string, name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_BT_ADDR, address);
  localStorage.setItem(STORAGE_KEY_BT_NAME, name);
}

/** Remove saved Bluetooth printer */
export function clearSavedBtPrinter(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_BT_ADDR);
  localStorage.removeItem(STORAGE_KEY_BT_NAME);
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

/** Send a test print directly via Bluetooth */
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
