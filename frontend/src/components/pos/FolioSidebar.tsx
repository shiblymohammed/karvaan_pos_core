import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useTableStore } from '../../store/useTableStore';
import { useStaffStore } from '../../store/useStaffStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useKdsStore } from '../../store/useKdsStore';
import { useSettingsStore } from '../../store/useSettingsStore';

import { FolioHeader } from './FolioHeader';
import { FolioFooter } from './FolioFooter';
import { FolioItemCard } from './FolioItemCard';
import { EmptyCartState } from './EmptyCartState';
import { PaymentMethod } from '../SettlementModal';
import { CheckCircle2, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '../shared/ConfirmModal';

interface FolioSidebarProps {
  isMobileCartOpen: boolean;
  setIsMobileCartOpen: (open: boolean) => void;
  onSettle: (method: PaymentMethod) => void;
  onShowCustomerModal: (show: boolean) => void;
  onShowMapPicker: (show: boolean) => void;
  onReturnFolio: () => void;
  onSendKotPrint: () => void;
  onPreBill: () => void;
  onManagerAuthRequest: (action: any) => void;
  onDispatchDelivery?: (isPrepaid: boolean) => void;
  onCompleteDelivery?: () => void;
}

export const FolioSidebar: React.FC<FolioSidebarProps> = ({
  isMobileCartOpen,
  setIsMobileCartOpen,
  onSettle,
  onShowCustomerModal,
  onShowMapPicker,
  onReturnFolio,
  onPreBill,
  onSendKotPrint,
  onManagerAuthRequest,
  onDispatchDelivery,
  onCompleteDelivery
}) => {
  const { 
    items, selectedTableId, selectedTableName, selectedWaiter, 
    discount, customer,
    orderType, deliveryAddress, deliveryFee, deliveryStatus, collectedMethod,
    removeItemByIndex, updateQuantityByIndex, setWaiter, setTable,
    holdCurrentOrder, clearCart, updateItemNoteByIndex, updateItemAddonsByIndex, sendKot,
    setDiscount, setOrderType, setDeliveryFee
  } = useCartStore();

  const [activeFolioTab, setActiveFolioTab] = useState<'CURRENT' | 'PARKED'>('CURRENT');
  const [isFolioExpanded, setIsFolioExpanded] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: '', message: '', action: () => {} });
  const { tables, floors } = useTableStore();
  const { getActiveWaiters } = useStaffStore();
  const { currentUser } = useAuthStore();
  const kdsTickets = useKdsStore(state => state.tickets);
  const { discounts: predefinedDiscounts } = useSettingsStore();
  const activeWaiters = getActiveWaiters();

  // Calculations
  const subtotal = items.reduce((sum, item) => {
    const addonTotal = item.addons?.reduce((a: any, addon: any) => a + addon.price, 0) || 0;
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);

  let floorSurcharge = 0;
  let floorSurchargeLabel = '';
  if (selectedTableId) {
    const table = tables.find(t => t.id === selectedTableId);
    if (table) {
      const floor = floors.find(f => f.id === table.floorId);
      if (floor && floor.surchargeValue > 0) {
        floorSurchargeLabel = `${floor.name} (${floor.zone})`;
        floorSurcharge = floor.surchargeType === 'PERCENTAGE' 
          ? (subtotal * floor.surchargeValue) / 100 
          : floor.surchargeValue;
      }
    }
  }

  const appliedParcelCharge = orderType === 'PARCEL' ? (useSettingsStore.getState().parcelChargeAmount || 0) : 0;
  const totalGst = (subtotal - discount + floorSurcharge + appliedParcelCharge) * 0.05;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const grandTotal = Math.max(0, subtotal - discount + floorSurcharge + appliedParcelCharge + cgst + sgst);

  const getKitchenStatusBadge = (tableName: string | null, type?: string) => {
    let tableToMatch = type === 'PARCEL' ? '📦 Parcel' : type === 'DELIVERY' ? '🛵 Delivery' : (tableName || 'Takeaway');
    const tickets = kdsTickets.filter(t => t.tableNumber === tableToMatch);
    if (tickets.length === 0) return null;
    if (tickets.some(t => t.status === 'SERVED')) return <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><CheckCircle2 className="h-3 w-3" /> Served</span>;
    if (tickets.some(t => t.status === 'READY')) return <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm animate-pulse"><CheckCircle2 className="h-3 w-3" /> Prepared</span>;
    return <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-sm"><Utensils className="h-3 w-3" /> Preparing</span>;
  };

  const handleVoidItem = (idx: number, item: any) => {
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.permissions?.canVoid) {
      setConfirmConfig({
        isOpen: true,
        title: 'Void Item',
        message: `Void sent item "${item.name}"?`,
        action: () => removeItemByIndex(idx)
      });
    } else {
      onManagerAuthRequest({
        isOpen: true,
        title: `Void Sent Item: ${item.name}`,
        desc: `Item "${item.name}" is already cooking/sent to KDS. Manager PIN required to void.`,
        onConfirm: () => removeItemByIndex(idx)
      });
    }
  };

  const handleClearFolio = () => {
    const hasSent = items.some(i => i.status === 'SENT');
    if (hasSent) {
      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.permissions?.canVoid) {
        setConfirmConfig({
          isOpen: true,
          title: 'Void Folio',
          message: 'Void this entire sent folio? Cooking items will be cancelled.',
          action: () => clearCart()
        });
      } else {
        onManagerAuthRequest({
          isOpen: true,
          title: 'Void Sent Folio',
          desc: 'This folio has cooking items sent to KDS. Manager PIN required to void.',
          onConfirm: () => clearCart()
        });
      }
    } else {
      setConfirmConfig({
        isOpen: true,
        title: 'Delete Folio',
        message: 'Delete this entire folio? This cannot be undone.',
        action: () => clearCart()
      });
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileCartOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}
      
      {/* Collapse Button (Desktop/Tablet) */}
      <button 
        onClick={() => setIsFolioExpanded(!isFolioExpanded)}
        className={`hidden lg:flex flex-col items-center justify-center rounded-l-2xl border-y border-l transition-all duration-300 fixed top-1/2 -translate-y-1/2 z-[60] cursor-pointer shadow-[-12px_0_30px_rgba(0,0,0,0.25)] select-none touch-manipulation group/foliobtn overflow-visible
          ${isFolioExpanded ? 'h-20 w-5 hover:w-6' : 'h-36 w-8 hover:w-9'}
          ${isFolioExpanded 
            ? 'bg-white/70 backdrop-blur-xl border-white/60 text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-[-5px_0_15px_rgba(0,0,0,0.1)]' 
            : (items.length > 0 
                ? 'bg-gradient-to-b from-[#b5ef85] to-[#8cc63f] border-[#b5ef85]/50 text-[#0f172a] hover:shadow-[-15px_0_40px_rgba(140,198,63,0.3)]' 
                : 'bg-[#15202b] bg-[linear-gradient(135deg,_#1e293b,_#0f172a)] border-white/10 text-slate-400 hover:text-white hover:border-white/30 hover:shadow-[-15px_0_40px_rgba(0,0,0,0.4)]')} 
          ${isFolioExpanded ? 'xl:right-[446px] lg:right-[416px]' : 'lg:right-[16px]'}`}
      >
        {/* Ambient Glow effect when items are pending and it's closed */}
        {!isFolioExpanded && items.length > 0 && (
          <div className="absolute inset-0 rounded-l-2xl bg-[#8cc63f] blur-md opacity-40 animate-pulse -z-10" />
        )}

        {/* Floating Pulsing Badge */}
        {!isFolioExpanded && items.length > 0 && (
          <div className="absolute -top-2.5 -left-3.5">
            <span className="relative flex h-[26px] w-[26px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>
              <span className="relative flex items-center justify-center rounded-full h-[26px] w-[26px] bg-gradient-to-br from-red-500 to-rose-700 border border-white/40 text-white text-[12px] font-black shadow-xl transform transition-transform group-hover/foliobtn:scale-110">
                {items.length}
              </span>
            </span>
          </div>
        )}

        {/* Icon & Sideways Label */}
        {isFolioExpanded ? (
          <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover/foliobtn:translate-x-0.5 drop-shadow-md" />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <ChevronLeft className="h-5 w-5 transition-transform duration-300 group-hover/foliobtn:-translate-x-0.5 drop-shadow-md" />
            {items.length > 0 && (
              <span className="text-[10px] font-black tracking-widest -rotate-90 mt-4 opacity-80 shadow-black drop-shadow-sm">CART</span>
            )}
          </div>
        )}
      </button>

      {/* Sidebar / Bottom Sheet */}
      <div className={`fixed inset-x-0 bottom-0 top-12 z-50 bg-white/90 backdrop-blur-3xl rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col justify-between overflow-hidden transition-all duration-300 ease-out lg:static lg:flex lg:col-span-4 ${isFolioExpanded ? 'lg:w-[400px] xl:w-[430px] border-l border-white/40 shadow-[-12px_0_40px_rgba(0,0,0,0.06)]' : 'lg:w-0 border-l-0 shadow-none'} lg:rounded-none lg:rounded-l-[32px] ${isMobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
        
        {/* Inner Fixed-Width Wrapper to prevent layout jump during width animation */}
        <div className="w-full lg:w-[400px] xl:w-[430px] h-full flex flex-col flex-1 shrink-0">
        
        {/* Mobile Swipe Handle */}
        <div className="w-full flex justify-center pt-3 pb-1 lg:hidden bg-transparent" onClick={() => setIsMobileCartOpen(false)}>
          <div className="w-12 h-1.5 bg-slate-300/80 rounded-full" />
        </div>
      <FolioHeader
        orderType={orderType}
        setOrderType={setOrderType}
        activeFolioTab={activeFolioTab}
        setActiveFolioTab={setActiveFolioTab}
        deliveryAddress={deliveryAddress}
        deliveryFee={deliveryFee}
        setDeliveryFee={setDeliveryFee}
        setShowMapPicker={onShowMapPicker}
        activeWaiters={activeWaiters}
        selectedWaiter={selectedWaiter}
        setWaiter={setWaiter}
        selectedTableName={selectedTableName}
        kdsStatusBadge={items.some(i => i.status === 'SENT') ? getKitchenStatusBadge(selectedTableName, orderType) : null}
        customer={customer}
        setShowCustomerModal={onShowCustomerModal}
        hasItems={items.length > 0}
        hasSentItems={items.some(i => i.status === 'SENT')}
        onParkFolio={holdCurrentOrder}
        onClearFolio={handleClearFolio}
        onReturnFolio={onReturnFolio}
        currentUserRole={currentUser?.role}
        operatingMode={useSettingsStore.getState().operatingMode || 'FINE_DINING'}
      />

      <div className="flex-1 overflow-y-auto p-2 md:p-3 relative z-0">
        {/* Subtle inner shadow at the top for depth */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/[0.02] to-transparent pointer-events-none z-10" />
        
        {items.length === 0 ? (
          <EmptyCartState />
        ) : (
          <div className="flex flex-col gap-2 relative z-0">
            {items.map((item, idx) => (
              <FolioItemCard
                key={`${item.productId}-${idx}`}
                item={item}
                index={idx}
                onUpdateQuantity={updateQuantityByIndex}
                onRemove={removeItemByIndex}
                onUpdateNote={updateItemNoteByIndex}
                onUpdateAddons={updateItemAddonsByIndex}
                onVoid={handleVoidItem}
                kdsStatusBadge={getKitchenStatusBadge(selectedTableName, orderType)}
              />
            ))}
          </div>
        )}
      </div>

      <FolioFooter
        items={items}
        subtotal={subtotal}
        floorSurcharge={floorSurcharge}
        floorSurchargeLabel={floorSurchargeLabel}
        cgst={cgst}
        sgst={sgst}
        discount={discount}
        grandTotal={grandTotal}
        orderType={orderType}
        deliveryStatus={deliveryStatus}
        deliveryFee={deliveryFee}
        parcelCharge={useSettingsStore.getState().parcelChargeAmount}
        collectedMethod={collectedMethod}
        deliveryAddress={deliveryAddress}
        currentUserRole={currentUser?.role}
        onApplyDiscount={setDiscount}
        onSettle={onSettle}
        onSendKot={sendKot}
        onSendKotPrint={onSendKotPrint}
        onPreBill={onPreBill}
        onCompleteDelivery={onCompleteDelivery || (() => {})}
        onDispatchDelivery={onDispatchDelivery || (() => {})}
      />
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmConfig.isOpen}
      title={confirmConfig.title}
      message={confirmConfig.message}
      onConfirm={confirmConfig.action}
      onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
    />
    </>
  );
};
