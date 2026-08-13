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
import { CheckCircle2, Utensils } from 'lucide-react';

interface FolioSidebarProps {
  isMobileCartOpen: boolean;
  setIsMobileCartOpen: (open: boolean) => void;
  onSettle: (method: PaymentMethod) => void;
  onShowCustomerModal: (show: boolean) => void;
  onShowMapPicker: (show: boolean) => void;
  onReturnFolio: () => void;
  onPreBill: () => void;
  onManagerAuthRequest: (action: any) => void;
}

export const FolioSidebar: React.FC<FolioSidebarProps> = ({
  isMobileCartOpen,
  setIsMobileCartOpen,
  onSettle,
  onShowCustomerModal,
  onShowMapPicker,
  onReturnFolio,
  onPreBill,
  onManagerAuthRequest
}) => {
  const { 
    items, selectedTableId, selectedTableName, selectedWaiter, 
    discount, customer,
    orderType, deliveryAddress, deliveryFee, deliveryStatus, collectedMethod,
    removeItemByIndex, updateQuantityByIndex, setWaiter, setTable,
    holdCurrentOrder, clearCart, updateItemNoteByIndex, sendKot,
    setDiscount, setOrderType, setDeliveryFee
  } = useCartStore();

  const [activeFolioTab, setActiveFolioTab] = useState<'CURRENT' | 'PARKED'>('CURRENT');
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

  const totalGst = (subtotal - discount + floorSurcharge) * 0.05;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const grandTotal = Math.max(0, subtotal - discount + floorSurcharge + cgst + sgst);

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
      if (window.confirm(`Void sent item "${item.name}"?`)) {
        removeItemByIndex(idx);
      }
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
        if (window.confirm('Void this entire sent folio? Cooking items will be cancelled.')) {
          clearCart();
        }
      } else {
        onManagerAuthRequest({
          isOpen: true,
          title: 'Void Sent Folio',
          desc: 'This folio has cooking items sent to KDS. Manager PIN required to void.',
          onConfirm: () => clearCart()
        });
      }
    } else {
      if (window.confirm('Delete this entire folio? This cannot be undone.')) clearCart();
    }
  };

  return (
    <div className={`${isMobileCartOpen ? 'fixed inset-0 z-50 bg-white m-0 rounded-none' : `hidden lg:flex col-span-12 lg:col-span-4 bg-white rounded-l-[32px] border-l border-slate-200 z-20`} flex-col justify-between overflow-hidden transition-all shadow-[-8px_0_24px_rgba(0,0,0,0.02)]`}>
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
      />

      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2 md:p-3 relative">
        {items.length === 0 ? (
          <EmptyCartState />
        ) : (
          <div className="flex flex-col">
            {items.map((item, idx) => (
              <FolioItemCard
                key={`${item.productId}-${idx}`}
                item={item}
                index={idx}
                onUpdateQuantity={updateQuantityByIndex}
                onRemove={removeItemByIndex}
                onUpdateNote={updateItemNoteByIndex}
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
        collectedMethod={collectedMethod}
        deliveryAddress={deliveryAddress}
        currentUserRole={currentUser?.role}
        onApplyDiscount={setDiscount}
        onSettle={onSettle}
        onSendKot={sendKot}
        onPreBill={onPreBill}
        onCompleteDelivery={() => { /* Handled in POSScreen for bill generation */ }}
        onDispatchDelivery={(isPrepaid) => { /* Handled in POSScreen */ }}
      />
    </div>
  );
};
