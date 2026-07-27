import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Banknote, QrCode, CreditCard, Smartphone, Calculator, User, AlertCircle } from 'lucide-react';

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT';

export interface TenderState {
  CASH: number;
  UPI: number;
  CARD: number;
  CREDIT: number;
}

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tenders: TenderState) => void;
  totalAmount: number;
  initialMethod: PaymentMethod;
  hasCustomer: boolean;
  onRequestCustomer: () => void;
}

const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen, onClose, onConfirm, totalAmount, initialMethod, hasCustomer, onRequestCustomer
}) => {
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(initialMethod);
  const [tenders, setTenders] = useState<TenderState>({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 });
  const [numpadInput, setNumpadInput] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveMethod(initialMethod);
      setTenders({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 });
      setNumpadInput('');
      
      // Auto-fill exact amount for the initial method to speed things up
      setTenders(prev => ({ ...prev, [initialMethod]: totalAmount }));
    }
  }, [isOpen, initialMethod, totalAmount]);

  if (!isOpen) return null;

  const totalTendered = Object.values(tenders).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, totalAmount - totalTendered);
  const changeDue = Math.max(0, totalTendered - totalAmount);

  const canConfirm = totalTendered >= totalAmount && (tenders.CREDIT === 0 || hasCustomer);

  const handleNumpad = (val: string) => {
    let newVal = numpadInput;
    if (val === 'C') {
      newVal = '';
    } else if (val === 'DEL') {
      newVal = newVal.slice(0, -1);
    } else {
      // Prevent multiple decimals
      if (val === '.' && newVal.includes('.')) return;
      newVal = newVal + val;
    }
    
    setNumpadInput(newVal);
    const parsed = parseFloat(newVal) || 0;
    setTenders(prev => ({ ...prev, [activeMethod]: parsed }));
  };

  const setExact = () => {
    // Add the remaining amount to the active method
    const amountToAdd = Math.max(0, totalAmount - (totalTendered - tenders[activeMethod]));
    setNumpadInput(amountToAdd.toString());
    setTenders(prev => ({ ...prev, [activeMethod]: amountToAdd }));
  };

  const addFastCash = (amount: number) => {
    const current = tenders[activeMethod] || 0;
    const next = current + amount;
    setNumpadInput(next.toString());
    setTenders(prev => ({ ...prev, [activeMethod]: next }));
  };

  const methods = [
    { id: 'CASH', icon: <Banknote className="h-5 w-5" />, label: 'Cash', color: 'text-emerald-600', bg: 'bg-emerald-500' },
    { id: 'UPI', icon: <QrCode className="h-5 w-5" />, label: 'UPI', color: 'text-purple-600', bg: 'bg-purple-500' },
    { id: 'CARD', icon: <CreditCard className="h-5 w-5" />, label: 'Card', color: 'text-blue-600', bg: 'bg-blue-500' },
    { id: 'CREDIT', icon: <Smartphone className="h-5 w-5" />, label: 'Credit', color: 'text-amber-600', bg: 'bg-amber-500' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-pos-bg w-full max-w-4xl rounded-2xl shadow-2xl border border-pos-border overflow-hidden flex flex-col md:flex-row h-full max-h-[600px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Side: Summary & Tenders */}
        <div className="flex-1 border-r border-pos-border flex flex-col bg-pos-sidebar relative">
          <div className="p-4 border-b border-pos-border flex justify-between items-center bg-pos-card">
            <h2 className="text-lg font-black flex items-center gap-2"><Calculator className="h-5 w-5 text-pos-accent" /> Settlement</h2>
            <button onClick={onClose} className="p-2 hover:bg-pos-bg rounded-lg transition-colors"><X className="h-5 w-5" /></button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Total Due */}
            <div className="bg-pos-card border border-pos-border p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center">
              <span className="text-pos-text-muted font-black uppercase tracking-wider text-sm">Grand Total</span>
              <span className="text-3xl font-black text-pos-text">₹{totalAmount.toFixed(2)}</span>
            </div>

            {/* Split Tenders */}
            <h3 className="text-xs font-bold text-pos-text-muted uppercase mb-3 px-1">Payment Methods</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {methods.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMethod(m.id as PaymentMethod);
                    setNumpadInput(tenders[m.id as PaymentMethod] ? tenders[m.id as PaymentMethod].toString() : '');
                  }}
                  className={`p-3 rounded-xl border flex flex-col gap-2 transition-all text-left shadow-sm active:scale-95 ${
                    activeMethod === m.id 
                      ? `border-${m.color.split('-')[1]}-500 ${m.bg}/10` 
                      : 'border-pos-border bg-pos-card hover:bg-pos-bg'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className={`p-1.5 rounded-lg ${m.bg}/20 ${m.color}`}>
                      {m.icon}
                    </div>
                    {tenders[m.id as PaymentMethod] > 0 && (
                      <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black">ACTIVE</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-pos-text-muted">{m.label}</span>
                    <span className={`block text-lg font-black ${tenders[m.id as PaymentMethod] > 0 ? 'text-pos-text' : 'text-pos-text-muted/40'}`}>
                      ₹{(tenders[m.id as PaymentMethod] || 0).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Credit Warning */}
            {tenders.CREDIT > 0 && !hasCustomer && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-start gap-3 mb-6 animate-pulse shadow-sm">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Customer Required</p>
                  <p className="text-xs mt-0.5">Credit payments must be linked to a customer ledger.</p>
                  <button onClick={onRequestCustomer} className="mt-2 text-xs font-black bg-rose-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-rose-700 active:scale-95 transition-all">Select Customer</button>
                </div>
              </div>
            )}
            {tenders.CREDIT > 0 && hasCustomer && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-center gap-3 mb-6 shadow-sm">
                <User className="h-5 w-5 shrink-0" />
                <p className="font-bold text-sm">Ledger Linked</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Numpad & Finalize */}
        <div className="w-full md:w-96 bg-pos-card flex flex-col">
          <div className="p-6 pb-2">
            <p className="text-xs font-bold text-pos-text-muted uppercase mb-1">Editing {activeMethod}</p>
            <div className="bg-pos-bg border-2 border-pos-border rounded-xl p-4 flex justify-between items-center shadow-inner">
              <span className="text-xl font-bold text-pos-text-muted">₹</span>
              <span className="text-3xl font-black text-pos-text">{numpadInput || '0'}</span>
            </div>
          </div>
          
          <div className="px-6 py-2 flex gap-2">
            <button onClick={setExact} className="flex-1 py-2 bg-pos-sidebar border border-pos-border rounded-lg text-xs font-black hover:bg-pos-bg transition-colors shadow-sm active:scale-95">Exact</button>
            <button onClick={() => addFastCash(500)} className="flex-1 py-2 bg-pos-sidebar border border-pos-border rounded-lg text-xs font-black hover:bg-pos-bg transition-colors shadow-sm active:scale-95">+₹500</button>
            <button onClick={() => addFastCash(1000)} className="flex-1 py-2 bg-pos-sidebar border border-pos-border rounded-lg text-xs font-black hover:bg-pos-bg transition-colors shadow-sm active:scale-95">+₹1000</button>
          </div>

          <div className="p-6 pt-2 flex-1 flex flex-col justify-end">
            <div className="grid grid-cols-3 gap-2 mb-6">
              {['1','2','3','4','5','6','7','8','9','C','0','DEL'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleNumpad(btn)}
                  className={`h-14 rounded-xl font-black text-lg shadow-sm transition-colors active:scale-95 flex items-center justify-center border
                    ${btn === 'C' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 
                      btn === 'DEL' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 
                      'bg-pos-sidebar text-pos-text border-pos-border hover:bg-pos-bg hover:border-emerald-400'}`}
                >
                  {btn}
                </button>
              ))}
            </div>

            <div className="bg-pos-bg border border-pos-border rounded-xl p-4 mb-4 shadow-inner">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-pos-text-muted">Remaining Balance</span>
                <span className={`font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{remaining.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-pos-border/50 pt-1 mt-1">
                <span className="text-xs font-bold text-pos-text-muted">Change Due</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">₹{changeDue.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => onConfirm(tenders)}
              disabled={!canConfirm}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-pos-border disabled:text-pos-text-muted text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="h-6 w-6" /> Confirm & Print
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettlementModal;
