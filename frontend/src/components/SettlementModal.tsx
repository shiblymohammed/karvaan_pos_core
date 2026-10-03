import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Banknote, QrCode, CreditCard, Smartphone, Calculator, User, AlertCircle, Coins, ChevronRight } from 'lucide-react';

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
      setTenders(prev => ({ ...prev, [initialMethod]: totalAmount }));
    }
  }, [isOpen, initialMethod, totalAmount]);

  const totalTendered = Object.values(tenders).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, totalAmount - totalTendered);
  const changeDue = Math.max(0, totalTendered - totalAmount);
  const canConfirm = totalTendered >= totalAmount && (tenders.CREDIT === 0 || hasCustomer);

  const handleNumpad = useCallback((val: string) => {
    setNumpadInput(prevInput => {
      let newVal = prevInput;
      if (val === 'C') {
        newVal = '';
      } else if (val === 'DEL') {
        newVal = newVal.slice(0, -1);
      } else {
        if (val === '.' && newVal.includes('.')) return prevInput;
        newVal = newVal + val;
      }
      
      const parsed = parseFloat(newVal) || 0;
      setTenders(prev => ({ ...prev, [activeMethod]: parsed }));
      return newVal;
    });
  }, [activeMethod]);

  // Keyboard Event Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumpad(e.key);
      } else if (e.key === '.') {
        handleNumpad('.');
      } else if (e.key === 'Backspace') {
        handleNumpad('DEL');
      } else if (e.key.toLowerCase() === 'c') {
        handleNumpad('C');
      } else if (e.key === 'Enter' && canConfirm) {
        onConfirm(tenders);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeMethod, canConfirm, tenders, handleNumpad, onConfirm, onClose]);


  const handleMethodSelect = (method: PaymentMethod) => {
    setActiveMethod(method);
    if (tenders[method] === 0 && remaining > 0) {
      setTenders(prev => ({ ...prev, [method]: remaining }));
      setNumpadInput(remaining.toString());
    } else {
      setNumpadInput(tenders[method] > 0 ? tenders[method].toString() : '');
    }
  };

  const setExact = () => {
    const amountToAdd = remaining + tenders[activeMethod];
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
    { 
      id: 'CASH', label: 'Cash', icon: <Banknote className="h-6 w-6" />,
      inactiveClass: 'bg-emerald-50 border-emerald-100 focus-visible:ring-emerald-500/30 hover:bg-emerald-500 hover:border-emerald-500 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(16,185,129,0.3)]',
      activeClass: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_8px_24px_rgba(16,185,129,0.4)] border-transparent text-white ring-4 ring-emerald-500/40 scale-105 z-10',
      inactiveIcon: 'bg-emerald-100/50 text-emerald-600 group-hover:bg-white/20 group-hover:text-white',
      activeIcon: 'bg-white/20 text-white shadow-inner',
      inactiveText: 'text-emerald-700 group-hover:text-white',
      badgeBg: 'bg-white text-emerald-600'
    },
    { 
      id: 'UPI', label: 'UPI', icon: <QrCode className="h-6 w-6" />,
      inactiveClass: 'bg-purple-50 border-purple-100 focus-visible:ring-purple-500/30 hover:bg-purple-500 hover:border-purple-500 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(168,85,247,0.3)]',
      activeClass: 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-[0_8px_24px_rgba(168,85,247,0.4)] border-transparent text-white ring-4 ring-purple-500/40 scale-105 z-10',
      inactiveIcon: 'bg-purple-100/50 text-purple-600 group-hover:bg-white/20 group-hover:text-white',
      activeIcon: 'bg-white/20 text-white shadow-inner',
      inactiveText: 'text-purple-700 group-hover:text-white',
      badgeBg: 'bg-white text-purple-600'
    },
    { 
      id: 'CARD', label: 'Card', icon: <CreditCard className="h-6 w-6" />,
      inactiveClass: 'bg-blue-50 border-blue-100 focus-visible:ring-blue-500/30 hover:bg-blue-500 hover:border-blue-500 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(59,130,246,0.3)]',
      activeClass: 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_8px_24px_rgba(59,130,246,0.4)] border-transparent text-white ring-4 ring-blue-500/40 scale-105 z-10',
      inactiveIcon: 'bg-blue-100/50 text-blue-600 group-hover:bg-white/20 group-hover:text-white',
      activeIcon: 'bg-white/20 text-white shadow-inner',
      inactiveText: 'text-blue-700 group-hover:text-white',
      badgeBg: 'bg-white text-blue-600'
    },
    { 
      id: 'CREDIT', label: 'Credit', icon: <Smartphone className="h-6 w-6" />,
      inactiveClass: 'bg-amber-50 border-amber-100 focus-visible:ring-amber-500/30 hover:bg-amber-500 hover:border-amber-500 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(245,158,11,0.3)]',
      activeClass: 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-[0_8px_24px_rgba(245,158,11,0.4)] border-transparent text-white ring-4 ring-amber-500/40 scale-105 z-10',
      inactiveIcon: 'bg-amber-100/50 text-amber-600 group-hover:bg-white/20 group-hover:text-white',
      activeIcon: 'bg-white/20 text-white shadow-inner',
      inactiveText: 'text-amber-700 group-hover:text-white',
      badgeBg: 'bg-white text-amber-600'
    },
  ] as const;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div 
        className="bg-slate-50 w-full md:max-w-4xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[92vh] md:h-auto md:max-h-[85vh] transform transition-transform" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Left Side: Summary & Methods */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="bg-[#8cc63f]/10 p-2 rounded-xl border border-[#8cc63f]/20">
                <Calculator className="h-5 w-5 text-[#8cc63f]" />
              </div>
              <h3 className="font-black text-lg md:text-xl text-slate-800">Settle Bill</h3>
            </div>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer p-2 rounded-full transition-colors active:scale-[0.98]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 md:p-6 flex-1 overflow-y-auto">
            {/* Total Due */}
            <div className="mb-6 flex flex-col items-center justify-center py-6 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-3xl shadow-inner">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total</span>
              <span className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">₹{totalAmount.toFixed(2)}</span>
            </div>

            {/* Payment Methods */}
            <div className="mb-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1 mb-3">Select Payment Method</h3>
              <div className="grid grid-cols-2 gap-3">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleMethodSelect(m.id as PaymentMethod)}
                    className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-[0.96] overflow-hidden group focus-visible:outline-none focus-visible:ring-4 ${
                      activeMethod === m.id 
                        ? m.activeClass 
                        : m.inactiveClass
                    }`}
                  >
                    {/* Shine effect for active method */}
                    {activeMethod === m.id && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    )}
                    
                    <div className={`p-3 rounded-full transition-colors ${activeMethod === m.id ? m.activeIcon : m.inactiveIcon}`}>
                      {m.icon}
                    </div>
                    <span className={`text-sm font-black transition-colors ${activeMethod === m.id ? 'text-white drop-shadow-sm' : m.inactiveText}`}>{m.label}</span>
                    
                    {tenders[m.id as PaymentMethod] > 0 && (
                      <div className="absolute bottom-2 right-2 flex items-center justify-center">
                        <span className={`${m.badgeBg} text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm tabular-nums`}>
                          ₹{tenders[m.id as PaymentMethod].toFixed(0)}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Credit Warning */}
            {tenders.CREDIT > 0 && !hasCustomer && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 shrink-0 animate-pulse text-rose-500" />
                  <div>
                    <p className="font-black text-sm">Customer Required</p>
                    <p className="text-xs font-semibold opacity-80 mt-0.5">Credit must be linked to a ledger.</p>
                  </div>
                </div>
                <button onClick={onRequestCustomer} className="w-full md:w-auto text-xs font-black bg-rose-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-rose-700 active:scale-[0.98] transition-all">Link Ledger</button>
              </div>
            )}
            {tenders.CREDIT > 0 && hasCustomer && (
              <div className="bg-[#8cc63f]/10 border border-[#8cc63f]/30 text-[#6a9a2a] p-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                <User className="h-5 w-5 text-[#8cc63f]" />
                <p className="font-black text-sm">Customer Ledger Linked</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Numpad & Finalize */}
        <div className="w-full md:w-96 bg-slate-50 flex flex-col">
          
          <div className="p-5 md:p-6 pb-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tender Amount ({activeMethod})</span>
              <button onClick={() => setTenders(prev => ({ ...prev, [activeMethod]: 0 }))} className="text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase transition-colors px-2 py-1 bg-rose-100 rounded-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30">Clear</button>
            </div>
            <div className="bg-white border-2 border-slate-200 focus-within:border-[#8cc63f] focus-within:ring-4 focus-within:ring-[#8cc63f]/10 rounded-2xl p-4 flex justify-between items-center shadow-sm transition-all">
              <span className="text-xl font-bold text-slate-400">₹</span>
              <span className={`text-4xl font-black tabular-nums tracking-tighter ${numpadInput ? 'text-slate-900' : 'text-slate-300'}`}>
                {numpadInput || '0'}
              </span>
            </div>
          </div>
          
          {/* Fast Cash */}
          <div className="px-5 md:px-6 py-3 flex gap-2">
            <button onClick={setExact} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:text-[#8cc63f] hover:border-[#8cc63f] hover:bg-[#8cc63f]/5 transition-all shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cc63f]/30">Exact</button>
            <button onClick={() => addFastCash(500)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:text-[#8cc63f] hover:border-[#8cc63f] hover:bg-[#8cc63f]/5 transition-all shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cc63f]/30">+₹500</button>
            <button onClick={() => addFastCash(1000)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:text-[#8cc63f] hover:border-[#8cc63f] hover:bg-[#8cc63f]/5 transition-all shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8cc63f]/30">+₹1000</button>
          </div>

          <div className="p-5 md:p-6 pt-2 flex-1 flex flex-col justify-end">
            <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6">
              {['1','2','3','4','5','6','7','8','9','00','0','DEL'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleNumpad(btn)}
                  className={`h-12 md:h-14 rounded-2xl font-black text-xl md:text-2xl shadow-sm transition-colors active:scale-[0.98] flex items-center justify-center border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8cc63f]/20
                    ${btn === 'DEL' ? 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100 text-lg' : 
                      'bg-white text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
                >
                  {btn === 'DEL' ? <X className="h-6 w-6" /> : btn}
                </button>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-500">Remaining</span>
                <span className={`font-black tabular-nums ${remaining > 0 ? 'text-rose-500' : 'text-slate-400'}`}>₹{remaining.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                <span className="text-xs font-black text-slate-500 flex items-center gap-1"><Coins className="h-3 w-3" /> Change Due</span>
                <span className="font-black text-[#8cc63f] tabular-nums text-lg leading-none">₹{changeDue.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => onConfirm(tenders)}
              disabled={!canConfirm}
              className="relative overflow-hidden w-full py-4 md:py-4 bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-400/30 border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:brightness-110 hover:-translate-y-0.5 disabled:hover:brightness-100 disabled:hover:translate-y-0 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:border-transparent text-white rounded-2xl font-black text-lg md:text-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_32px_rgba(16,185,129,0.4)] disabled:shadow-none transition-all active:scale-[0.96] disabled:active:scale-100 tracking-wide uppercase focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/50 group"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <span className="drop-shadow-sm z-10">Confirm & Print</span> <ChevronRight className="h-6 w-6 z-10 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettlementModal;
