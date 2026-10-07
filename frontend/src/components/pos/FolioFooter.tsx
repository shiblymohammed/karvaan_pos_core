import React from 'react';
import { Check, Bike, Package, UtensilsCrossed, Printer, QrCode } from 'lucide-react';
import { PaymentMethod } from '../SettlementModal';
import { DiscountSelector } from './DiscountSelector';
import { PaymentGrid } from './PaymentGrid';

interface FolioFooterProps {
  items: any[];
  subtotal: number;
  floorSurcharge: number;
  floorSurchargeLabel: string;
  cgst: number;
  sgst: number;
  discount: number;
  grandTotal: number;
  
  orderType: string;
  deliveryStatus?: string;
  deliveryFee?: number;
  parcelCharge?: number;
  collectedMethod?: string;
  deliveryAddress?: string;
  
  currentUserRole?: string;
  
  onApplyDiscount: (amount: number) => void;
  onSettle: (method: PaymentMethod) => void;
  onSendKot: () => void;
  onSendKotPrint: () => void;
  onPreBill: () => void;
  onCompleteDelivery: () => void;
  onDispatchDelivery: (isPrepaid: boolean) => void;
}

export const FolioFooter: React.FC<FolioFooterProps> = ({
  items, subtotal, floorSurcharge, floorSurchargeLabel, cgst, sgst, discount, grandTotal,
  orderType, deliveryStatus, deliveryFee, parcelCharge, collectedMethod, deliveryAddress,
  currentUserRole,
  onApplyDiscount, onSettle, onSendKot, onSendKotPrint, onPreBill,
  onCompleteDelivery, onDispatchDelivery
}) => {
  const hasItems = items.length > 0;
  const hasNewItems = items.some(i => i.status === 'NEW');

  return (
    <div className="flex flex-col shrink-0 p-3 pb-8 md:p-4 md:pb-4 bg-transparent z-10 border-t border-white/30 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] rounded-t-[20px] md:rounded-none mt-1">
      
      {/* Order Summary Card */}
      <div className="flex flex-col space-y-1 md:space-y-3 p-3 md:p-4 bg-white/60 backdrop-blur-xl rounded-[14px] md:rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.04)] mb-2 md:mb-4">
        
        <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-slate-500">
          <span>Subtotal</span>
          <span className="text-slate-900 tabular-nums font-bold">₹{subtotal.toFixed(2)}</span>
        </div>
        
        {floorSurcharge > 0 && (
          <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-amber-600">
            <span>Surcharge: {floorSurchargeLabel}</span>
            <span className="tabular-nums font-bold">+₹{floorSurcharge.toFixed(2)}</span>
          </div>
        )}

        {orderType === 'PARCEL' && parcelCharge !== undefined && parcelCharge > 0 && (
          <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-orange-600">
            <span>Packaging Charge</span>
            <span className="tabular-nums font-bold">+₹{parcelCharge.toFixed(2)}</span>
          </div>
        )}        
        <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-slate-500">
          <span>Taxes (5%)</span>
          <span className="text-slate-900 tabular-nums font-bold">₹{(cgst + sgst).toFixed(2)}</span>
        </div>

        {/* Discount Selector */}
        <div className="pt-1 md:pt-2">
          <DiscountSelector 
            subtotal={subtotal} 
            currentDiscount={discount} 
            onApplyDiscount={onApplyDiscount} 
          />
        </div>

        <div className="flex justify-between items-end pt-2 md:pt-3 border-t border-dashed border-slate-300 mt-1 md:mt-2">
          <span className="text-sm md:text-base font-bold text-slate-700">Grand Total</span>
          <span className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums tracking-tighter leading-none">
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Secondary Actions (Moved up for visibility on mobile) */}
      <div className="grid grid-cols-2 gap-2 mb-2 md:mb-4">
        {/* The KOT Buttons Group */}
        <div className={`grid grid-cols-2 gap-1.5 ${currentUserRole === 'WAITER' ? 'col-span-2' : ''}`}>
          <button 
            onClick={onSendKot} 
            disabled={!hasNewItems} 
            className="relative group py-2 md:py-2.5 font-bold text-xs md:text-[13px] rounded-xl transition-all duration-300 disabled:opacity-40 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-[0.96] bg-gradient-to-br from-slate-700 to-slate-900 text-white border border-slate-600 hover:shadow-lg overflow-hidden"
          >
            <UtensilsCrossed className="h-4 w-4 md:h-5 md:w-5" /> 
            <span className="drop-shadow-sm text-white/90">KDS Only</span>
          </button>
          <button 
            onClick={onSendKotPrint} 
            disabled={!hasNewItems} 
            className="relative group py-2 md:py-2.5 font-bold text-xs md:text-[13px] rounded-xl transition-all duration-300 disabled:opacity-40 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-[0.96] bg-gradient-to-br from-rose-400 to-rose-600 text-white border border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:shadow-[0_8px_24px_rgba(243,24,104,0.3)] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <Printer className="h-4 w-4 md:h-5 md:w-5" /> 
            <span className="drop-shadow-sm text-white/90">KDS + Print</span>
          </button>
        </div>
        {currentUserRole !== 'WAITER' && (
          <button 
            onClick={onPreBill} 
            disabled={!hasItems} 
            className="relative group py-3.5 md:py-4 font-bold text-sm rounded-2xl transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-4 hover:brightness-110 hover:-translate-y-0.5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-white border border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:shadow-[0_8px_24px_rgba(6,182,212,0.3)] focus-visible:ring-cyan-500/40 overflow-hidden disabled:hover:brightness-100 disabled:hover:translate-y-0 disabled:active:scale-100"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <Printer className="h-4 w-4 md:h-5 md:w-5 transition-transform group-hover:-translate-y-0.5 text-white/90 group-hover:text-white" /> 
            <span className="drop-shadow-sm text-white/90 group-hover:text-white">Pre-Bill</span>
            <kbd className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded ml-1 absolute right-2 bg-black/10 text-white/70 border border-white/20 group-hover:bg-black/20 group-hover:text-white transition-colors">F2</kbd>
          </button>
        )}
      </div>

      {/* Payment Actions / Context-aware Delivery UI */}
      {deliveryStatus === 'COLLECTED' ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={onCompleteDelivery}
            className="w-full py-4 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 border border-emerald-400/50 text-white font-bold rounded-2xl transition-all cursor-pointer shadow-[0_4px_16px_rgba(16,185,129,0.2)] hover:shadow-[0_8px_32px_rgba(16,185,129,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 text-sm uppercase tracking-wider group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
          >
            <Check className="h-5 w-5 animate-bounce group-hover:scale-110 transition-transform" /> Complete & Print ({collectedMethod || 'PAID'})
          </button>
        </div>
      ) : (
        <>
          {orderType === 'DELIVERY' ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onDispatchDelivery(false)}
                  disabled={!hasItems || !deliveryAddress}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 md:py-3.5 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-40 text-white font-semibold rounded-2xl transition-all cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.2)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.4)] active:scale-[0.98] text-xs uppercase tracking-wide border border-indigo-400/50 group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30"
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <Bike className="h-4 w-4 md:h-5 md:w-5 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Dispatch COD</span>
                  </div>
                  <span className="text-[10px] opacity-90 text-indigo-100">Pay at Doorstep</span>
                </button>

                <button
                  onClick={() => onDispatchDelivery(true)}
                  disabled={!hasItems || !deliveryAddress}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 md:py-3.5 bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-40 text-white font-semibold rounded-2xl transition-all cursor-pointer shadow-[0_4px_16px_rgba(168,85,247,0.2)] hover:shadow-[0_8px_32px_rgba(168,85,247,0.4)] active:scale-[0.98] text-xs uppercase tracking-wide border border-purple-400/50 group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/30"
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <QrCode className="h-4 w-4 md:h-5 md:w-5 group-hover:scale-110 transition-transform" />
                    <span>Pre-Paid (UPI)</span>
                  </div>
                  <span className="text-[10px] opacity-90 text-purple-100">Paid Online</span>
                </button>
              </div>
              {!deliveryAddress && hasItems && (
                <p className="text-[10px] md:text-[11px] text-center text-red-500 font-semibold mt-1">⚠ Enter delivery address to dispatch</p>
              )}
            </div>
          ) : (
            currentUserRole !== 'WAITER' && (
              <div>
                <PaymentGrid onSettle={onSettle} disabled={!hasItems} />
              </div>
            )
          )}
        </>
      )}

    </div>
  );
};
