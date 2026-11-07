import { receiptLogoBytes } from './receipt-logo';
/** Immutable receipt data shared by automatic jobs and marked reprints. Prices include add-ons. */
export interface PrintDocument {
  kind: 'KOT' | 'RECEIPT' | 'PREBILL' | 'DISPATCH' | 'TEST';
  reference: string;
  restaurantName?: string;
  receiptLogo?: string;
  address?: string;
  phone?: string;
  footerNote?: string;
  kitchenCopy?: PrintDocument;
  gstin?: string;
  orderNumber?: string;
  orderType?: string;
  table?: string;
  cashier?: string;
  customer?: string;
  createdAt: string;
  items: { name: string; quantity: number; price?: number; notes?: string; variant?: string; addons?: { name: string }[] }[];
  subtotal?: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  deliveryFee?: number;
  grandTotal?: number;
  paymentMethod?: string;
  tenders?: Record<string, number>;
  reprint?: boolean;
}

// Strip ESC/POS/control characters supplied in names or notes, without truncating instructions.
export function printText(value: unknown): string {
  return String(value ?? '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').trim();
}
export function kitchenSignature(item: any): string {
  let addons = item.addons || [];
  if (typeof addons === 'string') { try { addons = JSON.parse(addons); } catch { addons = []; } }
  return JSON.stringify([item.productId, String(item.notes || '').trim(), addons.map((a: any) => a.id).sort(), item.variant || item.variantName || '']);
}
export function wrapPrintText(value: unknown, width: number): string[] {
  let remaining = printText(value);
  const rows: string[] = [];
  while (remaining.length > width) {
    let cut = remaining.lastIndexOf(' ', width);
    if (cut <= 0) cut = width;
    rows.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) rows.push(remaining);
  return rows;
}
export function renderPrintDocument(doc: PrintDocument, paperWidth: number): Buffer {
  const width = paperWidth === 58 ? 32 : 48;
  const rows: string[] = [];
  const line = (text: unknown) => rows.push(...wrapPrintText(text, width));
  const center = (text: unknown) => wrapPrintText(text, width).forEach(row => rows.push(' '.repeat(Math.max(0, Math.floor((width - row.length) / 2))) + row));
  const money = (label: string, value: number | undefined) => {
    const amount = Number(value || 0).toFixed(2);
    rows.push(label + ' '.repeat(Math.max(1, width - label.length - amount.length)) + amount);
  };
  if (doc.reprint) line('*** REPRINT ***');
  center(doc.restaurantName || 'Karvaan POS');
  if (doc.kind !== 'KOT') {
    if (doc.address) center(doc.address);
    if (doc.phone) center(`Tel: ${doc.phone}`);
    if (doc.gstin) center(`GSTIN: ${doc.gstin}`);
  }
  line('='.repeat(width));
  center(doc.kind === 'PREBILL' ? 'PRE-BILL - UNPAID' : doc.kind === 'DISPATCH' ? 'DISPATCH - PAYMENT PENDING' : doc.kind === 'KOT' ? 'KITCHEN TICKET' : doc.kind === 'TEST' ? 'PRINTER TEST - NOT A SALE' : 'CUSTOMER RECEIPT');
  line('='.repeat(width));
  line(`Reference: ${doc.reference}`);
  if (doc.orderNumber && doc.orderNumber !== doc.reference) line(`Order: ${doc.orderNumber}`);
  line(new Date(doc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }));
  if (doc.orderType) line(doc.orderType);
  if (doc.table) line(`Table: ${doc.table}`);
  if (doc.cashier) line(`Staff: ${doc.cashier}`);
  if (doc.customer) line(`Customer: ${doc.customer}`);
  line('-'.repeat(width));
  if (doc.kind !== 'KOT') {
    rows.push('ITEM'.padEnd(width - 10) + 'AMOUNT'.padStart(10));
    line('-'.repeat(width));
  }
  for (const item of doc.items) {
    line(`${item.quantity} x ${item.name}${item.variant ? ` (${item.variant})` : ''}`);
    if (doc.kind !== 'KOT') money(`  @ ${Number(item.price || 0).toFixed(2)}`, Number(item.price || 0) * item.quantity);
    for (const addon of item.addons || []) line(`  + ${addon.name}`);
    if (item.notes) line(`  NOTE: ${item.notes}`);
  }
  line('-'.repeat(width));
  if (!['KOT', 'TEST'].includes(doc.kind)) {
    money('Subtotal Rs.', doc.subtotal);
    if (doc.discount) money('Discount Rs.', -doc.discount);
    money('CGST Rs.', doc.cgst); money('SGST Rs.', doc.sgst);
    if (doc.deliveryFee) money('Delivery Rs.', doc.deliveryFee);
    money('TOTAL Rs.', doc.grandTotal);
    if (doc.paymentMethod) line(`Payment: ${doc.paymentMethod}`);
    for (const [method, value] of Object.entries(doc.tenders || {})) if (value > 0) money(method, value);
    if (doc.kind === 'RECEIPT') line(Number(doc.tenders?.CREDIT || 0) > 0 || doc.paymentMethod === 'CREDIT' ? 'CREDIT - BALANCE DUE' : 'PAID');
    line('-'.repeat(width));
    line(doc.footerNote || 'Thank you for visiting!');
  } else if (doc.kind === 'KOT') {
    line(`Total quantity: ${doc.items.reduce((sum, item) => sum + item.quantity, 0)}`);
  }
  // UTF-8 requires compatible printer firmware; other scripts can use the browser/driver fallback.
  const logo = doc.kind !== 'KOT' ? receiptLogoBytes(doc.receiptLogo) : Buffer.alloc(0);
  const receipt = Buffer.concat([Buffer.from([0x1b, 0x40]), ...(logo.length ? [Buffer.from([0x1b, 0x61, 1]), logo, Buffer.from([0x0a, 0x1b, 0x61, 0])] : []), Buffer.from(rows.join('\n') + '\n\n\n\n', 'utf8'), Buffer.from([0x1d, 0x56, 0x00])]);
  // One job and one connection: customer copy, cut, then only the newly sent kitchen items.
  return doc.kind === 'RECEIPT' && doc.kitchenCopy?.kind === 'KOT' && doc.kitchenCopy.items.length
    ? Buffer.concat([receipt, renderPrintDocument({ ...doc.kitchenCopy, kitchenCopy: undefined, reprint: doc.reprint }, paperWidth)])
    : receipt;
}
