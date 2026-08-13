import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Barcode, Plus, Minus, Trash2, Pause, Play, 
  CreditCard, Banknote, QrCode, Split, Share2, Printer, 
  CheckCircle2, AlertCircle, Sparkles, Utensils, X, Zap,
  Clock, Edit3, User, Flame, MessageSquare, Smartphone, UtensilsCrossed, ChevronUp, ChevronDown,
  MapPin, Bike, Package, Check, RotateCcw, ArrowLeft
} from 'lucide-react';
import { useMenuStore } from '../store/useMenuStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/cartStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { useTableStore } from '../store/useTableStore';
import { useKdsStore } from '../store/useKdsStore';
import { useStaffStore } from '../store/useStaffStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAddonStore, PaidAddon } from '../store/useAddonStore';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { CustomerSelectModal } from '../components/CustomerSelectModal';
import { MapPickerModal } from '../components/MapPickerModal';
import SettlementModal, { PaymentMethod, TenderState } from '../components/SettlementModal';
import { MenuGrid } from '../components/pos/MenuGrid';
import { FolioSidebar } from '../components/pos/FolioSidebar';
import { CategorySidebar } from '../components/pos/CategorySidebar';
import { useInventoryStore } from '../store/useInventoryStore';
import { ReturnOrderModal, ReturnOrderData } from '../components/ReturnOrderModal';
import { ManagerAuthModal } from '../components/ManagerAuthModal';
import { emitSettleBill } from '../services/socket';
import { getServerUrl } from '../services/serverConfig';

export const POSScreen: React.FC = () => {
  const { 
    items, selectedTableId, selectedTableName, selectedWaiter, 
    discount, heldOrders, customer, isOffline,
    orderType, deliveryAddress, deliveryFee, deliveryStatus, collectedMethod,
    addItem, removeItemByIndex, updateQuantityByIndex, setTable, setWaiter, 
    holdCurrentOrder, resumeOrder, clearCart, updateItemNoteByIndex, sendKot,
    setDiscount, setCustomer, setOrderType, setDeliveryAddress, setDeliveryFee
  } = useCartStore();
  const kdsTickets = useKdsStore(state => state.tickets);
  
  const { tables, floors, setTableStatus } = useTableStore();
  const { getActiveWaiters } = useStaffStore();
  const { checkIs86d, depleteForOrder } = useInventoryStore();
  const { notes: predefinedNotes, discounts: predefinedDiscounts } = useSettingsStore();
  
  const activeWaiters = getActiveWaiters();

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });

  const [receiptType, setReceiptType] = useState<'CHECKOUT' | 'PREBILL' | null>(null);
  const [lastBill, setLastBill] = useState<any>(null);
  const [customNoteModal, setCustomNoteModal] = useState<{ id: string; name: string; price: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<PaidAddon[]>([]);
  const [returnModalData, setReturnModalData] = useState<ReturnOrderData | null>(null);
  const [managerAuthAction, setManagerAuthAction] = useState<{ isOpen: boolean; title: string; desc: string; onConfirm: (authBy: string) => void } | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settlement state
  const [settleState, setSettleState] = useState<{ isOpen: boolean; method: PaymentMethod }>({
    isOpen: false,
    method: 'CASH'
  });

  const { products, categories } = useMenuStore();
  const { currentUser } = useAuthStore();
  const { getActiveAddons } = useAddonStore();
  const { entries: ledgerEntries } = useLedgerStore();
  const activeAddons = getActiveAddons();

  const pastCustomers = Array.from(new Map(
    ledgerEntries.map(e => [e.customerPhone, { name: e.customerName, phone: e.customerPhone }])
  ).values());

  const subtotal = items.reduce((sum, item) => {
    const addonTotal = item.addons?.reduce((a, addon) => a + addon.price, 0) || 0;
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);

  // Floor Surcharge Calculation
  let floorSurcharge = 0;
  let floorSurchargeLabel = '';
  if (selectedTableId) {
    const table = tables.find(t => t.id === selectedTableId);
    if (table) {
      const floor = floors.find(f => f.id === table.floorId);
      if (floor && floor.surchargeValue > 0) {
        floorSurchargeLabel = `${floor.name} (${floor.zone})`;
        if (floor.surchargeType === 'PERCENTAGE') {
          floorSurcharge = (subtotal * floor.surchargeValue) / 100;
        } else {
          floorSurcharge = floor.surchargeValue;
        }
      }
    }
  }

  const totalGst = (subtotal - discount + floorSurcharge) * 0.05;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const grandTotal = Math.max(0, subtotal - discount + floorSurcharge + cgst + sgst);

  // Helper to dynamically check kitchen status — supports DINE_IN, PARCEL, DELIVERY
  const getKitchenStatusBadge = (tableName: string | null, orderType?: string) => {
    let tableToMatch: string;
    if (orderType === 'PARCEL') tableToMatch = '📦 Parcel';
    else if (orderType === 'DELIVERY') tableToMatch = '🛵 Delivery';
    else tableToMatch = tableName || 'Takeaway';

    const tickets = kdsTickets.filter(t => t.tableNumber === tableToMatch);
    if (tickets.length === 0) return null;

    if (tickets.some(t => t.status === 'SERVED')) {
      return (
        <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="h-3 w-3" /> Served
        </span>
      );
    }

    if (tickets.some(t => t.status === 'READY')) {
      return (
        <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm animate-pulse">
          <CheckCircle2 className="h-3 w-3" /> Prepared
        </span>
      );
    }

    return (
      <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-sm">
        <Utensils className="h-3 w-3" /> Preparing
      </span>
    );
  };

  const getItemKdsStatus = (itemName: string, tableName: string | null) => {
    const tableToMatch = tableName || 'Takeaway';
    const tickets = kdsTickets.filter(t => t.tableNumber === tableToMatch);
    const ticketsWithItem = tickets.filter(t => t.items.some(i => i.name === itemName));
    
    if (ticketsWithItem.length === 0) {
      return <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">SENT TO KITCHEN</span>;
    }

    if (ticketsWithItem.some(t => t.status === 'SERVED')) {
      return (
        <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="h-3 w-3" /> Served
        </span>
      );
    }

    if (ticketsWithItem.some(t => t.status === 'READY')) {
      return (
        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="h-3 w-3" /> Prepared
        </span>
      );
    }

    return (
      <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse shadow-sm">
        <Utensils className="h-3 w-3" /> Preparing
      </span>
    );
  };

  const handleCheckout = async (tenders: TenderState) => {
    if (items.length === 0) return;
    
    // We determine primary method by whichever has highest tender
    let primaryMethod = 'CASH';
    let maxAmt = 0;
    Object.entries(tenders).forEach(([m, amt]) => {
      if (amt > maxAmt) { maxAmt = amt; primaryMethod = m; }
    });

    const billData = {
      orderNumber: `KORD-${Math.floor(Math.random() * 10000)}`,
      billNumber: `INV-${Date.now().toString().slice(-6)}`,
      table: selectedTableName || 'Takeaway',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Counter Staff',
      items: [...items],
      subtotal,
      discount,
      cgst,
      sgst,
      grandTotal,
      method: primaryMethod,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };

    if (!isOffline) {
      try {
        await fetch(`${getServerUrl()}/billing/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId: null,
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, notes: i.notes })),
          }),
        });
      } catch (e) {
        console.warn('⚠️ NestJS backend offline. Storing transaction locally via SQLite cache.');
      }
    }

    if (selectedTableId) {
      setTableStatus(selectedTableId, 'AVAILABLE');
    }

    const newItems = items.filter(i => i.status === 'NEW');
    if (newItems.length > 0) {
      useKdsStore.getState().addTicket({
        id: `kot-${Date.now()}`,
        orderNumber: billData.orderNumber,
        tableNumber: orderType === 'DINE_IN'
          ? (selectedTableName || 'Takeaway Counter')
          : (orderType === 'PARCEL' ? '📦 Parcel' : '🛵 Delivery'),
        orderType,
        customerName: customer?.name,
        items: newItems.map(i => {
          const addonText = i.addons && i.addons.length > 0 ? ` [Add: ${i.addons.map(a => a.name).join(', ')}]` : '';
          return { 
            name: i.name, 
            quantity: i.quantity, 
            notes: (i.notes || '') + addonText, 
            status: 'COOKING' 
          };
        }),
        firedAt: new Date().toISOString()
      });
    }
    if (tenders.CREDIT > 0 && customer) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${Date.now()}`,
        customerName: customer.name,
        customerPhone: customer.phone,
        amount: tenders.CREDIT,
        billNumber: billData.billNumber,
        date: new Date().toLocaleDateString()
      });
    }

    // For PARCEL only: push to delivery store (DELIVERY uses handleDispatchDelivery)
    if (orderType === 'PARCEL') {
      useDeliveryStore.getState().addOrder({
        orderType: 'PARCEL',
        customerName: customer?.name || 'Walk-In Guest',
        customerPhone: customer?.phone || '',
        items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        subtotal,
        grandTotal,
        status: 'RECEIVED',
        paymentStatus: 'COLLECTED', // Parcel payment collected upfront at counter
        waiterName: selectedWaiter || undefined,
      });
    }

    // Automatically deplete inventory and packaging
    depleteForOrder(items, orderType);

    setLastBill(billData);
    setSettleState({ isOpen: false, method: 'CASH' });
    setReceiptType('CHECKOUT');
    useKdsStore.getState().clearTableTickets(selectedTableName || 'Takeaway');
    clearCart();

    // ✓ Persist bill to SQLite database via WebSocket for long-term storage
    emitSettleBill({
      billNumber: billData.billNumber,
      orderNumber: billData.orderNumber,
      orderType: orderType,
      subtotal: billData.subtotal,
      cgst: billData.cgst,
      sgst: billData.sgst,
      discount: billData.discount,
      grandTotal: billData.grandTotal,
      method: billData.method,
      waiter: billData.waiter,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      items: billData.items,
    });
  };

  // --- DELIVERY-specific dispatch (supports both COD and Pre-Paid Online) ---
  const handleDispatchDelivery = (isPrepaid: boolean = false) => {
    if (items.length === 0) return;
    const orderNum = `KORD-${Math.floor(Math.random() * 10000)}`;
    const billNum = `DEL-${Date.now().toString().slice(-6)}`;
    const deliveryGrandTotal = grandTotal + (deliveryFee || 0);

    // If pre-paid online when ordering, inject into Master Revenue Ledger right now!
    if (isPrepaid) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${Date.now()}`,
        customerName: customer?.name || 'Customer',
        customerPhone: customer?.phone || '',
        amount: deliveryGrandTotal,
        billNumber: billNum,
        date: new Date().toLocaleDateString()
      });
    }

    // Fire KOT to kitchen
    const newItems = items.filter(i => i.status === 'NEW');
    if (newItems.length > 0) {
      useKdsStore.getState().addTicket({
        id: `kot-${Date.now()}`,
        orderNumber: orderNum,
        tableNumber: '🛵 Delivery',
        orderType: 'DELIVERY',
        customerName: customer?.name,
        items: newItems.map(i => {
          const addonText = i.addons && i.addons.length > 0 ? ` [Add: ${i.addons.map(a => a.name).join(', ')}]` : '';
          return { name: i.name, quantity: i.quantity, notes: (i.notes || '') + addonText, status: 'COOKING' };
        }),
        firedAt: new Date().toISOString()
      });
    }

    // Automatically deplete inventory and packaging
    depleteForOrder(items, 'DELIVERY');

    // Create the delivery order (COD = PENDING, Pre-Paid = COLLECTED with UPI method)
    const dispatchedOrder = useDeliveryStore.getState().addOrder({
      orderType: 'DELIVERY',
      customerName: customer?.name || 'Customer',
      customerPhone: customer?.phone || '',
      deliveryAddress: deliveryAddress || '',
      deliveryFee: deliveryFee || 0,
      items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      subtotal,
      grandTotal: deliveryGrandTotal,
      status: 'RECEIVED',
      paymentStatus: isPrepaid ? 'COLLECTED' : 'PENDING',
      paymentMethod: isPrepaid ? 'UPI' : undefined,
      collectedAmount: isPrepaid ? deliveryGrandTotal : undefined,
      waiterName: selectedWaiter || undefined,
    });

    // Show delivery receipt for printing
    const billData = {
      orderNumber: orderNum,
      billNumber: billNum,
      table: '🛵 Delivery',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Dispatch',
      items: [...items],
      subtotal,
      discount,
      cgst,
      sgst,
      deliveryFee: deliveryFee || 0,
      grandTotal: deliveryGrandTotal,
      method: isPrepaid ? 'PREPAID (ONLINE/UPI)' : 'COD',
      customerName: customer?.name || 'Customer',
      customerPhone: customer?.phone || '',
      deliveryAddress: deliveryAddress || '',
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      isDelivery: true,
    };

    setLastBill(billData);
    setReceiptType('CHECKOUT'); // reuse receipt modal
    clearCart();
  };

  const handlePrintPreBill = () => {
    if (items.length === 0) return;
    const billData = {
      billNumber: `PRE-${Math.floor(100000 + Math.random() * 900000)}`,
      orderNumber: `KORD-${Math.floor(1000 + Math.random() * 9000)}`,
      table: selectedTableName || 'Takeaway',
      cashier: currentUser?.name || 'System',
      waiter: selectedWaiter || 'Counter Staff',
      items: [...items],
      subtotal,
      discount,
      cgst,
      sgst,
      grandTotal,
      method: 'UNPAID',
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    };
    setLastBill(billData);
    setReceiptType('PREBILL');
  };

  const handleAddNoteAndAddons = () => {
    if (!customNoteModal) return;
    addItem(
      { id: customNoteModal.id, name: customNoteModal.name, price: customNoteModal.price }, 
      noteText,
      selectedAddons.length > 0 ? selectedAddons.map(a => ({ id: a.id, name: a.name, price: a.price })) : undefined
    );
    setCustomNoteModal(null);
    setNoteText('');
    setSelectedAddons([]);
  };

  const openCustomizationModal = (product: any) => {
    setCustomNoteModal({ id: product.id, name: product.name, price: product.price });
    setNoteText('');
    setSelectedAddons([]);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] transition-colors duration-300 text-slate-800">
      {/* LEFT AREA: Product Catalog & Carousel / Parked Orders View */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Notch Tabs (Cutout) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center bg-white/70 backdrop-blur-xl p-1 rounded-b-2xl shadow-lg border border-t-0 border-white/80 gap-1">
            
            <button 
              onClick={() => setShowParkedOrders(false)}
              className={`relative px-4 py-1.5 text-xs rounded-full font-bold transition-all z-10 ${!showParkedOrders ? 'text-white' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {!showParkedOrders && (
                <motion.div
                  layoutId="notchTab"
                  className="absolute inset-0 bg-slate-800 rounded-full shadow-md -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              Menu Catalogue
            </button>

            <button 
              onClick={() => setShowParkedOrders(true)}
              className={`relative flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-full font-bold transition-all z-10 ${showParkedOrders ? 'text-white' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {showParkedOrders && (
                <motion.div
                  layoutId="notchTab"
                  className="absolute inset-0 bg-slate-800 rounded-full shadow-md -z-10"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
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

        {/* Global Search Bar (Top Right) */}
        {!showParkedOrders && (
          <div className="absolute top-2 right-4 md:right-5 z-50 w-64 md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white/70 backdrop-blur-xl border border-white/80 rounded-full text-slate-800 placeholder-slate-500 focus:outline-none focus:bg-white focus:border-[#b5ef85] focus:ring-2 focus:ring-[#b5ef85]/40 transition-all text-[13px] font-medium shadow-md"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 active:bg-slate-300 transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        
        {showParkedOrders ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 pt-16">
            {/* Parked Orders Grid */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
              {heldOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-60">
                  <Clock className="w-16 h-16 text-slate-400 mb-4" />
                  <h3 className="text-xl font-bold text-slate-700">No parked orders</h3>
                  <p className="text-slate-500">Orders you hold will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {heldOrders.map((order) => (
                    <div key={order.id} className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-white/60 flex flex-col gap-3 hover:shadow-lg hover:border-white transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <h4 className="font-bold text-slate-800 text-lg leading-tight">{order.name}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-full flex items-center shadow-sm">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {order.orderType && (
                              <span className="text-[10px] text-blue-700 font-black bg-blue-50/80 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                                {order.orderType.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="bg-[#b5ef85] text-slate-900 text-xs font-black px-2.5 py-1 rounded-lg shadow-sm shrink-0">
                          {order.items.length} items
                        </span>
                      </div>
                      
                      {/* Meta info */}
                      {(order.tableName || order.waiterName || order.customerName) && (
                        <div className="flex flex-wrap gap-2 py-2 border-y border-slate-100/80">
                          {order.tableName && (
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-50/80 px-2 py-1 rounded-md border border-slate-100">
                              Table: <span className="text-slate-800">{order.tableName}</span>
                            </span>
                          )}
                          {order.waiterName && (
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-50/80 px-2 py-1 rounded-md border border-slate-100">
                              Waiter: <span className="text-slate-800">{order.waiterName}</span>
                            </span>
                          )}
                          {order.customerName && (
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-50/80 px-2 py-1 rounded-md border border-slate-100">
                              Customer: <span className="text-slate-800">{order.customerName}</span>
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Items List */}
                      <div className="flex flex-col gap-1.5 mt-1 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-start text-[12px] bg-slate-50/80 border border-slate-100/50 p-2 rounded-xl">
                            <span className="text-slate-700 font-bold w-6 shrink-0">{item.quantity}x</span>
                            <span className="text-slate-600 font-semibold flex-1 pr-2 leading-tight">{item.name}</span>
                            <span className="text-slate-500 font-bold ml-1">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => {
                          resumeOrder(order.id);
                          setShowParkedOrders(false);
                        }}
                        className="mt-auto pt-2 w-full bg-[#0d212b] text-[#b5ef85] font-bold py-3 rounded-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md group-hover:shadow-lg"
                      >
                        <Utensils className="w-4 h-4" />
                        Resume Order
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 pt-16">
            <CategorySidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
            
            <div className="flex-1 flex flex-col p-4 md:p-5 overflow-hidden">
              <MenuGrid activeCategory={activeCategory} onCustomize={openCustomizationModal} searchQuery={searchQuery} />
            </div>
          </div>
        )}
      </div>

      {/* RIGHT AREA: Folio Sidebar */}
      <FolioSidebar 
        isMobileCartOpen={isMobileCartOpen} 
        setIsMobileCartOpen={setIsMobileCartOpen}
        onSettle={(method) => setSettleState({ isOpen: true, method })}
        onShowCustomerModal={setShowCustomerModal}
        onShowMapPicker={setShowMapPicker}
        onReturnFolio={() => {
          setReturnModalData({
            billNumber: lastBill?.billNumber || `FOLIO-${Date.now().toString().slice(-4)}`,
            orderType: orderType,
            customerName: customer?.name || 'Walk-in Guest',
            customerPhone: customer?.phone,
            items: items.length > 0 ? items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price })) : (lastBill?.items || []),
            grandTotal: grandTotal || lastBill?.grandTotal || 0,
            paymentMethod: 'CASH'
          });
        }}
        onPreBill={handlePrintPreBill}
        onManagerAuthRequest={setManagerAuthAction}
      />
      <SettlementModal 
        isOpen={settleState.isOpen}
        onClose={() => setSettleState({ ...settleState, isOpen: false })}
        onConfirm={handleCheckout}
        totalAmount={grandTotal}
        initialMethod={settleState.method}
        hasCustomer={!!customer}
        onRequestCustomer={() => {
          setSettleState({ ...settleState, isOpen: false });
          setShowCustomerModal(true);
        }}
      />

      {/* THERMAL RECEIPT & WHATSAPP MODAL */}
      {receiptType && lastBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-pos-card w-full max-w-sm rounded-2xl border border-pos-border p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${receiptType === 'CHECKOUT' ? 'bg-pos-accent/10 text-emerald-500 border-pos-accent/30' : 'bg-pos-bg text-pos-text-muted border-pos-border'}`}>
              {receiptType === 'CHECKOUT' ? <CheckCircle2 className="h-7 w-7 shrink-0" /> : <Printer className="h-6 w-6 shrink-0" />}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-pos-text">
                {receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : 'Pre-Bill Preview'}
              </h3>
              <p className="text-xs font-bold text-pos-text-muted">Invoice: {lastBill.billNumber} • {lastBill.time}</p>
            </div>

            {/* Simulated ESC/POS Thermal Paper Preview */}
            <div className="w-full bg-pos-accent/5 text-pos-text font-mono text-left p-4 rounded-lg shadow-inner text-xs space-y-2 border-t-4 border-dashed border-pos-border">
              <div className="text-center border-b border-pos-border pb-2">
                <p className="font-extrabold text-sm uppercase">★ KARVAAN BISTRO & CAFE ★</p>
                <p className="text-[10px] font-bold text-pos-text-muted">GSTIN: 27AADCK1234F1Z9</p>
                <p className="text-[10px] font-bold text-pos-text-muted">Table: {lastBill.table} | Method: {lastBill.method}</p>
                <p className="text-[10px] font-bold text-pos-text-muted mt-1">Cashier: {lastBill.cashier} | Server: {lastBill.waiter}</p>
              </div>

              <div className="space-y-1 py-1 border-b border-pos-border">
                {lastBill.items.map((i: any, idx: number) => {
                  const addonPrice = i.addons?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
                  const lineTotal = (i.price + addonPrice) * i.quantity;
                  return (
                    <div key={idx} className="flex flex-col">
                      <div className="flex justify-between font-bold">
                        <span>{i.name} x{i.quantity}</span>
                        <span>₹{lineTotal.toFixed(2)}</span>
                      </div>
                      {i.addons && i.addons.map((addon: any, aIdx: number) => (
                        <div key={aIdx} className="flex justify-between text-[10px] text-emerald-500 pl-2">
                          <span>+ {addon.name}</span>
                          <span>(₹{addon.price * i.quantity})</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-0.5 pt-1 font-bold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{lastBill.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-pos-text-muted">
                  <span>CGST + SGST (5%):</span>
                  <span>₹{(lastBill.cgst + lastBill.sgst).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-pos-border pt-1 mt-1">
                  <span>GRAND TOTAL:</span>
                  <span>₹{lastBill.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] font-bold text-pos-text-muted border-t border-pos-border">
                <p>Thank you for dining with Karvaan!</p>
                <p>Scan QR on table for digital loyalty points.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  alert('🖨️ ESC/POS Thermal Print command dispatched to USB/Serial port!');
                  if (receiptType === 'PREBILL') setReceiptType(null);
                }}
                className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span>Confirm & Print</span>
              </button>
              <button
                onClick={() => {
                  window.open(`https://wa.me/?text=Here is your Karvaan POS receipt #${lastBill.billNumber} for ₹${lastBill.grandTotal}. Thank you for visiting!`, '_blank');
                }}
                className="flex items-center justify-center gap-2 py-2.5 bg-pos-card hover:bg-pos-bg text-pos-text font-bold text-xs rounded-xl border border-pos-border transition-colors shadow-sm cursor-pointer"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                <span>WhatsApp</span>
              </button>
            </div>

            {currentUser?.role !== 'WAITER' && (
              <button
                onClick={() => {
                  setReturnModalData({
                    billNumber: lastBill.billNumber,
                    orderType: orderType,
                    customerName: lastBill.customer || 'Walk-in Guest',
                    items: lastBill.items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                    grandTotal: lastBill.grandTotal,
                    paymentMethod: lastBill.method
                  });
                  setReceiptType(null);
                }}
                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-extrabold text-xs rounded-xl transition-colors border border-amber-500/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Process Return / Refund</span>
              </button>
            )}

            <button
              onClick={() => setReceiptType(null)}
              className="w-full py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text-muted hover:text-pos-text text-xs font-extrabold rounded-xl transition-colors border border-pos-border cursor-pointer flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              {receiptType === 'CHECKOUT' ? 'Start New Order' : 'Close Preview'}
            </button>
          </div>
        </div>
      )}

      {/* ITEM CUSTOMIZATION MODAL */}
      {customNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-card w-full max-w-md rounded-2xl border border-pos-border p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-pos-text">Customize: {customNoteModal.name}</h3>
            
            {/* Notes Section */}
            <div>
              <label className="text-xs font-bold text-pos-text-muted mb-1 block">Custom Note</label>
              <input
                type="text"
                placeholder="e.g. Less spicy, Extra cheese, No onions..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2.5 bg-pos-bg border border-pos-border rounded-xl text-pos-text placeholder-pos-text-muted text-sm focus:outline-none focus:border-pos-accent focus:ring-1 focus:ring-pos-accent font-bold shadow-inner transition-shadow"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {predefinedNotes.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setNoteText(prev => prev ? `${prev}, ${preset.label}` : preset.label)}
                    className="px-2.5 py-1 bg-pos-bg hover:bg-pos-accent/10 text-[10px] font-black text-pos-text-muted hover:text-emerald-500 border border-pos-border rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    <span>{preset.icon}</span> <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Paid Add-ons Section */}
            {activeAddons.length > 0 && (
              <div className="pt-3 border-t border-pos-border/50">
                <label className="text-xs font-bold text-pos-text-muted mb-2 block">Paid Add-ons</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {activeAddons.map(addon => {
                    const isSelected = selectedAddons.some(a => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAddons(prev => prev.filter(a => a.id !== addon.id));
                          } else {
                            setSelectedAddons(prev => [...prev, addon]);
                          }
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-pos-accent/10 border-pos-accent/50 text-emerald-500' 
                            : 'bg-pos-bg border-pos-border text-pos-text hover:border-pos-accent/50'
                        }`}
                      >
                        <span className="text-xs font-bold truncate pr-2">{addon.name}</span>
                        <span className="text-xs font-black shrink-0">+₹{addon.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-pos-border/50 mt-4">
              <button
                onClick={() => {
                  setCustomNoteModal(null);
                  setSelectedAddons([]);
                }}
                className="px-4 py-2 bg-pos-bg text-pos-text-muted hover:text-pos-text hover:bg-pos-card rounded-xl text-sm font-bold border border-pos-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNoteAndAddons}
                className="px-4 py-2 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold rounded-xl text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-transform active:scale-95 cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: CustomerSelectModal */}
      {showCustomerModal && (
        <CustomerSelectModal
          currentCustomer={customer}
          onSelect={(c) => setCustomer(c)}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* NEW: Map Picker Modal */}
      {showMapPicker && (
        <MapPickerModal
          initialAddress={deliveryAddress}
          onConfirm={(address) => setDeliveryAddress(address)}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* RETURN & REFUND STUDIO MODAL */}
      <ReturnOrderModal
        isOpen={!!returnModalData}
        onClose={() => setReturnModalData(null)}
        orderData={returnModalData}
        onConfirmReturn={(returnedItems, action, reason, refundDest, isFullOrder) => {
          if (isFullOrder && items.length > 0) {
            clearCart();
          }
        }}
      />

      {/* MANAGER AUTHORIZATION MODAL */}
      <ManagerAuthModal
        isOpen={!!managerAuthAction?.isOpen}
        onClose={() => setManagerAuthAction(null)}
        actionTitle={managerAuthAction?.title || 'Manager Authorization Required'}
        actionDescription={managerAuthAction?.desc}
        onSuccess={(authBy) => {
          if (managerAuthAction?.onConfirm) {
            managerAuthAction.onConfirm(authBy);
          }
        }}
      />

    </div>
  );
};

export default POSScreen;
