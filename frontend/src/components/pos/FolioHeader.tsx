import React from 'react';
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
}

export const FolioHeader: React.FC<FolioHeaderProps> = ({
  orderType, setOrderType, activeFolioTab, setActiveFolioTab,
  deliveryAddress, deliveryFee, setDeliveryFee, setShowMapPicker,
  activeWaiters, selectedWaiter, setWaiter,
  selectedTableName, kdsStatusBadge,
  customer, setShowCustomerModal,
  hasItems, hasSentItems, onParkFolio, onClearFolio, onReturnFolio, currentUserRole
}) => {
  return (
    <div className="flex flex-col shrink-0 bg-white border-b border-slate-200 relative z-20 rounded-t-[32px] lg:rounded-t-none">
      
      {/* Order Type Tabs (Flushed to top) */}
      <div className="flex w-full bg-slate-50 border-b border-slate-200">
        <button 
          onClick={() => setOrderType('DINE_IN')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            orderType === 'DINE_IN' 
              ? 'text-emerald-700 bg-white border-b-2 border-emerald-500' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'
          }`}
        >
          <Utensils className="h-4 w-4" /> 
          <span className="tracking-wide">Dine-In</span>
        </button>

        <button 
          onClick={() => setOrderType('PARCEL')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            orderType === 'PARCEL' 
              ? 'text-emerald-700 bg-white border-b-2 border-emerald-500' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'
          }`}
        >
          <Package className="h-4 w-4" /> 
          <span className="tracking-wide">Parcel</span>
        </button>

        <button 
          onClick={() => setOrderType('DELIVERY')}
          className={`flex-1 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            orderType === 'DELIVERY' 
              ? 'text-emerald-700 bg-white border-b-2 border-emerald-500' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-b-2 border-transparent'
          }`}
        >
          <Bike className="h-4 w-4" /> 
          <span className="tracking-wide">Delivery</span>
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Context Info (Table, Customer, Delivery) */}
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase tracking-wider`}>
                {selectedTableName ? selectedTableName : 'WALK-IN'}
              </span>
              {kdsStatusBadge}
            </div>

            <button
              onClick={() => setShowCustomerModal(true)}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer text-xs px-2.5 py-1.5 rounded-lg border shadow-sm ${
                customer
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold truncate max-w-[120px]">
                {customer ? customer.name : 'Add Guest'}
              </span>
            </button>
          </div>

          {/* Delivery Specifics */}
          {orderType === 'DELIVERY' && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
              <button
                onClick={() => setShowMapPicker(true)}
                className="flex-1 text-left text-xs font-semibold truncate text-slate-600 hover:text-slate-800"
              >
                {deliveryAddress || <span className="text-slate-400 italic">Set delivery address...</span>}
              </button>
              <div className="relative shrink-0 flex items-center">
                <span className="text-xs font-bold text-slate-400 mr-1">Fee ₹</span>
                <input 
                  type="number" 
                  value={deliveryFee || ''} 
                  onChange={e => setDeliveryFee(Number(e.target.value))} 
                  placeholder="0" 
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold focus:outline-none focus:border-emerald-500" 
                />
              </div>
            </div>
          )}

          {/* Waiter Selection */}
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
