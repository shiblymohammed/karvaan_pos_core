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
  collectedMethod?: string;
  deliveryAddress?: string;
  
  currentUserRole?: string;
  
  onApplyDiscount: (amount: number) => void;
  onSettle: (method: PaymentMethod) => void;
  onSendKot: () => void;
  onPreBill: () => void;
  onCompleteDelivery: () => void;
  onDispatchDelivery: (isPrepaid: boolean) => void;
}

export const FolioFooter: React.FC<FolioFooterProps> = ({
  items, subtotal, floorSurcharge, floorSurchargeLabel, cgst, sgst, discount, grandTotal,
  orderType, deliveryStatus, deliveryFee, collectedMethod, deliveryAddress,
  currentUserRole,
  onApplyDiscount, onSettle, onSendKot, onPreBill,
  onCompleteDelivery, onDispatchDelivery
}) => {
  const hasItems = items.length > 0;
  const hasNewItems = items.some(i => i.status === 'NEW');

  return (
    <div className="flex flex-col shrink-0 p-4 bg-white z-10 border-t border-slate-200">
      
      {/* Order Summary Card */}
      <div className="flex flex-col space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-4">
        
        <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
          <span>Subtotal</span>
          <span className="text-slate-800">₹{subtotal.toFixed(2)}</span>
        </div>
        
        {floorSurcharge > 0 && (
          <div className="flex justify-between items-center text-sm font-semibold text-amber-600">
            <span>Surcharge: {floorSurchargeLabel}</span>
            <span>+₹{floorSurcharge.toFixed(2)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm font-semibold text-slate-500">
          <span>Taxes (5%)</span>
          <span className="text-slate-800">₹{(cgst + sgst).toFixed(2)}</span>
        </div>

        {/* Discount Selector */}
        <div className="pt-2">
          <DiscountSelector 
            subtotal={subtotal} 
            currentDiscount={discount} 
            onApplyDiscount={onApplyDiscount} 
          />
        </div>

        <div className="flex justify-between items-end pt-3 border-t border-dashed border-slate-300 mt-2">
          <span className="text-base font-bold text-slate-700">Grand Total</span>
          <span className="text-3xl font-black text-emerald-600 leading-none">
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment Actions / Context-aware Delivery UI */}
      {deliveryStatus === 'COLLECTED' ? (
        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={onCompleteDelivery}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            <Check className="h-5 w-5 animate-bounce" /> Complete & Print ({collectedMethod || 'PAID'})
          </button>
        </div>
      ) : (
        <>
          {orderType === 'DELIVERY' ? (
            <div className="flex flex-col gap-2 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onDispatchDelivery(false)}
                  disabled={!hasItems || !deliveryAddress}
                  className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 text-xs uppercase tracking-wide"
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <Bike className="h-4 w-4" />
                    <span>Dispatch COD</span>
                  </div>
                  <span className="text-[10px] opacity-80 text-slate-300">Pay at Doorstep</span>
                </button>

                <button
                  onClick={() => onDispatchDelivery(true)}
                  disabled={!hasItems || !deliveryAddress}
                  className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 text-xs uppercase tracking-wide"
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <QrCode className="h-4 w-4" />
                    <span>Pre-Paid (UPI)</span>
                  </div>
                  <span className="text-[10px] opacity-80 text-emerald-100">Paid Online</span>
                </button>
              </div>
              {!deliveryAddress && hasItems && (
                <p className="text-[11px] text-center text-red-500 font-semibold">⚠ Enter delivery address to dispatch</p>
              )}
            </div>
          ) : (
            currentUserRole !== 'WAITER' && (
              <div className="mb-4">
                <PaymentGrid onSettle={onSettle} disabled={!hasItems} />
              </div>
            )
          )}
        </>
      )}

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={onSendKot} 
          disabled={!hasNewItems} 
          className={`py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-xl border border-emerald-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 ${currentUserRole === 'WAITER' ? 'col-span-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' : ''}`}
        >
          <UtensilsCrossed className="h-4 w-4" /> Send KOT
        </button>
        {currentUserRole !== 'WAITER' && (
          <button 
            onClick={onPreBill} 
            disabled={!hasItems} 
            className="py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Printer className="h-4 w-4" /> Pre-Bill
          </button>
        )}
      </div>

    </div>
  );
};
