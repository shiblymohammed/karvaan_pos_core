import React from 'react';
import { motion } from 'framer-motion';
import { 
  Utensils, Package, Bike, MapPin, User, Pause, Trash2, RotateCcw 
} from 'lucide-react';

interface FolioHeaderProps {
  orderType: string;
  setOrderType: (type: 'DINE_IN' | 'PARCEL' | 'DELIVERY') => void;
  activeFolioTab: 'CURRENT' | 'PARKED';
  setActiveFolioTab: (tab: 'CURRENT' | 'PARKED') => void;
  
  deliveryAddress?: string;
  deliveryFee?: number;
  setDeliveryFee: (fee: number) => void;
  setShowMapPicker: (show: boolean) => void;

  activeWaiters: any[];
  selectedWaiter: string | null;
  setWaiter: (waiter: string | null) => void;

  selectedTableName: string | null;
  kdsStatusBadge?: React.ReactNode;
  
  customer: any;
  setShowCustomerModal: (show: boolean) => void;

  hasItems: boolean;
  hasSentItems: boolean;
  onParkFolio: () => void;
  onClearFolio: () => void;
  onReturnFolio: () => void;
  currentUserRole?: string;
  operatingMode?: string;
}

export const FolioHeader: React.FC<FolioHeaderProps> = ({
  orderType, setOrderType, activeFolioTab, setActiveFolioTab,
  deliveryAddress, deliveryFee, setDeliveryFee, setShowMapPicker,
  activeWaiters, selectedWaiter, setWaiter,
  selectedTableName, kdsStatusBadge,
  customer, setShowCustomerModal,
  hasItems, hasSentItems, onParkFolio, onClearFolio, onReturnFolio, currentUserRole, operatingMode = 'FINE_DINING'
}) => {
  return (
    <div className="flex flex-col shrink-0 bg-transparent relative z-20 rounded-t-[32px] lg:rounded-t-none border-b border-white/20">
      
      {/* Order Type Tabs (Flushed to top) */}
      <div className="px-3 pt-2 md:px-4 md:pt-3">
        <div className="flex w-full bg-black/5 backdrop-blur-sm p-1 rounded-[14px] shadow-inner relative border border-white/20">
          
          {operatingMode !== 'CLOUD_KITCHEN' && (
            <button 
              onClick={() => setOrderType('DINE_IN')}
              className={`relative flex-1 py-1.5 md:py-2 text-[11px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer rounded-xl z-10 ${
                orderType === 'DINE_IN' 
                  ? 'text-[#6a9a2a]' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {orderType === 'DINE_IN' && (
                <motion.div
                  layoutId="orderTypePill"
                  className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/60 -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Utensils className="h-3.5 w-3.5 md:h-4 md:w-4" /> 
              <span className="tracking-wide">{operatingMode === 'QSR' ? 'Eat-In' : 'Dine-In'}</span>
            </button>
          )}

          <button 
            onClick={() => setOrderType('PARCEL')}
            className={`relative flex-1 py-1.5 md:py-2 text-[11px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer rounded-xl z-10 ${
              orderType === 'PARCEL' 
                ? 'text-[#6a9a2a]' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {orderType === 'PARCEL' && (
              <motion.div
                layoutId="orderTypePill"
                className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/60 -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Package className="h-3.5 w-3.5 md:h-4 md:w-4" /> 
            <span className="tracking-wide">Parcel</span>
          </button>

          <button 
            onClick={() => setOrderType('DELIVERY')}
            className={`relative flex-1 py-1.5 md:py-2 text-[11px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer rounded-xl z-10 ${
              orderType === 'DELIVERY' 
                ? 'text-[#6a9a2a]' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {orderType === 'DELIVERY' && (
              <motion.div
                layoutId="orderTypePill"
                className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/60 -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Bike className="h-3.5 w-3.5 md:h-4 md:w-4" /> 
            <span className="tracking-wide">Delivery</span>
          </button>
        </div>
      </div>

      <div className="px-3 py-2 md:px-4 md:py-3 flex flex-col gap-2 md:gap-3">
        {/* Context Info (Table, Customer, Delivery) */}
        <div className="flex flex-col gap-2 md:gap-3 border-b border-black/5 pb-2 md:pb-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className={`text-[10px] md:text-xs font-bold px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg bg-black/5 backdrop-blur-md text-slate-700 uppercase tracking-wider border border-white/30 shadow-inner`}>
                {selectedTableName ? selectedTableName : 'WALK-IN'}
              </span>
              {kdsStatusBadge}
            </div>

            <button
              onClick={() => setShowCustomerModal(true)}
              className={`flex items-center gap-1.5 transition-all duration-300 cursor-pointer text-xs px-2.5 py-1.5 rounded-lg border shadow-sm active:scale-95 group ${
                customer
                  ? 'text-white bg-[#8cc63f] hover:bg-[#7ab133] border-[#7ab133]'
                  : 'text-slate-600 bg-white/70 backdrop-blur-md border-white/60 hover:bg-white hover:border-emerald-200'
              }`}
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold truncate max-w-[120px]">
                {customer ? customer.name : 'Add Guest'}
              </span>
              <kbd className={`hidden md:inline-flex items-center justify-center px-1 text-[8px] font-black rounded opacity-70 group-hover:opacity-100 ${customer ? 'bg-black/20 text-white' : 'bg-slate-100 border border-slate-200 text-slate-400'}`}>F9</kbd>
            </button>
          </div>

          {/* Delivery Specifics */}
          {orderType === 'DELIVERY' && (
            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md p-2 rounded-xl border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <MapPin className="h-4 w-4 text-[#8cc63f] shrink-0" />
              <button
                onClick={() => setShowMapPicker(true)}
                className="flex-1 text-left text-xs font-bold truncate text-slate-700 hover:text-[#8cc63f] transition-colors cursor-pointer"
              >
                {deliveryAddress || <span className="text-slate-400 italic">Set delivery address...</span>}
              </button>
              <div className="relative shrink-0 flex items-center bg-white/50 rounded-lg p-0.5 border border-white/60 shadow-inner">
                <span className="text-[10px] font-black text-slate-500 ml-1.5 mr-1 uppercase tracking-wider">Fee ₹</span>
                <input 
                  type="number" 
                  value={deliveryFee === 0 ? '' : deliveryFee} 
                  onChange={e => setDeliveryFee(e.target.value === '' ? 0 : Number(e.target.value))} 
                  placeholder="0" 
                  className="w-12 px-1.5 py-1 bg-white border border-transparent rounded-md text-xs font-black text-slate-800 focus:outline-none focus:border-[#8cc63f] focus:ring-2 focus:ring-[#8cc63f]/20 text-center shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                />
              </div>
            </div>
          )}

          {/* Waiter Selection */}
          {operatingMode === 'FINE_DINING' && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {activeWaiters.map(w => (
                <button
                  key={w.id}
                  onClick={() => setWaiter(selectedWaiter === w.name ? null : w.name)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 border shadow-sm ${
                    selectedWaiter === w.name 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Header Tools (Park, Delete, Return) */}
        <div className="flex justify-end gap-2">
          {currentUserRole !== 'WAITER' && (
            <button
              onClick={onReturnFolio}
              disabled={!hasItems}
              className="p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-40 rounded-lg border border-transparent hover:border-amber-200 transition-colors shadow-sm"
              title="Return / Refund Item"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button 
            onClick={onParkFolio} 
            disabled={!hasItems} 
            className="p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 rounded-lg border border-transparent hover:border-slate-200 transition-colors shadow-sm flex items-center gap-1 text-xs font-bold" 
            title="Park/Hold Folio"
          >
            <Pause className="h-4 w-4" /> Park
          </button>
          
          <button 
            onClick={onClearFolio} 
            disabled={!hasItems} 
            className="p-2 text-red-500 hover:bg-red-50 disabled:opacity-40 rounded-lg border border-transparent hover:border-red-200 transition-colors shadow-sm flex items-center gap-1 text-xs font-bold" 
            title={hasSentItems ? "Void Sent Folio" : "Delete Folio"}
          >
            <Trash2 className="h-4 w-4" /> Void
          </button>
        </div>

      </div>
    </div>
  );
};
