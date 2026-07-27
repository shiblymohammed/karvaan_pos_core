import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, Package, Trash2, AlertTriangle, CheckCircle2, 
  DollarSign, X, ShieldAlert, CreditCard, Banknote, BookOpen,
  ArrowRight, Bike, Utensils, ShoppingBag, Plus, Minus
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { useLedgerStore } from '../store/useLedgerStore';

export interface ReturnItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReturnOrderData {
  orderId?: string;
  billNumber?: string;
  orderType?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReturnItem[];
  grandTotal?: number;
  paymentMethod?: string;
}

interface ReturnOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: ReturnOrderData | null;
  onConfirmReturn?: (
    returnedItems: ReturnItem[], 
    action: 'RESTOCK' | 'WASTE', 
    reason: string, 
    refundDestination: string,
    isFullOrder: boolean
  ) => void;
}

export const ReturnOrderModal: React.FC<ReturnOrderModalProps> = ({
  isOpen,
  onClose,
  orderData,
  onConfirmReturn
}) => {
  const { restockForOrder } = useInventoryStore();
  const { addEntry } = useLedgerStore();

  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [stockAction, setStockAction] = useState<'RESTOCK' | 'WASTE'>('WASTE');
  const [reason, setReason] = useState<string>('Customer Refusal / Quality Issue');
  const [refundDest, setRefundDest] = useState<'CASH' | 'UPI' | 'LEDGER'>('CASH');

  useEffect(() => {
    if (orderData?.items) {
      // By default, select all items with max quantity for quick full returns
      const initial: Record<string, number> = {};
      orderData.items.forEach((item, idx) => {
        initial[`${item.name}-${idx}`] = item.quantity;
      });
      setSelectedItems(initial);

      // Default refund destination based on original method
      if (orderData.paymentMethod?.toUpperCase().includes('UPI')) {
        setRefundDest('UPI');
      } else if (orderData.paymentMethod?.toUpperCase().includes('CREDIT') || orderData.paymentMethod?.toUpperCase().includes('LEDGER')) {
        setRefundDest('LEDGER');
      } else {
        setRefundDest('CASH');
      }
    }
  }, [orderData]);

  if (!isOpen || !orderData) return null;

  const handleToggleItem = (key: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined && next[key] > 0) {
        delete next[key];
      } else {
        next[key] = maxQty;
      }
      return next;
    });
  };

  const handleQtyChange = (key: string, delta: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[key] || 0;
      const nextQty = Math.max(0, Math.min(maxQty, current + delta));
      const next = { ...prev };
      if (nextQty === 0) {
        delete next[key];
      } else {
        next[key] = nextQty;
      }
      return next;
    });
  };

  const returnedItemsList: ReturnItem[] = orderData.items
    .map((item, idx) => {
      const qty = selectedItems[`${item.name}-${idx}`] || 0;
      return qty > 0 ? { name: item.name, quantity: qty, price: item.price } : null;
    })
    .filter(Boolean) as ReturnItem[];

  const refundSubtotal = returnedItemsList.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const isFullOrder = returnedItemsList.length === orderData.items.length && 
    returnedItemsList.every((ri, idx) => ri.quantity === orderData.items[idx].quantity);

  const totalRefundAmount = isFullOrder && orderData.grandTotal ? orderData.grandTotal : refundSubtotal;

  const handleSubmit = () => {
    if (returnedItemsList.length === 0) return;

    // 1. Execute inventory restock or spoilage logging in useInventoryStore
    restockForOrder(
      returnedItemsList,
      orderData.orderType || 'DINE_IN',
      stockAction,
      reason,
      `Manager Return (${orderData.billNumber || 'Order'})`
    );

    // 2. Handle ledger credit if refunding to Customer Ledger
    if (refundDest === 'LEDGER' && orderData.customerName) {
      addEntry({
        customerId: `cust-return-${Date.now()}`,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone || '',
        amount: -totalRefundAmount, // Negative amount represents a Credit note / Balance reduction!
        billNumber: `REF-${orderData.billNumber || Date.now().toString().slice(-5)}`,
        date: new Date().toLocaleDateString()
      });
    }

    // 3. Invoke callback to update screen UI / order status
    if (onConfirmReturn) {
      onConfirmReturn(returnedItemsList, stockAction, reason, refundDest, isFullOrder);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-pos-card w-full max-w-2xl p-6 rounded-3xl border border-pos-border shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200 text-pos-text max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-pos-border pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 flex items-center justify-center">
              <RotateCcw className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-black text-pos-text tracking-tight">Return, Refund & Restock Studio</h2>
              <p className="text-xs text-pos-text-muted font-medium">
                Process customer returns with automated inventory restocking or spoilage audit logging.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-pos-text-muted hover:text-pos-text rounded-xl hover:bg-pos-bg transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Banner Info */}
        <div className="bg-pos-bg p-4 rounded-2xl border border-pos-border/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-pos-text-muted block">Invoice / Order #</span>
            <span className="text-base font-black text-pos-text">{orderData.billNumber || orderData.orderId || 'N/A'}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-pos-text-muted block">Channel</span>
            <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-pos-card border border-pos-border flex items-center gap-1.5 mt-0.5">
              {orderData.orderType === 'DELIVERY' && <Bike className="h-3.5 w-3.5 text-purple-400" />}
              {orderData.orderType === 'PARCEL' && <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />}
              {(!orderData.orderType || orderData.orderType === 'DINE_IN') && <Utensils className="h-3.5 w-3.5 text-emerald-400" />}
              <span>{orderData.orderType || 'DINE_IN'}</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-pos-text-muted block">Customer</span>
            <span className="text-sm font-black text-pos-text">{orderData.customerName || 'Walk-in Guest'}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-pos-text-muted block">Original Paid</span>
            <span className="text-base font-black text-emerald-400">₹{orderData.grandTotal || refundSubtotal} ({orderData.paymentMethod || 'CASH'})</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
          
          {/* STEP 1: Select Items to Return */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-pos-text-muted flex items-center gap-1.5">
                <span>1. Select Items & Quantities to Return</span>
              </label>
              <button 
                onClick={() => {
                  const all: Record<string, number> = {};
                  orderData.items.forEach((item, idx) => { all[`${item.name}-${idx}`] = item.quantity; });
                  setSelectedItems(all);
                }}
                className="text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                Select All ({orderData.items.length})
              </button>
            </div>

            <div className="border border-pos-border rounded-2xl divide-y divide-pos-border/60 overflow-hidden bg-pos-bg/50">
              {orderData.items.map((item, idx) => {
                const key = `${item.name}-${idx}`;
                const currentQty = selectedItems[key] || 0;
                const isSelected = currentQty > 0;

                return (
                  <div 
                    key={key}
                    onClick={() => handleToggleItem(key, item.quantity)}
                    className={`p-3.5 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected ? 'bg-amber-500/10 dark:bg-amber-950/20' : 'hover:bg-pos-bg'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => {}}
                        className="h-4 w-4 rounded border-pos-border text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-black text-pos-text block">{item.name}</span>
                        <span className="text-xs font-bold text-pos-text-muted">₹{item.price} / unit • Billed Qty: {item.quantity}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-2 bg-pos-card px-2 py-1 rounded-xl border border-pos-border" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleQtyChange(key, -1, item.quantity)}
                          className="w-6 h-6 rounded-lg bg-pos-bg hover:bg-pos-border flex items-center justify-center text-pos-text font-bold"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-amber-400">{currentQty}</span>
                        <button 
                          onClick={() => handleQtyChange(key, 1, item.quantity)}
                          disabled={currentQty >= item.quantity}
                          className="w-6 h-6 rounded-lg bg-pos-bg hover:bg-pos-border disabled:opacity-30 flex items-center justify-center text-pos-text font-bold"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="text-right min-w-[70px]">
                      <span className="text-sm font-black text-pos-text">₹{item.price * currentQty}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: The "Restock vs. Waste" Engine */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-pos-text-muted block mb-2">
              2. Inventory & Kitchen Decision (Restock vs. Spoilage)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStockAction('RESTOCK')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  stockAction === 'RESTOCK'
                    ? 'bg-emerald-500/15 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                    : 'bg-pos-bg/60 border-pos-border hover:bg-pos-bg opacity-75'
                }`}
              >
                <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Package className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-pos-text">Restock to Inventory (+)</span>
                    {stockAction === 'RESTOCK' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  </div>
                  <p className="text-[11px] text-pos-text-muted mt-1 leading-snug">
                    Use for untouched, sealed bottles, packaged snacks, or cancelled items before cooking. Reverses recipe stock depletion.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStockAction('WASTE')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  stockAction === 'WASTE'
                    ? 'bg-red-500/15 border-red-500 shadow-md ring-1 ring-red-500'
                    : 'bg-pos-bg/60 border-pos-border hover:bg-pos-bg opacity-75'
                }`}
              >
                <span className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0">
                  <Trash2 className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-pos-text">Log as Spoilage / Waste (-)</span>
                    {stockAction === 'WASTE' && <CheckCircle2 className="h-4 w-4 text-red-500" />}
                  </div>
                  <p className="text-[11px] text-pos-text-muted mt-1 leading-snug">
                    Use for cooked food, quality rejections, burnt dishes, or delivery transit spills. Records shrinkage loss in Audit Log.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 3: Reason & Refund Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-pos-text-muted block mb-1.5">
                3. Reason for Return / Rejection
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-pos-bg p-3 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="Customer Refusal (COD)">Customer Refusal at Doorstep (COD)</option>
                <option value="Damaged in Transit / Spilled">Damaged in Transit / Spilled Box</option>
                <option value="Kitchen Preparation Error">Kitchen Preparation Error / Wrong Item</option>
                <option value="Quality Rejection by Guest">Quality Rejection by Guest / Cold Food</option>
                <option value="Late Delivery Arrival">Late Delivery Arrival / Order Cancelled</option>
                <option value="Customer Changed Mind">Customer Changed Mind</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-pos-text-muted block mb-1.5">
                4. Refund Destination
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundDest('CASH')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    refundDest === 'CASH' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-pos-bg border-pos-border text-pos-text-muted hover:text-pos-text'
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash Drawer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRefundDest('UPI')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    refundDest === 'UPI' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-pos-bg border-pos-border text-pos-text-muted hover:text-pos-text'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>UPI Reversal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRefundDest('LEDGER')}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    refundDest === 'LEDGER' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-pos-bg border-pos-border text-pos-text-muted hover:text-pos-text'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Ledger Credit</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-pos-border flex items-center justify-between gap-4 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-pos-text-muted block">Total Refund Adjustment</span>
            <span className="text-2xl font-black text-amber-400">₹{totalRefundAmount.toLocaleString()}</span>
            <span className="text-[10px] text-pos-text-muted ml-2">({returnedItemsList.length} items selected)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-pos-bg hover:bg-pos-border text-pos-text font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={returnedItemsList.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg cursor-pointer active:scale-95 transition-all flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Confirm Return & {stockAction === 'RESTOCK' ? 'Restock' : 'Log Waste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
