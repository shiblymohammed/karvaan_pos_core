import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  User,
  AlertCircle,
  Coins,
  ChevronRight,
  Calculator,
  RotateCcw,
  Printer,
  Check,
  Split,
  Delete,
} from 'lucide-react';

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
  isProcessing?: boolean;
  totalAmount: number;
  initialMethod: PaymentMethod;
  hasCustomer: boolean;
  onRequestCustomer: () => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalAmount,
  initialMethod,
  hasCustomer,
  onRequestCustomer,
  isProcessing = false,
}) => {
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(initialMethod);
  const [tenders, setTenders] = useState<TenderState>({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 });
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadInput, setNumpadInput] = useState<string>('');

  // Reset & initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultMethod = initialMethod || 'CASH';
      setActiveMethod(defaultMethod);
      const initialTenders = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0, [defaultMethod]: totalAmount };
      setTenders(initialTenders);
      setNumpadInput(totalAmount > 0 ? totalAmount.toString() : '');
      setShowNumpad(false);
    }
  }, [isOpen, initialMethod, totalAmount]);

  const totalTendered = useMemo(() => {
    return Number((tenders.CASH + tenders.UPI + tenders.CARD + tenders.CREDIT).toFixed(2));
  }, [tenders]);

  const remaining = useMemo(() => {
    return Math.max(0, Number((totalAmount - totalTendered).toFixed(2)));
  }, [totalAmount, totalTendered]);

  const changeDue = useMemo(() => {
    return Math.max(0, Number((totalTendered - totalAmount).toFixed(2)));
  }, [totalTendered, totalAmount]);

  const canConfirm = totalTendered >= totalAmount && (tenders.CREDIT === 0 || hasCustomer);

  // Smart currency notes calculation based on totalAmount
  const smartCashNotes = useMemo(() => {
    const list: number[] = [];
    const exact = Math.ceil(totalAmount);
    list.push(exact);

    // Next round 50 / 100
    if (exact % 50 !== 0) {
      list.push(Math.ceil(exact / 50) * 50);
    } else if (exact % 100 !== 0) {
      list.push(Math.ceil(exact / 100) * 100);
    }

    // Common notes: 500, 1000, 2000
    const currencyNotes = [100, 200, 500, 1000, 2000];
    for (const note of currencyNotes) {
      if (note > exact && !list.includes(note)) {
        list.push(note);
      }
      if (list.length >= 4) break;
    }

    return Array.from(new Set(list)).sort((a, b) => a - b).slice(0, 4);
  }, [totalAmount]);

  // Method Selection
  const handleMethodSelect = (method: PaymentMethod) => {
    setActiveMethod(method);

    // If single payment (only 1 active tender), switch full balance directly
    const nonZeroMethods = (Object.keys(tenders) as PaymentMethod[]).filter((k) => tenders[k] > 0);
    if (nonZeroMethods.length <= 1) {
      setTenders({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0, [method]: totalAmount });
      setNumpadInput(totalAmount.toString());
    } else {
      // In split mode, auto-fill remaining to the newly selected method
      if (tenders[method] === 0 && remaining > 0) {
        setTenders((prev) => ({ ...prev, [method]: remaining }));
        setNumpadInput(remaining.toString());
      } else {
        setNumpadInput(tenders[method] > 0 ? tenders[method].toString() : '');
      }
    }
  };

  // Quick cash note tap
  const handleQuickCash = (amount: number) => {
    setTenders((prev) => ({ ...prev, CASH: amount }));
    setNumpadInput(amount.toString());
  };

  // Reset to single full payment of active method
  const handleResetToExact = () => {
    setTenders({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0, [activeMethod]: totalAmount });
    setNumpadInput(totalAmount.toString());
    setShowNumpad(false);
  };

  // Numpad handler
  const handleNumpad = useCallback(
    (val: string) => {
      setNumpadInput((prevInput) => {
        let newVal = prevInput;
        if (val === 'C') {
          newVal = '';
        } else if (val === 'DEL') {
          newVal = newVal.slice(0, -1);
        } else {
          if (val === '.' && newVal.includes('.')) return prevInput;
          // limit to 2 decimal places
          if (newVal.includes('.') && newVal.split('.')[1]?.length >= 2) return prevInput;
          newVal = newVal + val;
        }

        const parsed = parseFloat(newVal) || 0;
        setTenders((prev) => ({ ...prev, [activeMethod]: parsed }));
        return newVal;
      });
    },
    [activeMethod]
  );

  // Physical Keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        setShowNumpad(true);
        handleNumpad(e.key);
      } else if (e.key === 'Backspace') {
        setShowNumpad(true);
        handleNumpad('DEL');
      } else if (e.key.toLowerCase() === 'c') {
        handleNumpad('C');
      } else if (e.key === 'Enter' && canConfirm) {
        e.preventDefault();
        if (!isProcessing) onConfirm(tenders);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canConfirm, tenders, handleNumpad, onConfirm, onClose, isProcessing]);

  if (!isOpen) return null;

  const methods = [
    {
      id: 'CASH' as const,
      label: 'Cash',
      icon: <Banknote className="h-5 w-5" />,
      color: 'emerald',
      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20',
      inactiveClass: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'UPI' as const,
      label: 'UPI / QR',
      icon: <QrCode className="h-5 w-5" />,
      color: 'purple',
      activeClass: 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-500/20',
      inactiveClass: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'CARD' as const,
      label: 'Card',
      icon: <CreditCard className="h-5 w-5" />,
      color: 'blue',
      activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20',
      inactiveClass: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'CREDIT' as const,
      label: 'Ledger',
      icon: <User className="h-5 w-5" />,
      color: 'amber',
      activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20',
      inactiveClass: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  const activeTendersCount = (Object.keys(tenders) as PaymentMethod[]).filter((k) => tenders[k] > 0).length;

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl md:max-w-2xl rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Fixed Header ─── */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 leading-tight">Checkout Settlement</h3>
              <p className="text-[11px] font-bold text-slate-400">Select payment &amp; confirm invoice</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
              <span className="text-xs font-bold text-emerald-700">Total: </span>
              <span className="text-sm font-black text-emerald-700 tabular-nums">₹{totalAmount.toFixed(2)}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─── Scrollable Modal Body ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
          {/* Payment Method Selector Grid */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Payment Method</span>
              {activeTendersCount > 1 && (
                <button
                  type="button"
                  onClick={handleResetToExact}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Split
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {methods.map((m) => {
                const isSelected = activeMethod === m.id;
                const tenderVal = tenders[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMethodSelect(m.id)}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer relative ${
                      isSelected ? m.activeClass : m.inactiveClass
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {m.icon}
                      <span className="font-black text-xs sm:text-sm">{m.label}</span>
                    </div>

                    {tenderVal > 0 && (
                      <span
                        className={`text-[11px] font-black tabular-nums px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        ₹{tenderVal.toFixed(0)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Cash Buttons (Only when CASH is active) */}
          {activeMethod === 'CASH' && (
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5" /> Quick Cash Notes
                </span>
                <span className="text-[10px] font-bold text-emerald-600">Tap note to tender</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {smartCashNotes.map((amount) => {
                  const isCurrent = tenders.CASH === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleQuickCash(amount)}
                      className={`py-2 px-3 rounded-xl border font-black text-xs sm:text-sm tabular-nums transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-800 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                    >
                      {amount === Math.ceil(totalAmount) ? 'Exact ' : ''}₹{amount}
                      {isCurrent && <Check className="w-3.5 h-3.5 ml-0.5 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Ledger Guard Warning */}
          {tenders.CREDIT > 0 && !hasCustomer && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-black text-xs">Customer Record Required</p>
                  <p className="text-[11px] font-semibold text-rose-600">Credit sales must be linked to a customer ledger.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRequestCustomer}
                className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer shrink-0"
              >
                Link Customer
              </button>
            </div>
          )}

          {/* Tender Breakdown Summary Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tendered</span>
                <span className="text-base sm:text-lg font-black text-slate-800 tabular-nums">
                  ₹{totalTendered.toFixed(2)}
                </span>
              </div>

              {changeDue > 0 && (
                <div className="border-l border-slate-200 pl-4 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Return Change
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-600 tabular-nums">
                    ₹{changeDue.toFixed(2)}
                  </span>
                </div>
              )}

              {remaining > 0 && (
                <div className="border-l border-slate-200 pl-4 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">Remaining</span>
                  <span className="text-base sm:text-lg font-black text-amber-600 tabular-nums">
                    ₹{remaining.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Toggle Custom Numpad */}
            <button
              type="button"
              onClick={() => setShowNumpad(!showNumpad)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showNumpad
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>{showNumpad ? 'Hide Numpad' : 'Custom / Split'}</span>
            </button>
          </div>

          {/* Collapsible Compact Numpad */}
          {showNumpad && (
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-500">
                  Enter amount for <strong className="text-slate-800">{activeMethod}</strong>:
                </span>
                <span className="text-base font-black text-slate-900 tabular-nums bg-white px-3 py-1 rounded-lg border border-slate-200">
                  ₹{numpadInput || '0'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => handleNumpad(btn)}
                    className={`h-11 rounded-xl font-black text-base shadow-2xs transition-all active:scale-95 flex items-center justify-center border cursor-pointer ${
                      btn === 'DEL'
                        ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                        : btn === 'C'
                          ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300 text-xs'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {btn === 'DEL' ? <Delete className="h-4 w-4" /> : btn}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── FIXED STICKY FOOTER (Guaranteed 100% visible on all devices) ─── */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white shadow-lg shrink-0 flex items-center justify-between gap-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payable</span>
            <span className="text-xl font-black text-slate-900 leading-none tabular-nums">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onConfirm(tenders)}
            disabled={!canConfirm || isProcessing}
            className="flex-1 max-w-sm py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed group"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <Printer className="w-4 h-4 shrink-0" />
                <span>Confirm &amp; Print Bill</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default SettlementModal;
