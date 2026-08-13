import React from 'react';
import { Banknote, QrCode, CreditCard, Smartphone } from 'lucide-react';
import { PaymentMethod } from '../SettlementModal';

interface PaymentGridProps {
  onSettle: (method: PaymentMethod) => void;
  disabled: boolean;
}

export const PaymentGrid: React.FC<PaymentGridProps> = ({ onSettle, disabled }) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      <button 
        onClick={() => onSettle('UPI')} 
        disabled={disabled} 
        className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 hover:text-emerald-700 font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <QrCode className="h-5 w-5 mb-0.5" />
        <span className="text-xs uppercase tracking-wider">UPI</span>
      </button>

      <button 
        onClick={() => onSettle('CARD')} 
        disabled={disabled} 
        className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 hover:text-emerald-700 font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <CreditCard className="h-5 w-5 mb-0.5" />
        <span className="text-xs uppercase tracking-wider">Card</span>
      </button>
      
      <button 
        onClick={() => onSettle('CASH')} 
        disabled={disabled} 
        className="flex flex-col items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 border border-transparent disabled:opacity-40 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <Banknote className="h-5 w-5 mb-0.5" />
        <span className="text-xs uppercase tracking-wider">Cash</span>
      </button>

      <button 
        onClick={() => onSettle('CREDIT')} 
        disabled={disabled} 
        className="flex flex-col items-center justify-center gap-1.5 py-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 hover:text-emerald-700 font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <Smartphone className="h-5 w-5 mb-0.5" />
        <span className="text-xs uppercase tracking-wider">Credit</span>
      </button>
    </div>
  );
};
