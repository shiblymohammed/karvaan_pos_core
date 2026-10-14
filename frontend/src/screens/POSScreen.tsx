import React, { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  ChevronUp
} from 'lucide-react';
import { useMenuStore } from '../store/useMenuStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/cartStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { useTableStore } from '../store/useTableStore';
import { useKdsStore } from '../store/useKdsStore';
import { useStaffStore } from '../store/useStaffStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { toast } from '../store/useToastStore';
import { useAddonStore, PaidAddon } from '../store/useAddonStore';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { CustomerSelectModal } from '../components/CustomerSelectModal';
import { MapPickerModal } from '../components/MapPickerModal';
import SettlementModal, { PaymentMethod, TenderState } from '../components/SettlementModal';
import { FolioSidebar } from '../components/pos/FolioSidebar';
import { ReturnOrderModal, ReturnOrderData } from '../components/ReturnOrderModal';
import { ManagerAuthModal } from '../components/ManagerAuthModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { CustomizeItemModal } from '../components/pos/CustomizeItemModal';
import { StandaloneAddonModal } from '../components/pos/StandaloneAddonModal';
import { ParkedOrdersView } from '../components/pos/ParkedOrdersView';
import { MenuCatalogue } from '../components/pos/MenuCatalogue';
import { emitSettleBill } from '../services/socket';
import { getTerminalId } from '../services/serverConfig';

export const POSScreen: React.FC = () => {
  const {
    items, selectedTableId, selectedTableName, selectedWaiter,
    discount, heldOrders, customer, isOffline,
    orderType, deliveryAddress, deliveryFee,
    addItem, removeItemByIndex, updateQuantityByIndex, setTable, setWaiter,
    holdCurrentOrder, resumeOrder, clearCart, updateItemNoteByIndex, sendKot,
    isMobileCartOpen, setIsMobileCartOpen,
    setDiscount, setCustomer, setOrderType, setDeliveryAddress, setDeliveryFee,
    currentOrderNumber,
  } = useCartStore();

  const { tables, floors, setTableStatus } = useTableStore();
  const { depleteForOrder } = useInventoryStore();
  const { notes: predefinedNotes, discounts: predefinedDiscounts, orderPrefix, parcelChargeAmount, operatingMode } = useSettingsStore();

  React.useEffect(() => {
    if (operatingMode === 'CLOUD_KITCHEN' && orderType !== 'DELIVERY' && orderType !== 'PARCEL') {
      setOrderType('DELIVERY');
    }
  }, [operatingMode, orderType, setOrderType]);

  // ─── Modal / UI State ─────────────────────────────────────────────────────
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [receiptType, setReceiptType] = useState<'CHECKOUT' | 'PREBILL' | 'KOT' | null>(null);
  const [lastBill, setLastBill] = useState<any>(null);
  const [customizeProduct, setCustomizeProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [returnModalData, setReturnModalData] = useState<ReturnOrderData | null>(null);
  const [managerAuthAction, setManagerAuthAction] = useState<{ isOpen: boolean; title: string; desc: string; onConfirm: (authBy: string) => void } | null>(null);
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [standaloneAddonModalOpen, setStandaloneAddonModalOpen] = useState(false);
  const [settleState, setSettleState] = useState<{ isOpen: boolean; method: PaymentMethod; isProcessing?: boolean }>({
    isOpen: false,
    method: 'CASH',
    isProcessing: false,
  });

  const { currentUser } = useAuthStore();
  const { entries: ledgerEntries } = useLedgerStore();

  // ─── Totals ───────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => {
    const addonTotal = item.addons?.reduce((a: number, addon: any) => a + addon.price, 0) || 0;
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);

  let floorSurcharge = 0;
  let floorSurchargeLabel = '';
  if (selectedTableId) {
    const table = tables.find(t => t.id === selectedTableId);
    if (table) {
      const floor = floors.find(f => f.id === (table as any).floorId);
      if (floor && (floor as any).surchargeValue > 0) {
        floorSurchargeLabel = `${(floor as any).name} (${(floor as any).zone})`;
        if ((floor as any).surchargeType === 'PERCENTAGE') {
          floorSurcharge = (subtotal * (floor as any).surchargeValue) / 100;
        } else {
          floorSurcharge = (floor as any).surchargeValue;
        }
      }
    }
  }

  const appliedParcelCharge = orderType === 'PARCEL' ? (parcelChargeAmount || 0) : 0;
  const totalGst = Number((items.reduce((sum, item) =>
    sum + (item.price + (item.addons?.reduce((s: number, a: any) => s + a.price, 0) || 0)) * item.quantity *
    (1 - discount / (subtotal || 1)) *
    (useMenuStore.getState().products.find(p => p.id === item.productId)?.gstRate ?? 5) / 100, 0
  ) + (floorSurcharge + appliedParcelCharge) * 0.05).toFixed(2));
  const cgst = Number((totalGst / 2).toFixed(2));
  const sgst = Number((totalGst - cgst).toFixed(2));
  const grandTotal = Number(Math.max(0, subtotal - discount + floorSurcharge + appliedParcelCharge + cgst + sgst).toFixed(2));

  // ─── Global Keyboard Shortcuts ────────────────────────────────────────────
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (showCustomerModal) setShowCustomerModal(false);
        else if (showMapPicker) setShowMapPicker(false);
        else if (settleState.isOpen) setSettleState({ ...settleState, isOpen: false });
        else if (customizeProduct) setCustomizeProduct(null);
        else if (standaloneAddonModalOpen) setStandaloneAddonModalOpen(false);
        else if (returnModalData) setReturnModalData(null);
        else if (managerAuthAction) setManagerAuthAction(null);
        else if (isMobileCartOpen) setIsMobileCartOpen(false);
        else if (!isInput && items.length > 0) {
          if (selectedTableId) { holdCurrentOrder(); } else { clearCart(); }
        }
      }

      if (isInput) return;

      if (e.key === 'F1') {
        e.preventDefault();
        const hasNewItems = items.some(i => i.status === 'NEW');
        if (hasNewItems) sendKot();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (items.length > 0) setReceiptType('PREBILL');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowCustomerModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showCustomerModal, showMapPicker, settleState.isOpen,
    customizeProduct, returnModalData, managerAuthAction, isMobileCartOpen,
    items, selectedTableId,
  ]);

  // ─── Checkout Handler ─────────────────────────────────────────────────────
  const handleCheckout = async (tenders: TenderState) => {
    if (items.length === 0 || settleState.isProcessing) return;

    if (tenders.CREDIT > 0 && (!customer?.phone || !customer?.name)) {
      toast.error('Customer name and phone number are required for Credit (Ledger) sales.');
      setShowCustomerModal(true);
      return;
    }

    setSettleState(prev => ({ ...prev, isProcessing: true }));

    const usedMethods = Object.entries(tenders).filter(([, amt]) => amt > 0);
    const primaryMethod = usedMethods.length > 1 ? 'SPLIT' : usedMethods.length === 1 ? usedMethods[0][0] : 'CASH';

    const termId = getTerminalId();
    const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const billData = {
      orderNumber: useCartStore.getState().currentOrderNumber || `${orderPrefix}-${termId}-${Date.now().toString(36).toUpperCase()}-${uniqueId}`,
      billNumber: useCartStore.getState().checkoutBillNumber || `INV-${termId}-${Date.now().toString(36).toUpperCase()}-${uniqueId}`,
      table: selectedTableName || 'Takeaway',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Counter Staff',
      items: [...items],
      subtotal, discount, cgst, sgst, grandTotal,
      method: primaryMethod,
      tenders: { ...tenders },
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };

    useCartStore.setState({ checkoutBillNumber: billData.billNumber, currentOrderNumber: billData.orderNumber });
    const result = await emitSettleBill({ ...billData, orderType, tableId: selectedTableId, customerName: customer?.name, customerPhone: customer?.phone });

    if (result.status === 'ERROR') {
      setSettleState(prev => ({ ...prev, isProcessing: false }));
      toast.error(result.message || 'Checkout was not saved. Review pending actions.');
      return;
    }
    if (result.status === 'QUEUED') toast.info('Bill saved on this device and awaiting server confirmation.');

    if (selectedTableId) setTableStatus(selectedTableId, 'AVAILABLE');

    if (tenders.CREDIT > 0 && customer) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${customer.phone}`,
        customerName: customer.name,
        customerPhone: customer.phone,
        amount: tenders.CREDIT,
        billNumber: billData.billNumber,
        date: new Date().toLocaleDateString(),
      });
    }

    if (orderType === 'PARCEL') {
      useDeliveryStore.getState().addOrder({
        orderNumber: useCartStore.getState().currentOrderNumber || billData.orderNumber,
        orderType: 'PARCEL',
        customerName: customer?.name || 'Walk-In Guest',
        customerPhone: customer?.phone || '',
        items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        subtotal, grandTotal,
        status: 'RECEIVED',
        paymentStatus: 'COLLECTED',
        waiterName: selectedWaiter || undefined,
      });
    }

    const hasUnsentItems = items.some(i => i.status === 'NEW');
    if (hasUnsentItems) {
      // Direct counter checkout: dispatch ticket to Kitchen KDS and Queue TV
      useKdsStore.getState().addTicket({
        id: `kot-${Date.now()}`,
        orderNumber: billData.orderNumber,
        tableNumber: orderType === 'PARCEL' ? '📦 Parcel' : (selectedTableName || 'Takeaway'),
        orderType: orderType,
        customerName: customer?.name,
        items: items.map(i => {
          const addonText = i.addons && i.addons.length > 0 ? ` [Add: ${i.addons.map(a => a.name).join(', ')}]` : '';
          return { name: i.name, productId: i.productId, price: i.price, addons: i.addons, quantity: i.quantity, notes: (i.notes || '') + addonText, status: 'COOKING' };
        }),
        firedAt: new Date().toISOString()
      });
    } else if (selectedTableId && items.every(item => item.status === 'SENT')) {
      useKdsStore.getState().clearTableTickets(selectedTableName || 'Takeaway');
    }

    setLastBill(billData);
    setSettleState({ isOpen: false, method: 'CASH', isProcessing: false });
    setReceiptType('CHECKOUT');
    clearCart();
  };

  // ─── Delivery Dispatch ────────────────────────────────────────────────────
  const handleDispatchDelivery = (isPrepaid: boolean = false) => {
    if (items.length === 0) return;
    const termId = getTerminalId();
    const resolvedOrderNumber = useCartStore.getState().currentOrderNumber || `${orderPrefix}-${termId}-${Math.floor(1000 + Math.random() * 9000)}`;
    const billNum = `DEL-${termId}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const deliveryGrandTotal = grandTotal + (deliveryFee || 0);

    if (isPrepaid) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${Date.now()}`,
        customerName: customer?.name || 'Customer',
        customerPhone: customer?.phone || '',
        amount: deliveryGrandTotal,
        billNumber: billNum,
        date: new Date().toLocaleDateString(),
      });
    }

    const newItems = items.filter(i => i.status === 'NEW');
    if (newItems.length > 0) {
      useKdsStore.getState().addTicket({
        id: `kot-${Date.now()}`,
        orderNumber: resolvedOrderNumber,
        tableNumber: '🛵 Delivery',
        orderType: 'DELIVERY',
        customerName: customer?.name,
        items: newItems.map(i => {
          const addonText = i.addons && i.addons.length > 0
            ? ` [Add: ${Object.entries(i.addons.reduce((acc: any, addon: any) => { acc[addon.name] = (acc[addon.name] || 0) + 1; return acc; }, {})).map(([name, qty]) => (qty as number) > 1 ? `${qty}x ${name}` : name).join(', ')}]`
            : '';

          let subItems: { name: string; qty: number }[] | undefined;
          if (i.isCombo && i.comboItems && i.comboItems.length > 0) {
            const grouped = i.comboItems.reduce((acc: any, id: string) => {
              const pName = useMenuStore.getState().products.find(p => p.id === id)?.name || 'Unknown Item';
              if (pName) { if (!acc[pName]) acc[pName] = { qty: 0, id }; acc[pName].qty += 1; }
              return acc;
            }, {});
            subItems = Object.entries(grouped).map(([name, payload]: any) => ({ name, qty: payload.qty }));
          }

          return {
            name: i.name, quantity: i.quantity,
            notes: (i.notes || '') + addonText, status: 'COOKING',
            category: i.category, price: i.price || 0,
            productId: i.productId || 'unknown', addons: i.addons, subItems,
          };
        }),
        firedAt: new Date().toISOString(),
      });
    }

    depleteForOrder(items, 'DELIVERY');

    useDeliveryStore.getState().addOrder({
      orderNumber: resolvedOrderNumber, orderType: 'DELIVERY',
      customerName: customer?.name || 'Customer', customerPhone: customer?.phone || '',
      deliveryAddress: deliveryAddress || '', deliveryFee: deliveryFee || 0,
      items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      subtotal, grandTotal: deliveryGrandTotal,
      status: 'RECEIVED',
      paymentStatus: isPrepaid ? 'COLLECTED' : 'PENDING',
      paymentMethod: isPrepaid ? 'UPI' : undefined,
      collectedAmount: isPrepaid ? deliveryGrandTotal : undefined,
      waiterName: selectedWaiter || undefined,
    });

    const billData = {
      orderNumber: resolvedOrderNumber, billNumber: billNum,
      table: '🛵 Delivery', cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Dispatch', items: [...items],
      subtotal, discount, cgst, sgst, deliveryFee: deliveryFee || 0,
      grandTotal: deliveryGrandTotal, method: isPrepaid ? 'PREPAID (ONLINE/UPI)' : 'COD',
      customerName: customer?.name || 'Customer', customerPhone: customer?.phone || '',
      deliveryAddress: deliveryAddress || '',
      time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString(),
      isDelivery: true,
    };

    setLastBill(billData);
    setReceiptType('CHECKOUT');
    clearCart();
  };

  // ─── Pre-bill ─────────────────────────────────────────────────────────────
  const handlePrintPreBill = () => {
    if (items.length === 0) return;
    const termId = getTerminalId();
    const billData = {
      billNumber: `PRE-${termId}-${Math.floor(100000 + Math.random() * 900000)}`,
      orderNumber: `${orderPrefix}-${termId}-${Math.floor(1000 + Math.random() * 9000)}`,
      table: selectedTableName || 'Takeaway',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Counter Staff',
      items: [...items], subtotal, discount, cgst, sgst, grandTotal,
      method: 'UNPAID', time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString(),
    };
    setLastBill(billData);
    setReceiptType('PREBILL');
    if (selectedTableId) setTableStatus(selectedTableId, 'BILLED', grandTotal);
  };

  // ─── KOT / KDS + Print ───────────────────────────────────────────────────
  const handleKdsAndPrint = () => {
    const newItems = items.filter(i => i.status === 'NEW');
    if (newItems.length === 0) return;
    const termId = getTerminalId();
    const kotData = {
      orderNumber: currentOrderNumber || `${orderPrefix}-${termId}-${Math.floor(1000 + Math.random() * 9000)}`,
      billNumber: `KOT-${termId}-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      table: selectedTableName || 'Takeaway',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Counter Staff',
      items: newItems.map(i => ({ name: i.name, quantity: i.quantity, notes: i.notes, addons: i.addons })),
      subtotal: 0, discount: 0, cgst: 0, sgst: 0, grandTotal: 0,
      method: 'KOT_PRINT', time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString(),
    };
    setLastBill(kotData);
    setReceiptType('KOT');
    sendKot();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] transition-colors duration-300 text-slate-800 pb-[72px] md:pb-0">

      {/* LEFT: Product Catalog or Parked Orders */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Notch Tabs (Desktop + Mobile) */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[94vw]">
          <div className="flex items-center bg-white/80 backdrop-blur-xl p-1 rounded-full shadow-md border border-white/80 gap-1">
            <button
              onClick={() => setShowParkedOrders(false)}
              className={`relative px-3.5 py-1 text-xs rounded-full font-bold transition-all z-10 ${!showParkedOrders ? 'text-white' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {!showParkedOrders && (
                <motion.div layoutId="notchTab" className="absolute inset-0 bg-slate-800 rounded-full shadow-md -z-10" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              Menu Catalogue
            </button>
            <button
              onClick={() => setShowParkedOrders(true)}
              className={`relative flex items-center gap-1.5 px-3.5 py-1 text-xs rounded-full font-bold transition-all z-10 ${showParkedOrders ? 'text-white' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {showParkedOrders && (
                <motion.div layoutId="notchTab" className="absolute inset-0 bg-slate-800 rounded-full shadow-md -z-10" transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              Parked Orders
              {heldOrders.length > 0 && (
                <span className={`${showParkedOrders ? 'bg-[#b5ef85] text-slate-900' : 'bg-slate-300 text-slate-600'} text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm transition-colors`}>
                  {heldOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {showParkedOrders ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 pt-10 md:pt-14">
            <div className="flex-1 p-4 md:p-6 pb-[240px] lg:pb-6 overflow-y-auto">
              <ParkedOrdersView onClose={() => setShowParkedOrders(false)} />
            </div>
          </div>
        ) : (
          <MenuCatalogue
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSearchExpanded={isSearchExpanded}
            onSearchExpand={() => setIsSearchExpanded(true)}
            onSearchClose={() => { setSearchQuery(''); setIsSearchExpanded(false); }}
            onOpenAddonModal={() => setStandaloneAddonModalOpen(true)}
            onCustomize={(product) => setCustomizeProduct({ id: product.id, name: product.name, price: product.price })}
          />
        )}

        {/* Floating Mobile Cart Island - Positioned cleanly above MobileNav */}
        {!isMobileCartOpen && items.length > 0 && (
          <div className="lg:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-20 animate-in slide-in-from-bottom-6 duration-200">
            <div className="bg-[#0d212b]/95 backdrop-blur-md text-white p-2.5 px-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{items.length} Item{items.length !== 1 ? 's' : ''}</span>
                <span className="text-base font-black text-[#b5ef85]">₹{grandTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setIsMobileCartOpen(true)}
                className="bg-[#b5ef85] text-[#0d212b] px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:bg-[#a2db74] active:scale-95 transition-all shadow-lg cursor-pointer"
              >
                <span>View Cart</span>
                <div className="w-4 h-4 bg-[#0d212b]/10 rounded-full flex items-center justify-center">
                  <ChevronUp className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Folio Sidebar */}
      <FolioSidebar
        isMobileCartOpen={isMobileCartOpen}
        setIsMobileCartOpen={setIsMobileCartOpen}
        onSettle={(method) => setSettleState({ isOpen: true, method, isProcessing: false })}
        onShowCustomerModal={setShowCustomerModal}
        onShowMapPicker={setShowMapPicker}
        onReturnFolio={() => {
          setReturnModalData({
            billNumber: lastBill?.billNumber || `FOLIO-${Date.now().toString().slice(-4)}`,
            orderType,
            customerName: customer?.name || 'Walk-in Guest',
            customerPhone: customer?.phone,
            items: items.length > 0 ? items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price })) : (lastBill?.items || []),
            grandTotal: grandTotal || lastBill?.grandTotal || 0,
            paymentMethod: 'CASH',
          });
        }}
        onPreBill={handlePrintPreBill}
        onSendKotPrint={handleKdsAndPrint}
        onManagerAuthRequest={setManagerAuthAction}
        onDispatchDelivery={handleDispatchDelivery}
      />

      {/* Settlement Modal */}
      <SettlementModal
        isOpen={settleState.isOpen}
        onClose={() => setSettleState({ ...settleState, isOpen: false, isProcessing: false })}
        onConfirm={handleCheckout}
        isProcessing={settleState.isProcessing}
        totalAmount={grandTotal}
        initialMethod={settleState.method}
        hasCustomer={!!customer}
        onRequestCustomer={() => {
          setSettleState({ ...settleState, isOpen: false, isProcessing: false });
          setShowCustomerModal(true);
        }}
      />

      {/* Extracted Modals */}
      {receiptType && lastBill && (
        <ReceiptModal
          receiptType={receiptType}
          bill={lastBill}
          orderType={orderType}
          onClose={() => setReceiptType(null)}
          onReturn={() => {
            setReturnModalData({
              billNumber: lastBill.billNumber,
              orderType,
              customerName: lastBill.customer || 'Walk-in Guest',
              items: lastBill.items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price })),
              grandTotal: lastBill.grandTotal,
              paymentMethod: lastBill.method,
            });
            setReceiptType(null);
          }}
        />
      )}

      {customizeProduct && (
        <CustomizeItemModal
          product={customizeProduct}
          onConfirm={(note, addons) => {
            addItem({ id: customizeProduct.id, name: customizeProduct.name, price: customizeProduct.price }, note, addons.length > 0 ? addons.map(a => ({ id: a.id, name: a.name, price: a.price })) : undefined);
            setCustomizeProduct(null);
          }}
          onClose={() => setCustomizeProduct(null)}
        />
      )}

      {standaloneAddonModalOpen && (
        <StandaloneAddonModal onClose={() => setStandaloneAddonModalOpen(false)} />
      )}

      {showCustomerModal && (
        <CustomerSelectModal
          currentCustomer={customer}
          onSelect={(c) => setCustomer(c)}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {showMapPicker && (
        <MapPickerModal
          initialAddress={deliveryAddress}
          onConfirm={(address) => setDeliveryAddress(address)}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <ReturnOrderModal
        isOpen={!!returnModalData}
        onClose={() => setReturnModalData(null)}
        orderData={returnModalData}
        onConfirmReturn={(returnedItems, action, reason, refundDest, isFullOrder) => {
          if (isFullOrder && items.length > 0) clearCart();
        }}
      />

      <ManagerAuthModal
        isOpen={!!managerAuthAction?.isOpen}
        onClose={() => setManagerAuthAction(null)}
        actionTitle={managerAuthAction?.title || 'Manager Authorization Required'}
        actionDescription={managerAuthAction?.desc}
        onSuccess={(authBy) => { if (managerAuthAction?.onConfirm) managerAuthAction.onConfirm(authBy); }}
      />
    </div>
  );
};

export default POSScreen;
