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
    // RawBT standard payload format for binary/ESC-POS is "base64,<payload>"
    // The Android Intent URL scheme is officially recommended for Android Chrome / PWAs
    // as Chrome natively handles intent:#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;
    const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    const directUrl = `rawbt:base64,${base64}`;

    const urlToUse = isAndroid() ? intentUrl : directUrl;

    try {
      window.location.href = urlToUse;
    } catch {
      // Fallback: create an anchor element and click it
      const link = document.createElement('a');
      link.href = urlToUse;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 1000);
    }
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
 * Format a line with left and right aligned text within a fixed column width
 */
function formatRow(left: string, right: string, width: number): string {
  const l = left.trim();
  const r = right.trim();
  const spaceNeeded = width - l.length - r.length;
  if (spaceNeeded >= 1) {
    return l + ' '.repeat(spaceNeeded) + r;
  }
  // If left string is too long, wrap it cleanly
  const maxLeft = Math.max(1, width - r.length - 1);
  return l.slice(0, maxLeft) + ' ' + r;
}

/**
 * Build a complete KOT (Kitchen Order Ticket) receipt
 */
export function buildKotReceipt(params: {
  orderNumber: string;
  tableName: string;
  items: { name: string; qty: number; notes?: string; addons?: { name: string }[]; variant?: string }[];
  time: string;
  paperWidth?: number;
  waiter?: string;
  orderType?: string;
}): Uint8Array {
  const width = params.paperWidth === 58 ? 32 : 48;
  const esc = new EscPos()
    .init()
    .align(1) // Center
    .separator('=', width)
    .bold(true)
    .doubleSize(true)
    .text('KITCHEN TICKET')
    .newline()
    .doubleSize(false)
    .bold(false)
    .separator('=', width)
    .align(0) // Left
    .bold(true)
    .text(formatRow(`Order: #${params.orderNumber}`, params.time.split(' ')[1] || params.time, width))
    .newline()
    .text(`Table: ${params.tableName || 'Takeaway'}${params.orderType ? ` (${params.orderType})` : ''}`)
    .newline();

  if (params.waiter) {
    esc.text(`Server: ${params.waiter}`).newline();
  }

  esc
    .bold(false)
    .separator('-', width)
    .bold(true)
    .text(formatRow('QTY  ITEM', 'NOTES', width))
    .newline()
    .bold(false)
    .separator('-', width);

  let totalQty = 0;
  params.items.forEach(item => {
    totalQty += item.qty;
    const variantTag = item.variant ? ` (${item.variant})` : '';
    const itemTitle = `[${item.qty}] ${item.name}${variantTag}`;

    esc.bold(true);
    thermalLines(itemTitle, width).forEach(line => esc.text(line).newline());
    esc.bold(false);

    for (const addon of item.addons || []) {
      thermalLines(`  + ${addon.name}`, width).forEach(line => esc.text(line).newline());
    }
    if (item.notes) {
      esc.bold(true);
      thermalLines(`  ** NOTE: ${item.notes}`, width).forEach(line => esc.text(line).newline());
      esc.bold(false);
    }
  });

  esc
    .separator('-', width)
    .text(formatRow(`Total Items: ${params.items.length}`, `Total Qty: ${totalQty}`, width))
    .newline()
    .separator('=', width)
    .align(1)
    .text('* RUSH PREPARATION *')
    .newline()
    .align(0)
    .feed(3)
    .cut();

  return esc.build();
}

/**
 * Build a formatted bill receipt for the customer (Paid Bill or Pre-Bill)
 */
export function buildBillReceipt(params: {
  restaurantName: string;
  restaurantAddress?: string;
  gstin?: string;
  billNumber: string;
  orderType: string;
  tableName?: string;
  items: { name: string; qty: number; price: number; notes?: string; addons?: { name: string }[]; variant?: string }[];
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
  customerName?: string;
  customerPhone?: string;
  time: string;
  prebill?: boolean;
  paperWidth?: number;
  reprint?: boolean;
  footerNote?: string;
}): Uint8Array {
  const width = params.paperWidth === 58 ? 32 : 48;
  const esc = new EscPos()
    .init()
    .align(1) // Center
    .separator('=', width)
    .bold(true)
    .doubleSize(true)
    .text(params.restaurantName || 'Karvaan POS')
    .newline()
    .doubleSize(false)
    .bold(false);

  if (params.restaurantAddress?.trim()) {
    thermalLines(params.restaurantAddress.trim(), width).forEach(line => esc.text(line).newline());
  }
  if (params.gstin?.trim()) {
    esc.text(`GSTIN: ${params.gstin.trim()}`).newline();
  }

  esc.separator('-', width);

  // Bill Type Badge
  if (params.prebill) {
    esc.bold(true).text('*** PROVISIONAL PRE-BILL ***').newline();
    esc.text('(PAYMENT PENDING)').newline().bold(false);
  } else if (params.reprint) {
    esc.bold(true).text('*** DUPLICATE / REPRINT ***').newline().bold(false);
  } else {
    esc.bold(true).text('TAX INVOICE').newline().bold(false);
  }

  esc.separator('-', width).align(0); // Left align

  const billPrefix = params.prebill ? 'Pre-Bill' : 'Invoice';
  esc.text(formatRow(`${billPrefix}: #${params.billNumber}`, params.time.split(' ')[1] || '', width)).newline();
  esc.text(`Date: ${params.time}`).newline();

  if (params.tableName) {
    esc.text(`Table: ${params.tableName} (${params.orderType})`).newline();
  } else {
    esc.text(`Type: ${params.orderType}`).newline();
  }

  if (params.customerName) {
    const custInfo = params.customerPhone ? `${params.customerName} (${params.customerPhone})` : params.customerName;
    esc.text(`Customer: ${custInfo}`).newline();
  }

  esc
    .text(`Cashier: ${params.cashier}`)
    .newline()
    .separator('-', width)
    .bold(true)
    .text(formatRow('ITEM', 'AMOUNT', width))
    .newline()
    .bold(false)
    .separator('-', width);

  params.items.forEach(item => {
    const itemTotal = (item.qty * item.price).toFixed(2);
    const variantTag = item.variant ? ` (${item.variant})` : '';
    const prefix = item.qty > 1 ? `${item.qty}x ` : '';
    const itemHeader = `${prefix}${item.name}${variantTag}`;

    if (itemHeader.length + itemTotal.length + 5 <= width) {
      esc.text(formatRow(itemHeader, `Rs.${itemTotal}`, width)).newline();
    } else {
      thermalLines(itemHeader, width).forEach(line => esc.text(line).newline());
      const subInfo = item.qty > 1 ? `  @ Rs.${item.price.toFixed(2)}` : '';
      esc.text(formatRow(subInfo, `Rs.${itemTotal}`, width)).newline();
    }

    for (const addon of item.addons || []) {
      thermalLines(`  + ${addon.name}`, width).forEach(line => esc.text(line).newline());
    }
    if (item.notes) {
      thermalLines(`  * ${item.notes}`, width).forEach(line => esc.text(line).newline());
    }
  });

  esc
    .separator('-', width)
    .text(formatRow('Subtotal', `Rs.${params.subtotal.toFixed(2)}`, width))
    .newline();

  if (params.discount > 0) {
    esc.text(formatRow('Discount', `-Rs.${params.discount.toFixed(2)}`, width)).newline();
  }

  if (params.gst > 0) {
    esc.text(formatRow('CGST + SGST', `Rs.${params.gst.toFixed(2)}`, width)).newline();
  }

  if (params.deliveryFee) {
    esc.text(formatRow('Delivery / Packaging', `Rs.${params.deliveryFee.toFixed(2)}`, width)).newline();
  }

  esc
    .separator('=', width)
    .bold(true)
    .text(formatRow(params.prebill ? 'TOTAL PAYABLE' : 'GRAND TOTAL', `Rs.${params.grandTotal.toFixed(2)}`, width))
    .newline()
    .bold(false)
    .separator('=', width);

  if (params.prebill) {
    esc.bold(true).text('Status: UNPAID (PRE-BILL)').newline().bold(false);
    esc.text('Please present this slip at counter').newline();
  } else {
    esc.text(formatRow('Payment Mode', params.paymentMethod || 'CASH', width)).newline();
    if (params.tenders) {
      for (const [method, amount] of Object.entries(params.tenders)) {
        if (amount > 0) {
          esc.text(formatRow(`  ${method}`, `Rs.${Number(amount).toFixed(2)}`, width)).newline();
        }
      }
    }
    if (params.pendingConfirmation) esc.text('* Awaiting Server Confirmation *').newline();
    if (params.paymentPending) esc.text('* Payment Pending *').newline();
  }

  esc
    .separator('-', width)
    .align(1)
    .text(params.footerNote || 'Thank you! Visit again.')
    .newline()
    .align(0)
    .feed(3)
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

