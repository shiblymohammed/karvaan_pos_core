import React, { useEffect, useRef } from 'react';
import { Banknote, QrCode, CreditCard, Smartphone } from 'lucide-react';
import { PaymentMethod } from '../SettlementModal';

interface PaymentGridProps {
  onSettle: (method: PaymentMethod) => void;
  disabled: boolean;
}

export const PaymentGrid: React.FC<PaymentGridProps> = ({ onSettle, disabled }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcuts for Payment Grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      
      // Prevent triggering if this specific instance of the grid is hidden (e.g. mobile vs desktop views)
      if (gridRef.current && gridRef.current.offsetParent === null) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'F4') { e.preventDefault(); onSettle('CASH'); }
      else if (e.key === 'F5') { e.preventDefault(); onSettle('UPI'); }
      else if (e.key === 'F6') { e.preventDefault(); onSettle('CARD'); }
      else if (e.key === 'F7') { e.preventDefault(); onSettle('CREDIT'); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onSettle]);

  const methods = [
    { 
      id: 'CASH', label: 'Cash', icon: <Banknote className="h-5 w-5 mb-0.5" />, hotkey: 'F4',
      baseBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(16,185,129,0.3)]', focusRing: 'focus-visible:ring-emerald-500/40',
      borderColor: 'border-emerald-400/30'
    },
    { 
      id: 'UPI', label: 'UPI', icon: <QrCode className="h-5 w-5 mb-0.5" />, hotkey: 'F5',
      baseBg: 'bg-gradient-to-br from-purple-400 to-purple-600',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(168,85,247,0.3)]', focusRing: 'focus-visible:ring-purple-500/40',
      borderColor: 'border-purple-400/30'
    },
    { 
      id: 'CARD', label: 'Card', icon: <CreditCard className="h-5 w-5 mb-0.5" />, hotkey: 'F6',
      baseBg: 'bg-gradient-to-br from-blue-400 to-blue-600',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(59,130,246,0.3)]', focusRing: 'focus-visible:ring-blue-500/40',
      borderColor: 'border-blue-400/30'
    },
    { 
      id: 'CREDIT', label: 'Credit', icon: <Smartphone className="h-5 w-5 mb-0.5" />, hotkey: 'F7',
      baseBg: 'bg-gradient-to-br from-amber-400 to-amber-600',
      hoverShadow: 'hover:shadow-[0_8px_24px_rgba(245,158,11,0.3)]', focusRing: 'focus-visible:ring-amber-500/40',
      borderColor: 'border-amber-400/30'
    },
  ] as const;

  return (
    <div ref={gridRef} className="grid grid-cols-4 gap-2">
      {methods.map(m => (
        <button 
          key={m.id}
          onClick={() => onSettle(m.id as PaymentMethod)} 
          disabled={disabled} 
          className={`relative flex flex-col items-center justify-center gap-1.5 py-3 md:py-3.5 ${m.baseBg} border border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 text-white font-bold rounded-2xl transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:brightness-110 hover:-translate-y-0.5 ${m.hoverShadow} active:scale-[0.96] active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 ${m.focusRing} disabled:opacity-40 disabled:hover:brightness-100 disabled:hover:translate-y-0 disabled:active:scale-100 group overflow-hidden`}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="text-white/90 group-hover:text-white transition-colors group-hover:scale-110 transform duration-200">
            {m.icon}
          </div>
          <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-white/90 group-hover:text-white drop-shadow-sm">{m.label}</span>
          
          <kbd className="absolute top-1.5 right-1.5 hidden md:flex items-center justify-center px-1 py-0.5 text-[8px] font-black text-white/70 bg-black/10 rounded border border-white/20 group-hover:text-white group-hover:bg-black/20 transition-colors pointer-events-none">
            {m.hotkey}
          </kbd>
        </button>
      ))}
    </div>
  );
};
