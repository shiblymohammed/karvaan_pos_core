import React, { useRef, useState } from 'react';
import { CheckCircle2, Printer, Share2, RotateCcw, X, Loader2 } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isTauri, listSerialPorts, printReceipt, buildBillReceipt, buildKotReceipt } from '../../services/tauriCommands';
import { apiClient } from '../../services/apiClient';
import { getPrinterProfile, canBackendPrintLocally } from '../../services/printerProfile';
import { printNetworkReceipt } from '../../services/tauriCommands';
import { useSettingsStore } from '../../store/useSettingsStore';

interface ReceiptItem {
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
}

interface ReceiptModalProps {
  receiptType: 'CHECKOUT' | 'PREBILL' | 'KOT';
  bill: BillData;
  orderType: string;
  onClose: () => void;
  onReturn: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptType, bill, orderType, onClose, onReturn }) => {
  const { currentUser } = useAuthStore();
  const { receiptName = 'Karvaan POS', receiptAddress = '', receiptGstin = '' } = useSettingsStore();
  const [isPrinting, setIsPrinting] = useState(false);
  const paper = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    const profile = getPrinterProfile();
    const network = profile.printers.find(printer => printer.id === (receiptType === 'KOT' ? profile.kitchenPrinterId : profile.receiptPrinterId));
    const lineItems = bill.items.map(item => ({ ...item, price: item.price + (item.addons?.reduce((sum, addon) => sum + addon.price, 0) || 0) }));
    const bytes = receiptType === 'KOT'
      ? buildKotReceipt({ orderNumber: bill.orderNumber || bill.billNumber, tableName: bill.table, items: lineItems.map(item => ({ name: item.name, qty: item.quantity, notes: item.notes })), time: bill.time })
      : buildBillReceipt({ restaurantName: receiptName, restaurantAddress: receiptAddress, gstin: receiptGstin, orderType, billNumber: bill.billNumber, tableName: bill.table, cashier: bill.cashier || currentUser?.name || 'Staff', items: lineItems.map(item => ({ name: item.name, qty: item.quantity, price: item.price, notes: item.notes })), subtotal: bill.subtotal, discount: bill.discount || 0, gst: bill.cgst + bill.sgst, grandTotal: bill.grandTotal, paymentMethod: bill.method, tenders: bill.tenders, deliveryFee: bill.deliveryFee, pendingConfirmation: bill.pendingConfirmation, paymentPending: bill.paymentPending, time: bill.time });
    try {
      if (isTauri() && network) await printNetworkReceipt(network.ip, Number(network.port || 9100), bytes);
      else if (isTauri() && profile.receiptPort) await printReceipt(profile.receiptPort, bytes);
      else if (network && canBackendPrintLocally()) {
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
        documentToPrint.write('<!doctype html><html><head><title>Receipt</title><style>@page{margin:5mm}body{max-width:72mm;margin:0 auto;color:#000;background:#fff;font:12px monospace}.flex{display:flex}.justify-between{justify-content:space-between}.text-center{text-align:center}.font-bold,.font-black,.font-extrabold{font-weight:bold}.text-base{font-size:16px}.border-t,.border-b{border-bottom:1px dashed #000;padding:5px 0}p{margin:3px 0}</style></head><body>' + (paper.current?.innerHTML || '') + '</body></html>');
        documentToPrint.close();
        printed.addEventListener('afterprint', () => frame.remove(), { once: true });
        printed.focus(); printed.print();
        setTimeout(() => frame.remove(), 120000);
        toast.info('Receipt print dialog opened for this device.'); return;
      }
      toast.success('Receipt sent to the configured printer.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Printer did not accept the receipt. Check the printer before retrying.'); }
    finally { setIsPrinting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-pos-card w-full max-w-sm rounded-2xl border border-pos-border p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${receiptType === 'CHECKOUT' ? 'bg-pos-accent/10 text-emerald-500 border-pos-accent/30' : receiptType === 'KOT' ? 'bg-rose-100 text-rose-500 border-rose-300' : 'bg-pos-bg text-pos-text-muted border-pos-border'}`}>
          {receiptType === 'CHECKOUT' ? <CheckCircle2 className="h-7 w-7 shrink-0" /> : <Printer className="h-6 w-6 shrink-0" />}
        </div>
        <div>
          <h3 className="font-extrabold text-lg text-pos-text">
            {bill.pendingConfirmation ? 'Saved on this device — awaiting confirmation' : bill.paymentPending ? 'Delivery dispatched — payment pending' : receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : receiptType === 'KOT' ? 'Kitchen Order Ticket' : 'Pre-Bill Preview'}
          </h3>
          <p className="text-xs font-bold text-pos-text-muted">
            {receiptType === 'KOT' ? 'Order: ' : 'Invoice: '} {receiptType === 'KOT' ? bill.orderNumber : bill.billNumber} • {bill.time}
          </p>
        </div>

        {/* Thermal Paper Preview */}
        <div ref={paper} className="w-full bg-pos-accent/5 text-pos-text font-mono text-left p-4 rounded-lg shadow-inner text-xs space-y-2 border-t-4 border-dashed border-pos-border">
          <p className="text-center font-bold">{receiptType === 'KOT' ? `Kitchen ticket ${bill.orderNumber}` : `${receiptType === 'PREBILL' ? 'Pre-bill' : 'Invoice'} ${bill.billNumber}`} · {bill.date} {bill.time}</p>
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

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Printer className="h-4 w-4 shrink-0" />}
            <span>{isPrinting ? 'Printing...' : 'Confirm & Print'}</span>
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

        {currentUser?.role !== 'WAITER' && (
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
          className="w-full py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text-muted hover:text-pos-text text-xs font-extrabold rounded-xl transition-colors border border-pos-border cursor-pointer flex items-center justify-center gap-2"
        >
          <X className="h-4 w-4" />
          {receiptType === 'CHECKOUT' ? 'Start New Order' : 'Close Preview'}
        </button>
      </div>
    </div>
  );
};
