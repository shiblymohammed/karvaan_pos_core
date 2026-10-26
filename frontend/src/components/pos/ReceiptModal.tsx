import React, { useRef, useState } from 'react';
import { CheckCircle2, Printer, Share2, RotateCcw, X, Loader2 } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isTauri, printReceipt, buildBillReceipt, buildKotReceipt, printViaRawBT, isAndroid } from '../../services/tauriCommands';
import { apiClient } from '../../services/apiClient';
import { getPrinterProfile, canBackendPrintLocally } from '../../services/printerProfile';
import { printNetworkReceipt } from '../../services/tauriCommands';
import { useSettingsStore } from '../../store/useSettingsStore';
import { createId } from '../../services/createId';
import { printStateLabel, usePrintQueue } from '../../services/printQueue';

interface ReceiptItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  addons?: { name: string; price: number }[];
}

interface BillData {
  billNumber: string;
  orderNumber: string;
  table: string;
  cashier: string;
  waiter: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  method: string;
  tenders?: Record<string, number>;
  time: string;
  date: string;
  deliveryFee?: number;
  customer?: string;
  pendingConfirmation?: boolean;
  paymentPending?: boolean;
  tableId?: string | null;
}

interface ReceiptModalProps {
  receiptType: 'CHECKOUT' | 'PREBILL' | 'KOT';
  bill: BillData;
  orderType: string;
  onClose: () => void;
  onReturn?: () => void;
  isReprint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptType, bill, orderType, onClose, onReturn, isReprint = false }) => {
  const { currentUser } = useAuthStore();
  const { receiptName = 'Karvaan POS', receiptAddress = '', receiptGstin = '' } = useSettingsStore();
  const [isPrinting, setIsPrinting] = useState(false);
  const printing = useRef(false);
  const [requestId] = useState(createId);
  const [reprintChecked, setReprintChecked] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const { data: printOverview, refresh } = usePrintQueue();
  const printJob = printOverview?.jobs.find(job => job.reference === bill.billNumber && ['RECEIPT', 'DISPATCH'].includes(job.kind));
  const paper = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const profile = getPrinterProfile();
  const isRawBTMode = !isTauri() && profile.useRawBT;

  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  const handlePrint = async (forceBrowser = false, forceRawBT = false) => {
    if (printing.current || (isReprint && (!reprintChecked || !reprintReason.trim()))) return;
    if (printJob && !isReprint && !forceBrowser && !forceRawBT) { window.dispatchEvent(new Event('karvaan-open-print-jobs')); return; }
    printing.current = true;
    setIsPrinting(true);
    const currentProfile = getPrinterProfile();
    const network = currentProfile.printers.find(printer => printer.id === (receiptType === 'KOT' ? currentProfile.kitchenPrinterId : currentProfile.receiptPrinterId));
    const lineItems = bill.items.map(item => ({ ...item, price: item.price + (item.addons?.reduce((sum, addon) => sum + addon.price, 0) || 0) }));
    const paperWidth = Number(network?.paperSize === '58mm' ? 58 : currentProfile.browserPaperWidth || 80);
    const bytes = receiptType === 'KOT'
      ? buildKotReceipt({ orderNumber: bill.orderNumber || bill.billNumber, tableName: bill.table, items: lineItems.map(item => ({ name: item.name, qty: item.quantity, notes: item.notes, addons: item.addons })), time: `${bill.date} ${bill.time}`, paperWidth })
      : buildBillReceipt({ restaurantName: receiptName, restaurantAddress: receiptAddress, gstin: receiptGstin, orderType, billNumber: bill.billNumber, tableName: bill.table, cashier: bill.cashier || currentUser?.name || 'Staff', items: lineItems.map(item => ({ name: item.name, qty: item.quantity, price: item.price, notes: item.notes, addons: item.addons })), subtotal: bill.subtotal, discount: bill.discount || 0, gst: bill.cgst + bill.sgst, grandTotal: bill.grandTotal, paymentMethod: bill.method, tenders: bill.tenders, deliveryFee: bill.deliveryFee, pendingConfirmation: bill.pendingConfirmation, paymentPending: bill.paymentPending, prebill: receiptType === 'PREBILL', reprint: isReprint, time: `${bill.date} ${bill.time}`, paperWidth });
    try {
      if (forceRawBT || (!forceBrowser && !isTauri() && currentProfile.useRawBT)) {
        printViaRawBT(bytes);
        toast.success('Sent to RawBT (Bluetooth printer)');
        return;
      }
      if (!forceBrowser && receiptType !== 'KOT') {
        const overview = await refresh();
        if (overview.destinations.some(destination => destination.role === 'RECEIPT')) {
          if (bill.pendingConfirmation) throw new Error('Wait for the server to confirm this bill before using automatic printing. A labelled browser copy is available.');
          const job = receiptType === 'PREBILL'
            ? await apiClient.post('/billing/print-prebill', { requestId, items: bill.items, orderType, tableId: bill.tableId, discount: bill.discount, deliveryFee: bill.deliveryFee })
            : await apiClient.post('/printer/queue/receipt', { requestId, billNumber: bill.billNumber, reprint: isReprint, confirmed: reprintChecked, reason: reprintReason });
          toast.info(printStateLabel(job.state) + '. Open Printing to review or request another copy.');
          await refresh(); return;
        }
      }
      if (!forceBrowser && isTauri() && network) await printNetworkReceipt(network.ip, Number(network.port || 9100), bytes);
      else if (!forceBrowser && isTauri() && currentProfile.receiptPort && receiptType !== 'KOT') await printReceipt(currentProfile.receiptPort, bytes);
      else if (!forceBrowser && network && canBackendPrintLocally()) {
        const result = await apiClient.post('/printer/print', { ip: network.ip, port: Number(network.port || 9100), type: receiptType === 'KOT' ? 'KOT' : 'RECEIPT', restaurantName: receiptName, orderNumber: bill.orderNumber || bill.billNumber, items: lineItems, grandTotal: bill.grandTotal, data: Array.from(bytes) });
        if (!result.success) throw new Error('The configured printer did not accept the receipt');
      } else {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
        document.body.appendChild(frame);
        const printed = frame.contentWindow!;
        const documentToPrint = printed.document;
        documentToPrint.open();
        // React escapes receipt values in the preview; print only that receipt.
        const width = currentProfile.browserPaperWidth === 58 ? 58 : 80;
        documentToPrint.write(`<!doctype html><html><head><title>Receipt</title><style>@page{size:${width}mm auto;margin:3mm}body{max-width:${width - 6}mm;margin:0 auto;color:#000;background:#fff;font:12px monospace;overflow-wrap:anywhere}.flex{display:flex}.justify-between{justify-content:space-between;gap:4px}.text-center{text-align:center}.font-bold,.font-black,.font-extrabold{font-weight:bold}.text-base{font-size:16px}.border-t,.border-b{border-bottom:1px dashed #000;padding:5px 0}p{margin:3px 0}</style></head><body>` + (forceBrowser ? '<p><strong>MANUAL COPY</strong></p>' : '') + (paper.current?.innerHTML || '') + '</body></html>');
        documentToPrint.close();
        printed.addEventListener('afterprint', () => frame.remove(), { once: true });
        printed.focus(); printed.print();
        setTimeout(() => frame.remove(), 120000);
        toast.info('Receipt print dialog opened for this device.'); return;
      }
      toast.success('Receipt sent to the configured printer.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Printer did not accept the receipt. Check the printer before retrying.'); }
    finally { printing.current = false; setIsPrinting(false); }
  };

  return (
    <div ref={dialog} tabIndex={-1} className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Receipt preview" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !isPrinting) onClose(); }}>
      <div className="bg-pos-card w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl border border-pos-border p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${receiptType === 'CHECKOUT' ? 'bg-pos-accent/10 text-emerald-500 border-pos-accent/30' : receiptType === 'KOT' ? 'bg-rose-100 text-rose-500 border-rose-300' : 'bg-pos-bg text-pos-text-muted border-pos-border'}`}>
          {receiptType === 'CHECKOUT' ? <CheckCircle2 className="h-7 w-7 shrink-0" /> : <Printer className="h-6 w-6 shrink-0" />}
        </div>
        {printJob && <p className="text-xs font-bold text-slate-600" role="status">{printStateLabel(printJob.state)}. Use Printing to check or recover this job.</p>}
        <div>
          <h3 className="font-extrabold text-lg text-pos-text">
            {isReprint ? 'Receipt copy' : bill.pendingConfirmation ? 'Saved on this device — awaiting confirmation' : bill.paymentPending ? 'Delivery dispatched — payment pending' : receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : receiptType === 'KOT' ? 'Kitchen Order Ticket' : 'Pre-Bill Preview'}
          </h3>
          <p className="text-xs font-bold text-pos-text-muted">
            {receiptType === 'KOT' ? 'Order: ' : receiptType === 'PREBILL' ? 'Pre-bill: ' : bill.paymentPending ? 'Dispatch: ' : 'Invoice: '} {receiptType === 'KOT' ? bill.orderNumber : bill.billNumber} • {bill.time}
          </p>
        </div>

        {/* Thermal Paper Preview */}
        <div ref={paper} className="w-full bg-pos-accent/5 text-pos-text font-mono text-left p-4 rounded-lg shadow-inner text-xs space-y-2 border-t-4 border-dashed border-pos-border">
          {isReprint && <p className="text-center font-bold">REPRINT</p>}
          <p className="text-center font-bold">{receiptType === 'KOT' ? `Kitchen ticket ${bill.orderNumber}` : `${receiptType === 'PREBILL' ? 'PRE-BILL — UNPAID' : bill.paymentPending ? 'Dispatch note — UNPAID' : 'Invoice'} ${bill.billNumber}`} · {bill.date} {bill.time}</p>
          {bill.pendingConfirmation && <p className="text-center font-bold">Awaiting server confirmation</p>}
          {bill.paymentPending && <p className="text-center font-bold">Payment pending</p>}
          <div className="text-center border-b border-pos-border pb-2">
            <p className="font-extrabold text-sm uppercase">{receiptName}</p>
            {receiptAddress && <p className="text-[10px] font-bold text-pos-text-muted">{receiptAddress}</p>}{receiptGstin && <p className="text-[10px] font-bold text-pos-text-muted">GSTIN: {receiptGstin}</p>}
            <p className="text-[10px] font-bold text-pos-text-muted">Table: {bill.table} | {bill.method === 'SPLIT' ? 'SPLIT PAYMENT' : `Method: ${bill.method}`}</p>
            <p className="text-[10px] font-bold text-pos-text-muted mt-1">Cashier: {bill.cashier} | Server: {bill.waiter}</p>
          </div>

          {/* Split payment breakdown */}
          {bill.method === 'SPLIT' && bill.tenders && (
            <div className="space-y-0.5 py-1 border-b border-pos-border">
              <p className="text-[10px] font-black uppercase text-pos-text-muted tracking-wide mb-1">Payment Breakdown:</p>
              {Object.entries(bill.tenders as Record<string, number>)
                .filter(([, amt]) => amt > 0)
                .map(([method, amt]) => (
                  <div key={method} className="flex justify-between text-[10px] font-bold">
                    <span>{method}:</span>
                    <span>₹{(amt as number).toFixed(2)}</span>
                  </div>
                ))
              }
            </div>
          )}

          <div className="space-y-1 py-1 border-b border-pos-border">
            {bill.items.map((item, idx) => {
              const addonPrice = item.addons?.reduce((sum, a) => sum + a.price, 0) || 0;
              const lineTotal = (item.price + addonPrice) * item.quantity;
              return (
                <div key={idx} className="flex flex-col">
                  <div className="flex justify-between font-bold">
                    <span>{item.name} x{item.quantity}</span>
                    {receiptType !== 'KOT' && <span>₹{lineTotal.toFixed(2)}</span>}
                  </div>
                  {item.notes && (
                    <div className="text-[10px] font-black text-rose-500 pl-2 uppercase italic">
                      * NOTE: {item.notes}
                    </div>
                  )}
                  {item.addons && Object.entries(
                    item.addons.reduce((acc: Record<string, { price: number; qty: number }>, addon) => {
                      acc[addon.name] = { price: addon.price, qty: (acc[addon.name]?.qty || 0) + 1 };
                      return acc;
                    }, {})
                  ).map(([name, data], aIdx) => (
                    <div key={aIdx} className="flex justify-between text-[10px] text-emerald-500 pl-2">
                      <span>{data.qty > 1 ? `${data.qty}x ` : '+ '}{name}</span>
                      {receiptType !== 'KOT' && <span>(₹{data.price * data.qty * item.quantity})</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {receiptType !== 'KOT' && (
            <div className="space-y-0.5 pt-1 font-bold">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-pos-text-muted">
                <span>CGST + SGST:</span>
                <span>₹{(bill.cgst + bill.sgst).toFixed(2)}</span>
              </div>
              {!!bill.discount && <div className="flex justify-between"><span>Discount:</span><span>−₹{bill.discount.toFixed(2)}</span></div>}
              {!!bill.deliveryFee && <div className="flex justify-between"><span>Delivery fee:</span><span>₹{bill.deliveryFee.toFixed(2)}</span></div>}
              <div className="flex justify-between text-base font-black border-t border-pos-border pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span>₹{bill.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="text-center pt-2 text-[10px] font-bold text-pos-text-muted border-t border-pos-border">
            <p>Thank you for visiting!</p>
          </div>
        </div>

        {isReprint && <div className="w-full text-left rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm"><label className="flex gap-2"><input type="checkbox" checked={reprintChecked} disabled={isPrinting} onChange={event => setReprintChecked(event.target.checked)} />I checked the paper and printer queue; another copy is needed.</label><label className="block">Reason<input className="border rounded-lg p-2 w-full" maxLength={500} value={reprintReason} disabled={isPrinting} onChange={event => setReprintReason(event.target.value)} /></label></div>}
        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => { void handlePrint(); }}
            disabled={isPrinting || (isReprint && (!reprintChecked || !reprintReason.trim()))}
            className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Printer className="h-4 w-4 shrink-0" />}
            <span>
              {isPrinting
                ? 'Sending…'
                : printJob
                ? 'Check Print Job'
                : receiptType === 'KOT'
                ? isRawBTMode ? 'Print KOT (RawBT)' : 'Print Kitchen Ticket'
                : receiptType === 'PREBILL'
                ? isRawBTMode ? 'Print Pre-bill (RawBT)' : 'Print Pre-bill'
                : isRawBTMode ? 'Print via RawBT' : 'Print Receipt'}
            </span>
          </button>
          <button
            onClick={() => {
              window.open(`https://wa.me/?text=Here is your Karvaan POS receipt #${bill.billNumber} for ₹${bill.grandTotal}. Thank you for visiting!`, '_blank');
            }}
            className="flex items-center justify-center gap-2 py-2.5 bg-pos-card hover:bg-pos-bg text-pos-text font-bold text-xs rounded-xl border border-pos-border transition-colors shadow-sm cursor-pointer"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span>WhatsApp</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-pos-text-muted">
          {!isRawBTMode && (
            <button
              disabled={isPrinting || (isReprint && (!reprintChecked || !reprintReason.trim()))}
              className="underline hover:text-pos-text disabled:opacity-40"
              onClick={() => { void handlePrint(false, true); }}
            >
              Print via RawBT
            </button>
          )}
          <button
            disabled={isPrinting || (isReprint && (!reprintChecked || !reprintReason.trim()))}
            className="underline hover:text-pos-text disabled:opacity-40"
            onClick={() => { void handlePrint(true); }}
          >
            Browser dialog
          </button>
        </div>
        {onReturn && receiptType === 'CHECKOUT' && !bill.pendingConfirmation && !bill.paymentPending && currentUser?.role !== 'WAITER' && (
          <button
            onClick={onReturn}
            className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-extrabold text-xs rounded-xl transition-colors border border-amber-500/30 cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Process Return / Refund</span>
          </button>
        )}

        <button
          onClick={onClose}
          disabled={isPrinting}
          className="w-full py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text-muted hover:text-pos-text text-xs font-extrabold rounded-xl transition-colors border border-pos-border cursor-pointer flex items-center justify-center gap-2"
        >
          <X className="h-4 w-4" />
          {isReprint ? 'Close Receipt' : receiptType === 'CHECKOUT' ? 'Start New Order' : 'Close Preview'}
        </button>
      </div>
    </div>
  );
};
