import { BadRequestException } from '@nestjs/common';

export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function billTotals(lines: any[], settings: any, data: any, tableId?: string) {
  const itemSubtotal = money(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
  const discount = data.discount ?? 0;
  if (!Number.isFinite(discount) || discount < 0 || discount > itemSubtotal) throw new BadRequestException('Invalid discount');
  const tableConfig = settings.tableConfig?.find((t: any) => t.id === tableId);
  const floor = settings.floorConfig?.find((f: any) => f.id === tableConfig?.floorId);
  const surcharge = floor ? money(floor.surchargeType === 'PERCENTAGE' ? itemSubtotal * floor.surchargeValue / 100 : floor.surchargeValue) : 0;
  const packaging = data.orderType === 'PARCEL' ? settings.parcelChargeAmount || 0 : 0;
  const deliveryFee = data.orderType === 'DELIVERY' ? data.deliveryFee ?? 0 : 0;
  if (![surcharge, packaging, deliveryFee].every(v => Number.isFinite(v) && v >= 0)) throw new BadRequestException('Invalid service charge');
  const subtotal = money(itemSubtotal + surcharge + packaging);
  const tax = money(lines.reduce((sum, line) => sum + line.price * line.quantity * (1 - discount / (itemSubtotal || 1)) * line.product.gstRate / 100, 0) + (surcharge + packaging) * 0.05);
  const cgst = money(tax / 2), sgst = money(tax - cgst);
  const grandTotal = money(subtotal - discount + tax + deliveryFee);
  if (data.grandTotal !== undefined && (!Number.isFinite(data.grandTotal) || Math.abs(data.grandTotal - grandTotal) > 0.02)) throw new BadRequestException('Prices or charges have changed; review the cart before checkout');
  return { itemSubtotal, discount, surcharge, packaging, deliveryFee, subtotal, cgst, sgst, grandTotal };
}
export function readJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export function paymentAllocation(data: any, total: number): Record<string, number> {
  const method = data.method || data.paymentMethod || 'CASH';
  if (!['CASH', 'CARD', 'UPI', 'CREDIT', 'SPLIT'].includes(method)) throw new BadRequestException('Invalid payment method');
  if (!data.tenders) {
    if (method === 'SPLIT') throw new BadRequestException('Split payments require individual tender amounts');
    return { [method]: total };
  }
  if (typeof data.tenders !== 'object' || Array.isArray(data.tenders)) throw new BadRequestException('Invalid payment allocation');
  const tenders: Record<string, number> = {};
  for (const [key, value] of Object.entries(data.tenders)) {
    if (!['CASH', 'CARD', 'UPI', 'CREDIT'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new BadRequestException('Invalid payment allocation');
    if (value > 0) tenders[key] = money(value);
  }
  const sum = money(Object.values(tenders).reduce((a, b) => a + b, 0));
  if (sum + 0.005 < total) throw new BadRequestException('Insufficient payment');
  const excess = money(sum - total);
  if (excess > (tenders.CASH || 0) + 0.005) throw new BadRequestException('Only cash can include change');
  if (excess > 0) tenders.CASH = money((tenders.CASH || 0) - excess);
  if ((tenders.CREDIT || 0) > total) throw new BadRequestException('Credit cannot exceed the bill');
  return Object.fromEntries(Object.entries(tenders).filter(([, value]) => value > 0));
}

export async function ledgerView(db: any, restaurantId: string) {
  const rows = await db.ledgerEntry.findMany({ where: { customer: { restaurantId }, type: { in: ['CREDIT', 'REFUND'] } }, include: { customer: true }, orderBy: { createdAt: 'desc' } });
  return rows.map((row: any) => ({
    id: row.id, customerId: row.customerId, customerName: row.customerName,
    customerPhone: row.customer.mobile, amount: row.type === 'CREDIT' && row.amount - row.settledAmount > 0.005 ? money(row.amount - row.settledAmount) : row.type === 'REFUND' ? -money(Math.max(0, -row.amount - row.settledAmount)) : row.amount,
    originalAmount: row.amount, paidAmount: row.settledAmount, billNumber: row.billNumber,
    date: row.createdAt.toISOString(), status: (row.type === 'CREDIT' ? row.amount : -row.amount) - row.settledAmount <= 0.005 ? 'PAID' : 'UNPAID',
  }));
}

export function itemSignature(item: any) {
  const addons = typeof item.addons === 'string' ? readJson<any[]>(item.addons, []) : item.addons || [];
  return `${item.productId}\u0000${addons.map((a: any) => a.id).sort().join(',')}`;
}

export function ensurePersistedItemsPresent(saved: any[], incoming: any[]) {
  const counts = new Map<string, number>();
  for (const item of incoming) counts.set(itemSignature(item), (counts.get(itemSignature(item)) || 0) + item.quantity);
  for (const item of saved) {
    const key = itemSignature(item);
    const remaining = (counts.get(key) || 0) - item.quantity;
    if (remaining < 0) throw new BadRequestException('This order has changed on another terminal. Reload the latest order before payment; already-sent items need an authorized void.');
    counts.set(key, remaining);
  }
}

export async function financialSummary(db: any, restaurantId: string, start: Date, end: Date) {
  const [bills, refunds, repayments] = await Promise.all([
    db.bill.findMany({ where: { restaurantId, settledAt: { gte: start, lte: end } } }),
    db.returnRecord.findMany({ where: { restaurantId, createdAt: { gte: start, lte: end } } }),
    db.ledgerEntry.findMany({ where: { type: 'PAYMENT', customer: { restaurantId }, createdAt: { gte: start, lte: end } } }),
  ]);
  const byPayment: Record<string, number> = {};
  for (const bill of bills) for (const [method, amount] of Object.entries(readJson<Record<string, number>>(bill.tenders, { [bill.paymentMethod]: bill.grandTotal }))) byPayment[method] = money((byPayment[method] || 0) + amount);
  for (const row of refunds) { const method = row.refundDest === 'LEDGER' ? 'CREDIT' : row.refundDest; byPayment[method] = money((byPayment[method] || 0) - row.totalRefund); }
  const collections = { ...byPayment };
  for (const row of repayments) if (row.paymentMethod) collections[row.paymentMethod] = money((collections[row.paymentMethod] || 0) - row.amount);
  const refundTotal = money(refunds.reduce((sum, row) => sum + row.totalRefund, 0));
  const grossRevenue = money(bills.reduce((sum, row) => sum + row.grandTotal, 0));
  return { byPayment, collections, grossRevenue, refundTotal, netRevenue: money(grossRevenue - refundTotal), refundGst: money(refunds.reduce((sum, row) => sum + row.cgst + row.sgst, 0)), repayments: money(repayments.reduce((sum, row) => sum - row.amount, 0)) };
}

export function immutableHistoryBill(bill: any) {
  const snapshots = readJson<any[] | null>(bill.invoiceItems, null);
  return snapshots && bill.order ? { ...bill, order: { ...bill.order, items: snapshots.map(line => ({ ...line, product: { id: line.productId, name: line.name } })) } } : bill;
}
