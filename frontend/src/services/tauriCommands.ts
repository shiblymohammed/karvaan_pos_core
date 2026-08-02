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
    console.warn('[Tauri] printReceipt: not in Tauri â€” falling back to window.print()');
    window.print();
    return 'Fallback: browser print dialog';
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
    const encoded = encoder.encode(str);
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
  items: { name: string; qty: number; notes?: string }[];
  time: string;
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
    .text('ITEM                    QTY')
    .newline()
    .bold(false)
    .separator();
  params.items.forEach(item => {
    const name = item.name.padEnd(24).substring(0, 24);
    esc.text(`${name}${item.qty}`).newline();
    if (item.notes) esc.text(`  ** ${item.notes}`).newline();
  });
  return esc.separator().feed(3).cut().build();
}

/**
 * Build a bill receipt for the customer
 */
export function buildBillReceipt(params: {
  restaurantName: string;
  billNumber: string;
  orderType: string;
  tableName?: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paymentMethod: string;
  cashier: string;
  time: string;
}): Uint8Array {
  const esc = new EscPos()
    .init()
    .align(1)
    .bold(true)
    .doubleSize(true)
    .text(params.restaurantName)
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

  if (params.tableName) {
    esc.text(`Table: ${params.tableName}`).newline();
  }

  esc
    .text(`Cashier: ${params.cashier}`)
    .newline()
    .separator()
    .bold(true)
    .text('ITEM                QTY   AMT')
    .newline()
    .bold(false)
    .separator();

  params.items.forEach(item => {
    const name = item.name.substring(0, 18).padEnd(18);
    const qty = String(item.qty).padStart(3);
    const amt = `${(item.qty * item.price).toFixed(0)}`.padStart(6);
    esc.text(`${name}${qty}${amt}`).newline();
  });

  esc
    .separator()
    .text(`${'Subtotal'.padEnd(24)}${params.subtotal.toFixed(2).padStart(8)}`)
    .newline();

  if (params.discount > 0) {
    esc.text(`${'Discount'.padEnd(24)}-${params.discount.toFixed(2).padStart(7)}`).newline();
  }

  esc
    .text(`${'GST (5%)'.padEnd(24)}${params.gst.toFixed(2).padStart(8)}`)
    .newline()
    .separator()
    .bold(true)
    .doubleSize(true)
    .text(`TOTAL   Rs.${params.grandTotal.toFixed(0)}`)
    .newline()
    .doubleSize(false)
    .bold(false)
    .text(`Payment: ${params.paymentMethod}`)
    .newline()
    .separator()
    .align(1)
    .text('Thank you! Visit again.')
    .newline()
    .align(0)
    .feed(4)
    .cut();

  return esc.build();
}

