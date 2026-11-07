import React from 'react';
import { waitForReceiptImages } from '../services/receiptLogo';

export type PrintLayoutKind = 'RECEIPT' | 'PREBILL' | 'KOT' | 'CUP' | 'BAG' | 'DISPATCH';
export const PRINT_LAYOUTS: { id: PrintLayoutKind; name: string; description: string }[] = [
  { id: 'RECEIPT', name: 'Customer bill', description: 'Itemised receipt with totals and payment status.' },
  { id: 'PREBILL', name: 'Pre-bill', description: 'An estimate clearly marked unpaid.' },
  { id: 'KOT', name: 'Kitchen ticket', description: 'Bold quantities, sizes, modifiers and preparation notes.' },
  { id: 'CUP', name: 'Cup / item label', description: 'Order number, item, size and special instructions.' },
  { id: 'BAG', name: 'Delivery bag label', description: 'Customer, order number and packing checklist.' },
  { id: 'DISPATCH', name: 'Dispatch slip', description: 'Order details with payment collection status.' },
];
export interface PrintBranding { receiptName: string; receiptAddress: string; receiptPhone: string; receiptLogo: string; receiptGstin: string; receiptFooterNote: string; }
export function PrintLayoutPreview({ kind, branding, sample = true }: { kind: PrintLayoutKind; branding: PrintBranding; sample?: boolean }) {
  const kitchen = kind === 'KOT';
  const label = kind === 'CUP' || kind === 'BAG';
  const titles = { RECEIPT: 'CUSTOMER RECEIPT', PREBILL: 'PRE-BILL · UNPAID', KOT: 'KITCHEN TICKET', CUP: 'ITEM LABEL', BAG: 'PACKING CHECKLIST', DISPATCH: 'DISPATCH · PAYMENT PENDING' };
  return <article aria-label={`${PRINT_LAYOUTS.find(layout => layout.id === kind)?.name} preview`} style={{ color: '#111', background: '#fff', font: '12px/1.5 ui-monospace, monospace', padding: 18, overflowWrap: 'anywhere', textAlign: 'left' }}>
    <header style={{ textAlign: 'center', borderBottom: '1px dashed #111', paddingBottom: 12, marginBottom: 12 }}>
      {!kitchen && branding.receiptLogo && <img src={branding.receiptLogo} alt="Restaurant logo" style={{ display: 'block', maxWidth: 180, maxHeight: 90, margin: '0 auto 10px', objectFit: 'contain' }} />}
      <strong style={{ display: 'block', fontSize: 18 }}>{branding.receiptName || 'Your restaurant'}</strong>
      {!label && !kitchen && <>{branding.receiptAddress && <div style={{ whiteSpace: 'pre-line' }}>{branding.receiptAddress}</div>}{branding.receiptPhone && <div>Tel: {branding.receiptPhone}</div>}{branding.receiptGstin && <div>GSTIN: {branding.receiptGstin}</div>}</>}
      <h3 style={{ fontSize: kitchen ? 20 : 13, margin: '12px 0 0', letterSpacing: 1 }}>{titles[kind]}</h3>
      {sample && <small>SAMPLE · NOT A SALE</small>}
    </header>
    <div><strong>{kind === 'RECEIPT' || kind === 'PREBILL' ? 'Bill: INV-0104' : 'Order: #0104'}</strong></div>
    <div>Table: Counter · Takeaway</div><div>07 Nov 2026 · 10:30 AM</div>
    {kind === 'BAG' && <p>Customer: Sample customer<br />Phone: 000 000 0000</p>}
    <section style={{ borderTop: '1px dashed #111', borderBottom: '1px dashed #111', marginTop: 12, padding: '10px 0' }}>
      {kind === 'CUP' ? <><strong style={{ fontSize: 18 }}>1 × Cappuccino</strong><div>Large · Oat milk</div><strong>NOTE: No sugar</strong></> : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}><span>{label ? 'PACKED / ITEM' : 'QTY / ITEM'}</span>{!kitchen && !label && <span>AMOUNT</span>}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{kind === 'BAG' ? '☐' : '2 ×'} Cappuccino (Large)</strong>{!kitchen && !label && <span>240.00</span>}</div>
        {!kitchen && !label && <div>2 @ 120.00</div>}<div>+ Oat milk</div><div>NOTE: No sugar</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}><strong>{kind === 'BAG' ? '☐' : '1 ×'} Veg sandwich</strong>{!kitchen && !label && <span>100.00</span>}</div>
      </>}
    </section>
    {!kitchen && !label && <section style={{ paddingTop: 10 }}>
      {[['Subtotal', '340.00'], ['Discount', '-20.00'], ['CGST', '8.00'], ['SGST', '8.00']].map(([name, amount]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{name}</span><span>{amount}</span></div>)}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #111', borderBottom: '2px solid #111', margin: '8px 0', padding: '8px 0', fontSize: 17, fontWeight: 800 }}><span>TOTAL</span><span>336.00</span></div>
      <strong>{kind === 'RECEIPT' ? 'PAID · CASH' : 'PAYMENT PENDING'}</strong>
    </section>}
    {kitchen && <p><strong>Total quantity: 3</strong><br />Prepared by: __________________</p>}
    {kind === 'BAG' && <p>☐ Items checked &nbsp; ☐ Cutlery<br />Packed by: __________________</p>}
    {!kitchen && <footer style={{ textAlign: 'center', marginTop: 14 }}>{branding.receiptFooterNote || 'Thank you for visiting!'}</footer>}
  </article>;
}

export async function printLayoutSample(element: HTMLElement, width: 58 | 80, title = 'Sample print layout') {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(frame);
  const printed = frame.contentWindow;
  if (!printed) { frame.remove(); throw new Error('Unable to open print preview.'); }
  printed.document.open();
  printed.document.write(`<!doctype html><html><head><title></title><style>@page{size:${width}mm auto;margin:2mm}body{margin:0}article{padding:2mm!important}img{max-width:100%}</style></head><body>${element.innerHTML}</body></html>`);
  printed.document.title = title;
  printed.document.close();
  try { await waitForReceiptImages(printed.document); printed.focus(); printed.print(); } catch (error) { frame.remove(); throw error; }
  printed.addEventListener('afterprint', () => frame.remove(), { once: true });
  setTimeout(() => frame.remove(), 120000);
}
