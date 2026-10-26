/**
 * tauriCommands.ts
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * TypeScript bridge to Tauri Rust commands.
 *
 * Usage:
 *   import { isTauri, printReceipt, kickCashDrawer, listSerialPorts } from './tauriCommands';
 *
 *   if (isTauri()) {
 *     await printReceipt('COM3', escPosBytes);
 *   }
 *
 * All functions gracefully degrade when running in a browser (not Tauri).
 */

// Detect if running inside Tauri desktop app
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Detect if user is on an Android device */
export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

/** Convert Uint8Array to Base64 string */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Send raw ESC/POS bytes directly to the RawBT Android app via its custom URL scheme.
 * This triggers instant background printing to Bluetooth, USB, or Wi-Fi thermal printers
 * without opening the Android print preview dialog.
 */
export function printViaRawBT(bytes: Uint8Array): boolean {
  try {
    const base64 = uint8ArrayToBase64(bytes);
    const rawbtUrl = `rawbt:data:application/octet-stream;base64,${base64}`;

    const link = document.createElement('a');
    link.href = rawbtUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 1000);
    return true;
  } catch (err) {
    console.error('Failed to trigger RawBT intent:', err);
    return false;
  }
}

export function printNetworkReceipt(ip: string, port: number, data: Uint8Array): Promise<string> {
  return invoke<string>('print_network_receipt', { ip, port, data: Array.from(data) });
}

// Lazy-load Tauri invoke to avoid errors in browser mode
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(`Tauri command '${cmd}' called outside of Tauri app`);
  }
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// â”€â”€â”€ Serial Port / Printer Commands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * List all available serial ports (USB/COM ports).
 * Returns empty array in browser mode.
 */
export async function listSerialPorts(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<string[]>('list_serial_ports');
  } catch {
    return [];
  }
}

/**
 * Send ESC/POS bytes to a thermal receipt printer.
 * @param portName - COM port e.g. 'COM3' or '/dev/ttyUSB0'
 * @param data - Uint8Array of ESC/POS bytes
 */
export async function printReceipt(portName: string, data: Uint8Array): Promise<string> {
  if (!isTauri()) {
    console.warn('[Tauri] printReceipt: not in Tauri - falling back to browser print disabled');
    return 'Fallback: browser print dialog disabled';
  }
  return invoke<string>('print_receipt', {
    portName,
    data: Array.from(data), // Rust expects Vec<u8>
  });
}

/**
 * Trigger the cash drawer via serial port pulse.
 * @param portName - COM port the cash drawer is connected to
 */
export async function kickCashDrawer(portName: string): Promise<string> {
  if (!isTauri()) {
    console.warn('[Tauri] kickCashDrawer: not in Tauri â€” no-op');
    return 'Browser mode: cash drawer not available';
  }
  return invoke<string>('kick_cash_drawer', { portName });
}

/**
 * Get the app version string from Cargo.toml.
 * Returns '1.0.0-browser' in browser mode.
 */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return '1.0.0-browser';
  try {
    return await invoke<string>('get_app_version');
  } catch {
    return 'unknown';
  }
}

// â”€â”€â”€ ESC/POS Receipt Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Utility to construct ESC/POS byte sequences for thermal printers

export class EscPos {
  private bytes: number[] = [];

  /** Initialize printer and reset settings */
  init() {
    this.bytes.push(0x1b, 0x40); // ESC @
    return this;
  }

  /** Set text alignment: 0=left, 1=center, 2=right */
  align(a: 0 | 1 | 2) {
    this.bytes.push(0x1b, 0x61, a);
    return this;
  }

  /** Set bold on/off */
  bold(on: boolean) {
    this.bytes.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  /** Set double-size text on/off */
  doubleSize(on: boolean) {
    this.bytes.push(0x1d, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  /** Append a text line (UTF-8 encoded) */
  text(str: string) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, ' '));
    this.bytes.push(...encoded);
    return this;
  }

  /** Append a line feed (newline) */
  newline(count = 1) {
    for (let i = 0; i < count; i++) this.bytes.push(0x0a);
    return this;
  }

  /** Print dashed separator line */
  separator(char = '-', width = 32) {
    return this.text(char.repeat(width)).newline();
  }

  /** Feed paper by n lines */
  feed(lines = 3) {
    this.bytes.push(0x1b, 0x64, lines);
    return this;
  }

  /** Cut paper (full cut) */
  cut() {
    this.bytes.push(0x1d, 0x56, 0x00);
    return this;
  }

  /** Get the final byte array */
  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

/**
 * Build a complete KOT (Kitchen Order Ticket) receipt
 */
export function buildKotReceipt(params: {
  orderNumber: string;
  tableName: string;
  items: { name: string; qty: number; notes?: string; addons?: { name: string }[] }[];
  time: string;
  paperWidth?: number;
}): Uint8Array {
  const esc = new EscPos()
    .init()
    .align(1)
    .bold(true)
    .doubleSize(true)
    .text('KOT')
    .newline()
    .doubleSize(false)
    .text(`Order: ${params.orderNumber}`)
    .newline()
    .text(`Table: ${params.tableName}`)
    .newline()
    .text(`Time: ${params.time}`)
    .newline()
    .align(0)
    .separator()
    .bold(true)
    .text('ITEM                         QTY')
    .newline()
    .bold(false)
    .separator();
  params.items.forEach(item => {
    thermalLines(`${item.qty} x ${item.name}`, params.paperWidth === 80 ? 48 : 32).forEach(line => esc.text(line).newline());
    for (const addon of item.addons || []) thermalLines(`  + ${addon.name}`, params.paperWidth === 80 ? 48 : 32).forEach(line => esc.text(line).newline());
    if (item.notes) thermalLines(`  NOTE: ${item.notes}`, params.paperWidth === 80 ? 48 : 32).forEach(line => esc.text(line).newline());
  });
  return esc.separator().feed(3).cut().build();
}

/**
 * Build a bill receipt for the customer
 */
export function buildBillReceipt(params: {
  restaurantName: string;
  restaurantAddress?: string;
  gstin?: string;
  billNumber: string;
  orderType: string;
  tableName?: string;
  items: { name: string; qty: number; price: number; notes?: string; addons?: { name: string }[] }[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  tenders?: Record<string, number>;
  deliveryFee?: number;
  pendingConfirmation?: boolean;
  paymentPending?: boolean;
  cashier: string;
  time: string;
  prebill?: boolean;
  paperWidth?: number;
  reprint?: boolean;
}): Uint8Array {
  const width = params.paperWidth === 58 ? 32 : 48;
  const esc = new EscPos()
    .init()
    .align(1)
    .bold(true)
    .doubleSize(true)
    .text(params.restaurantName)
    .newline()
    .text(params.restaurantAddress || '')
    .newline()
    .text(params.gstin ? `GSTIN: ${params.gstin}` : '')
    .newline()
    .doubleSize(false)
    .bold(false)
    .text(params.orderType)
    .newline()
    .text(params.time)
    .newline()
    .align(0)
    .separator()
    .text(`Bill: ${params.billNumber}`)
    .newline();

  if (params.prebill) esc.bold(true).text('PRE-BILL - UNPAID').newline().bold(false);
  if (params.reprint) esc.bold(true).text('REPRINT').newline().bold(false);

  if (params.tableName) {
    esc.text(`Table: ${params.tableName}`).newline();
  }

  esc
    .text(`Cashier: ${params.cashier}`)
    .newline()
    .separator()
    .bold(true)
    .text('ITEM                 QTY  AMOUNT')
    .newline()
    .bold(false)
    .separator();

  params.items.forEach(item => {
    thermalLines(`${item.qty} x ${item.name}`, width).forEach(line => esc.text(line).newline());
    esc.text(`  Rs. ${(item.qty * item.price).toFixed(2)}`).newline();
    for (const addon of item.addons || []) thermalLines(`  + ${addon.name}`, width).forEach(line => esc.text(line).newline());
    if (item.notes) {
      thermalLines(`  NOTE: ${item.notes}`, width).forEach(line => esc.text(line).newline());
    }
  });

  esc
    .separator()
    .text(`${'Subtotal'.padEnd(24)}${params.subtotal.toFixed(2).padStart(8)}`)
    .newline();

  if (params.discount > 0) {
    esc.text(`${'Discount'.padEnd(24)}-${params.discount.toFixed(2).padStart(7)}`).newline();
  }

  esc
    .text(`${'GST'.padEnd(24)}${params.gst.toFixed(2).padStart(8)}`)
    .newline()
  if (params.deliveryFee) esc.text(`${'Delivery fee'.padEnd(24)}${params.deliveryFee.toFixed(2).padStart(8)}`).newline();
  esc
    .separator()
    .bold(true)
    .doubleSize(true)
    .text(`TOTAL   Rs.${params.grandTotal.toFixed(2)}`)
    .newline()
    .doubleSize(false)
    .bold(false)
    .text(`Payment: ${params.paymentMethod}`)
    .newline()
  if (params.tenders) for (const [method, amount] of Object.entries(params.tenders)) if (amount > 0) esc.text(`${method}: Rs.${amount.toFixed(2)}`).newline();
  if (params.pendingConfirmation) esc.text('AWAITING SERVER CONFIRMATION').newline();
  if (params.paymentPending) esc.text('PAYMENT PENDING').newline();
  esc
    .separator()
    .align(1)
    .text('Thank you! Visit again.')
    .newline()
    .align(0)
    .feed(4)
    .cut();

  return esc.build();
}

function thermalLines(value: string, width: number): string[] {
  let text = value.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
  const rows: string[] = [];
  while (text.length > width) {
    let cut = text.lastIndexOf(' ', width); if (cut < 1) cut = width;
    rows.push(text.slice(0, cut)); text = text.slice(cut).trimStart();
  }
  if (text) rows.push(text); return rows;
}

