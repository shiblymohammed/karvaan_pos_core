import React, { useState, useRef, useEffect } from 'react';
import { Tag, ChevronDown, Check, X } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';

interface DiscountSelectorProps {
  subtotal: number;
  currentDiscount: number;
  onApplyDiscount: (amount: number) => void;
}

export const DiscountSelector: React.FC<DiscountSelectorProps> = ({ 
  subtotal, 
  currentDiscount, 
  onApplyDiscount 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { discounts: predefinedDiscounts } = useSettingsStore();
  const { currentUser } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (currentUser?.role === 'WAITER' || predefinedDiscounts.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {currentDiscount > 0 ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
            <div className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              <span className="text-xs font-semibold">Discount Applied</span>
            </div>
            <span className="text-sm font-bold">-₹{currentDiscount.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => onApplyDiscount(0)}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors"
            title="Remove Discount"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 hover:border-emerald-200 hover:text-emerald-700 text-slate-600 rounded-xl transition-all shadow-sm text-sm font-semibold"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span>Apply Discount</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && currentDiscount === 0 && (
        <div className="absolute z-50 bottom-full left-0 right-0 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-2 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Select Discount</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-2 flex flex-col gap-1">
            {predefinedDiscounts.map(d => {
              const calcAmt = d.type === 'PERCENTAGE' ? (subtotal * d.amount) / 100 : d.amount;
              const isDisabled = (currentUser?.role === 'CASHIER' && calcAmt > 50);
              
              return (
                <button
                  key={d.id}
                  disabled={isDisabled}
                  onClick={() => {
                    onApplyDiscount(calcAmt);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    isDisabled 
                      ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                      : 'hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 cursor-pointer'
                  }`}
                >
                  <span>{d.label}</span>
                  <span>-₹{calcAmt.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
