import React, { useRef, useState } from 'react';
import { CheckCircle2, Printer, Share2, RotateCcw, X, Loader2 } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isTauri, printReceipt, buildBillReceipt, buildKotReceipt, printViaRawBT, isAndroid } from '../../services/tauriCommands';
import { isCapacitor, getSavedBtPrinter, getSavedBtKotPrinter, printViaBluetoothNative } from '../../services/bluetoothPrinter';
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
  variantId?: string;
  variantName?: string;
  variant?: string;
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
  customer?: any;
  customerName?: string;
  customerPhone?: string;
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
  const { receiptName = 'Karvaan POS', receiptAddress = '', receiptGstin = '', receiptLogo = '', receiptFooterNote = '' } = useSettingsStore();
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
  const isCapacitorApp = isCapacitor();
  const savedBtPrinter = getSavedBtPrinter();
  const isRawBTMode = !isTauri() && profile.useRawBT;
  const isMobileBtMode = (isCapacitorApp && !!savedBtPrinter) || isRawBTMode;

  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  const handlePrint = async (forceBrowser = false, forceRawBT = false) => {
    if (printing.current || (isReprint && (!reprintChecked || !reprintReason.trim()))) return;
    if (printJob && !isReprint && !forceBrowser && !forceRawBT && !isMobileBtMode) { window.dispatchEvent(new Event('karvaan-open-print-jobs')); return; }
    printing.current = true;
    setIsPrinting(true);
    const currentProfile = getPrinterProfile();
    const network = currentProfile.printers.find(printer => printer.id === (receiptType === 'KOT' ? currentProfile.kitchenPrinterId : currentProfile.receiptPrinterId));
    const lineItems = bill.items.map(item => ({ ...item, price: item.price + (item.addons?.reduce((sum, addon) => sum + addon.price, 0) || 0) }));
    const paperWidth = Number(network?.paperSize === '58mm' ? 58 : currentProfile.browserPaperWidth || 80);
    const bytes = receiptType === 'KOT'
      ? buildKotReceipt({
          orderNumber: bill.orderNumber || bill.billNumber,
          tableName: bill.table || 'Takeaway',
          orderType: orderType || 'DINE_IN',
          waiter: bill.waiter,
          items: lineItems.map(item => ({
            name: item.name,
            qty: item.quantity,
            notes: item.notes,
            addons: item.addons,
            variant: item.variantName || item.variant,
          })),
          time: `${bill.date || ''} ${bill.time || ''}`.trim() || new Date().toLocaleTimeString(),
          paperWidth,
        })
      : buildBillReceipt({
          restaurantName: receiptName,
          restaurantAddress: receiptAddress,
          gstin: receiptGstin,
          orderType: orderType || 'DINE_IN',
          billNumber: bill.billNumber,
          tableName: bill.table,
          cashier: bill.cashier || currentUser?.name || 'Staff',
          customerName: bill.customerName || bill.customer?.name,
          customerPhone: bill.customerPhone || bill.customer?.phone,
          items: lineItems.map(item => ({
            name: item.name,
            qty: item.quantity,
            price: item.price,
            notes: item.notes,
            addons: item.addons,
            variant: item.variantName || item.variant,
          })),
          subtotal: bill.subtotal,
          discount: bill.discount || 0,
          gst: bill.cgst + bill.sgst,
          grandTotal: bill.grandTotal,
          paymentMethod: bill.method,
          tenders: bill.tenders,
          deliveryFee: bill.deliveryFee,
          pendingConfirmation: bill.pendingConfirmation,
          paymentPending: bill.paymentPending,
          prebill: receiptType === 'PREBILL',
          reprint: isReprint,
          time: `${bill.date || ''} ${bill.time || ''}`.trim() || new Date().toLocaleTimeString(),
          paperWidth,
          footerNote: receiptFooterNote,
        });
    try {
      if (!forceBrowser && isCapacitorApp) {
        const kotPrinter = getSavedBtKotPrinter();
        const mainPrinter = getSavedBtPrinter();
        const target = (receiptType === 'KOT' && kotPrinter?.enabled && kotPrinter.address) ? kotPrinter : mainPrinter;
        if (target?.address) {
          await printViaBluetoothNative(bytes, target.address);
          toast.success(`${receiptType === 'KOT' ? 'Kitchen Ticket' : 'Receipt'} printed via Bluetooth (${target.name})`);
          return;
        }
      }
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
        {printJob && !isMobileBtMode && <p className="text-xs font-bold text-slate-600" role="status">{printStateLabel(printJob.state)}. Use Printing to check or recover this job.</p>}
        <div>
          <h3 className="font-extrabold text-lg text-pos-text">
            {isReprint ? 'Receipt copy' : bill.pendingConfirmation ? 'Saved on this device — awaiting confirmation' : bill.paymentPending ? 'Delivery dispatched — payment pending' : receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : receiptType === 'KOT' ? 'Kitchen Order Ticket' : 'Pre-Bill Preview'}
          </h3>
          <p className="text-xs font-bold text-pos-text-muted">
            {receiptType === 'KOT' ? 'Order: ' : receiptType === 'PREBILL' ? 'Pre-bill: ' : bill.paymentPending ? 'Dispatch: ' : 'Invoice: '} {receiptType === 'KOT' ? bill.orderNumber : bill.billNumber} • {bill.time}
          </p>
        </div>

        {/* Thermal Paper Preview */}
        <div ref={paper} className="w-full bg-white text-slate-900 font-mono text-left p-4 sm:p-5 rounded-2xl shadow-md text-xs space-y-2.5 border-t-4 border-slate-800">
          {/* Receipt Logo */}
          {receiptLogo && (
            <div className="text-center pb-1">
              <img src={receiptLogo} alt="Restaurant Logo" className="max-h-12 max-w-[150px] mx-auto object-contain" />
            </div>
          )}

          {/* Header Info */}
          <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
            <h4 className="font-black text-sm uppercase tracking-wide text-slate-900">{receiptName}</h4>
            {receiptAddress && <p className="text-[10px] text-slate-500 leading-tight">{receiptAddress}</p>}
            {receiptGstin && <p className="text-[10px] text-slate-500 font-semibold">GSTIN: {receiptGstin}</p>}
          </div>

          {/* Receipt Classification Badge */}
          <div className="text-center py-1">
            {receiptType === 'KOT' ? (
              <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider rounded">
                KITCHEN ORDER TICKET (KOT)
              </div>
            ) : receiptType === 'PREBILL' ? (
              <div className="inline-block px-3 py-1 bg-amber-500/15 text-amber-900 border border-amber-500/40 font-black text-[11px] uppercase tracking-wider rounded">
                *** PROVISIONAL PRE-BILL (UNPAID) ***
              </div>
            ) : isReprint ? (
              <div className="inline-block px-3 py-1 bg-rose-500/20 text-rose-900 border border-rose-500/40 font-black text-[11px] uppercase tracking-wider rounded">
                *** DUPLICATE / REPRINT ***
              </div>
            ) : (
              <div className="inline-block px-3 py-0.5 bg-emerald-500/15 text-emerald-900 font-black text-[11px] uppercase tracking-wider rounded">
                ─── TAX INVOICE ───
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="text-[11px] space-y-1 py-1.5 border-b border-dashed border-slate-300">
            <div className="flex justify-between font-bold">
              <span>{receiptType === 'KOT' ? 'Order' : receiptType === 'PREBILL' ? 'Pre-Bill' : 'Invoice'}: #{receiptType === 'KOT' ? bill.orderNumber : bill.billNumber}</span>
              <span>{bill.time}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Table: {bill.table || 'Takeaway'} {orderType ? `(${orderType})` : ''}</span>
              <span>{bill.date}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Cashier: {bill.cashier}</span>
              {bill.waiter && <span>Server: {bill.waiter}</span>}
            </div>
            {(bill.customerName || bill.customer?.name) && (
              <div className="text-slate-700 font-semibold">
                Customer: {bill.customerName || bill.customer?.name} {bill.customerPhone ? `(${bill.customerPhone})` : ''}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-1.5 py-2 border-b border-dashed border-slate-300">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-200">
              <span>Item &amp; Details</span>
              {receiptType !== 'KOT' && <span>Amount</span>}
            </div>
            {bill.items.map((item: any, idx: number) => {
              const addonPrice = item.addons?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
              const lineTotal = (item.price + addonPrice) * item.quantity;
              const variantLabel = item.variantName || item.variant;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                      {variantLabel && <span className="text-slate-500 font-normal"> ({variantLabel})</span>}
                    </span>
                    {receiptType !== 'KOT' && <span>₹{lineTotal.toFixed(2)}</span>}
                  </div>
                  {item.quantity > 1 && receiptType !== 'KOT' && (
                    <div className="text-[10px] text-slate-400 pl-2">
                      @ ₹{item.price.toFixed(2)} each
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[10px] font-black text-rose-600 pl-2 uppercase italic">
                      * Note: {item.notes}
                    </div>
                  )}
                  {item.addons && item.addons.map((addon: any, aIdx: number) => (
                    <div key={aIdx} className="flex justify-between text-[10px] text-emerald-600 pl-2">
                      <span>+ {addon.name}</span>
                      {receiptType !== 'KOT' && <span>(₹{addon.price * item.quantity})</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Totals & Calculations (Bills only, omitted on KOT) */}
          {receiptType !== 'KOT' && (
            <div className="space-y-1 pt-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold">₹{bill.subtotal.toFixed(2)}</span>
              </div>
              {!!bill.discount && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span className="font-bold">−₹{bill.discount.toFixed(2)}</span>
                </div>
              )}
              {(bill.cgst + bill.sgst) > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>CGST + SGST</span>
                  <span>₹{(bill.cgst + bill.sgst).toFixed(2)}</span>
                </div>
              )}
              {!!bill.deliveryFee && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Delivery / Surcharge</span>
                  <span>₹{bill.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black border-t-2 border-b-2 border-slate-900 py-1.5 mt-2 text-slate-900">
                <span>{receiptType === 'PREBILL' ? 'TOTAL PAYABLE' : 'GRAND TOTAL'}</span>
                <span>₹{bill.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="pt-1.5 text-[11px] border-b border-dashed border-slate-300 pb-2">
            {receiptType === 'PREBILL' ? (
              <div className="text-center font-black text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                STATUS: UNPAID (PRE-BILL)<br />
                <span className="text-[10px] font-medium text-amber-600">Please present this slip at counter for payment</span>
              </div>
            ) : receiptType === 'KOT' ? (
              <div className="text-center font-bold text-slate-600">
                Total Items: {bill.items.length} | Qty: {bill.items.reduce((s: number, i: any) => s + i.quantity, 0)}
              </div>
            ) : (
              <div>
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Payment Mode:</span>
                  <span className="uppercase">{bill.method || 'CASH'}</span>
                </div>
                {bill.method === 'SPLIT' && bill.tenders && (
                  <div className="space-y-0.5 mt-1 pl-2 border-l-2 border-emerald-500">
                    {Object.entries(bill.tenders as Record<string, number>)
                      .filter(([, amt]) => amt > 0)
                      .map(([method, amt]) => (
                        <div key={method} className="flex justify-between text-[10px] text-slate-600">
                          <span>{method}:</span>
                          <span>₹{amt.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-1 text-[10px] font-bold text-slate-400">
            <p>{receiptFooterNote || 'Thank you for visiting! Please visit us again.'}</p>
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
                : (printJob && !isMobileBtMode)
                ? 'Check Print Job'
                : isCapacitorApp && savedBtPrinter
                ? receiptType === 'KOT' ? 'Print KOT (Bluetooth)' : 'Print (Bluetooth)'
                : isRawBTMode
                ? receiptType === 'KOT' ? 'Print KOT (RawBT)' : 'Print (RawBT)'
                : 'Print Receipt'}
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
          {!isMobileBtMode && (
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
