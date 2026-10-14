import React, { useState } from 'react';
import { CheckCircle2, Printer, Share2, RotateCcw, X, Loader2 } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { isTauri, listSerialPorts, printReceipt, buildBillReceipt, buildKotReceipt } from '../../services/tauriCommands';
import { apiClient } from '../../services/apiClient';

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
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    let printed = false;

    // 1. If in Tauri desktop app, attempt hardware serial / USB ESC/POS printing
    if (isTauri()) {
      try {
        const ports = await listSerialPorts();
        if (ports && ports.length > 0) {
          const bytes = receiptType === 'KOT'
            ? buildKotReceipt({
                orderNumber: bill.orderNumber || bill.billNumber,
                tableName: bill.table || 'Counter',
                items: bill.items.map(i => ({ name: i.name, qty: i.quantity, notes: i.notes })),
                time: bill.time,
              })
            : buildBillReceipt({
                restaurantName: 'Karvaan POS',
                orderType: bill.table || orderType || 'Dine-In',
                billNumber: bill.billNumber,
                tableName: bill.table,
                cashier: bill.cashier || currentUser?.name || 'Staff',
                items: bill.items.map(i => ({ name: i.name, qty: i.quantity, price: i.price, notes: i.notes })),
                subtotal: bill.subtotal,
                discount: bill.discount || 0,
                gst: bill.cgst + bill.sgst,
                grandTotal: bill.grandTotal,
                paymentMethod: bill.method || 'CASH',
                time: bill.time,
              });
          await printReceipt(ports[0], bytes);
          toast.success(`🖨️ Thermal receipt printed via ${ports[0]}`);
          printed = true;
        }
      } catch (err) {
        console.warn('Tauri printer error:', err);
      }
    }

    // 2. Attempt network ESC/POS thermal printing via backend printer service
    if (!printed) {
      try {
        const res = await apiClient.post('/printer/print', {
          ip: '127.0.0.1',
          port: 9100,
          type: receiptType === 'KOT' ? 'KOT' : 'RECEIPT',
          restaurantName: 'Karvaan POS',
          orderNumber: bill.orderNumber || bill.billNumber,
          items: bill.items,
          grandTotal: bill.grandTotal,
        });
        if (res.data?.success) {
          toast.success('🖨️ Receipt sent to thermal printer');
          printed = true;
        }
      } catch {
        // Fallback continues
      }
    }

    // 3. Fallback to standard browser print
    if (!printed) {
      window.print();
      toast.info('🖨️ Standard print dialog opened');
    }

    setIsPrinting(false);
    if (receiptType === 'PREBILL') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-pos-card w-full max-w-sm rounded-2xl border border-pos-border p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${receiptType === 'CHECKOUT' ? 'bg-pos-accent/10 text-emerald-500 border-pos-accent/30' : receiptType === 'KOT' ? 'bg-rose-100 text-rose-500 border-rose-300' : 'bg-pos-bg text-pos-text-muted border-pos-border'}`}>
          {receiptType === 'CHECKOUT' ? <CheckCircle2 className="h-7 w-7 shrink-0" /> : <Printer className="h-6 w-6 shrink-0" />}
        </div>
        <div>
          <h3 className="font-extrabold text-lg text-pos-text">
            {receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : receiptType === 'KOT' ? 'Kitchen Order Ticket' : 'Pre-Bill Preview'}
          </h3>
          <p className="text-xs font-bold text-pos-text-muted">
            {receiptType === 'KOT' ? 'Order: ' : 'Invoice: '} {receiptType === 'KOT' ? bill.orderNumber : bill.billNumber} • {bill.time}
          </p>
        </div>

        {/* Thermal Paper Preview */}
        <div className="w-full bg-pos-accent/5 text-pos-text font-mono text-left p-4 rounded-lg shadow-inner text-xs space-y-2 border-t-4 border-dashed border-pos-border">
          <div className="text-center border-b border-pos-border pb-2">
            <p className="font-extrabold text-sm uppercase">★ KARVAAN BISTRO & CAFE ★</p>
            <p className="text-[10px] font-bold text-pos-text-muted">GSTIN: 27AADCK1234F1Z9</p>
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
                <span>CGST + SGST (5%):</span>
                <span>₹{(bill.cgst + bill.sgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black border-t border-pos-border pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span>₹{bill.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="text-center pt-2 text-[10px] font-bold text-pos-text-muted border-t border-pos-border">
            <p>Thank you for dining with Karvaan!</p>
            <p>Scan QR on table for digital loyalty points.</p>
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
