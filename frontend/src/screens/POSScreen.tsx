import React, { useState } from 'react';
import { 
  Search, Barcode, Plus, Minus, Trash2, Pause, Play, 
  CreditCard, Banknote, QrCode, Split, Share2, Printer, 
  CheckCircle2, AlertCircle, Sparkles, Utensils, X, Zap,
  Clock, Edit3, User, Flame, MessageSquare, Smartphone, UtensilsCrossed, ChevronUp, ChevronDown,
  MapPin, Bike, Package, Check, RotateCcw
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
import { useInventoryStore } from '../store/useInventoryStore';
import { ReturnOrderModal, ReturnOrderData } from '../components/ReturnOrderModal';
import { ManagerAuthModal } from '../components/ManagerAuthModal';
import { emitSettleBill } from '../services/socket';

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
  
  const { setTableStatus } = useTableStore();
  const { getActiveWaiters } = useStaffStore();
  const { checkIs86d, depleteForOrder } = useInventoryStore();
  const { notes: predefinedNotes, discounts: predefinedDiscounts } = useSettingsStore();
  
  const activeWaiters = getActiveWaiters();

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });

  const [receiptType, setReceiptType] = useState<'CHECKOUT' | 'PREBILL' | null>(null);
  const [lastBill, setLastBill] = useState<any>(null);
  const [customNoteModal, setCustomNoteModal] = useState<{ id: string; name: string; price: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<PaidAddon[]>([]);
  const [showQuickAddons, setShowQuickAddons] = useState(false);
  const [activeFolioTab, setActiveFolioTab] = useState<'CURRENT' | 'PARKED'>('CURRENT');
  const [returnModalData, setReturnModalData] = useState<ReturnOrderData | null>(null);
  const [managerAuthAction, setManagerAuthAction] = useState<{ isOpen: boolean; title: string; desc: string; onConfirm: (authBy: string) => void } | null>(null);
  
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

  const filteredProducts = products.filter((p) => {
    if (!p.isAvailable) return false; // Hide 86'd items on POS
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const subtotal = items.reduce((sum, item) => {
    const addonTotal = item.addons?.reduce((a, addon) => a + addon.price, 0) || 0;
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);
  const totalGst = (subtotal - discount) * 0.05;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const grandTotal = Math.max(0, subtotal - discount + cgst + sgst);

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
        await fetch('http://localhost:3001/billing/order', {
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
    <div className="grid grid-cols-12 h-[calc(100vh-64px)] overflow-hidden gap-4 p-4 bg-pos-bg text-pos-text transition-colors duration-250">
      {/* LEFT AREA: Product Catalog (8 Cols) */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-4 overflow-hidden">
        {/* Top Search & Barcode Bar */}
        <div className="flex items-center gap-3 bg-pos-sidebar p-3 rounded-2xl border border-pos-border shadow-glass transition-colors duration-250">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 h-5 w-5 text-pos-text-muted" />
            <input
              type="text"
              placeholder="Search dishes, drinks, or SKU barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text placeholder-pos-text-muted focus:outline-none focus:border-pos-accent transition-all text-sm font-bold shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-lg text-pos-text-muted hover:text-pos-text hover:bg-pos-card transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button 
            onClick={() => setSearchQuery('Coffee')}
            className="flex items-center gap-2 px-4 py-2.5 bg-pos-card hover:bg-pos-card-hover text-pos-text rounded-xl border border-pos-border font-extrabold transition-all shadow-sm shrink-0 text-sm active:scale-95 cursor-pointer"
          >
            <Barcode className="h-5 w-5 text-pos-accent shrink-0" />
            <span className="hidden sm:inline">Scan SKU</span>
          </button>
        </div>

        {/* Category Tabs */}
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-4 py-2 rounded-xl text-sm font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-sm flex items-center gap-1.5 ${
                activeCategory === cat.name
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                  : 'bg-pos-sidebar hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-pos-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 border border-pos-border hover:border-emerald-400'
              }`}
            >
              {cat.emoji && <span className="text-base leading-none">{cat.emoji}</span>}
              {cat.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 pb-4 p-1">
          {filteredProducts.map((product) => {
            const is86d = checkIs86d(product.name);
            return (
            <div
              key={product.id}
              onClick={() => !is86d && addItem(product)}
              className={`group relative bg-pos-card p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[145px] shadow-sm overflow-hidden ${
                is86d ? 'opacity-50 grayscale border-red-500/40 cursor-not-allowed' : 'border-pos-border cursor-pointer hover:shadow-glow-accent hover:-translate-y-1.5'
              }`}
            >
              {/* Vibrant Accent Strip on Hover */}
              {!is86d && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>}

              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2.5 mt-1">
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-pos-bg text-pos-text-muted border border-pos-border group-hover:border-emerald-500/30 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors tracking-wide">
                    {product.category}
                  </span>
                  {is86d ? (
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-black bg-red-100 dark:bg-red-950/80 px-2 py-0.5 rounded-md border border-red-300 dark:border-red-500/50 uppercase">
                      86'D SOLD OUT
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-200 font-extrabold flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/40 shadow-2xs">
                      <Clock className="h-3 w-3" />
                      <span>{product.prepTime}m</span>
                    </span>
                  )}
                </div>
                <h3 className="font-black text-pos-text line-clamp-2 leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors text-[15px]">
                  {product.name}
                </h3>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-pos-text-muted block mb-0.5">Price</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">
                    ₹{product.price}
                  </span>
                </div>
                
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCustomizationModal(product);
                    }}
                    className="w-8 h-8 bg-white/90 dark:bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-pos-text hover:text-emerald-500 shadow-sm transition-colors"
                    title="Add Notes & Add-ons"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* 🚀 QUICK STANDALONE ADD-ONS (Redesigned) */}
        {activeAddons.length > 0 && (
          <div className="mt-auto shrink-0 bg-pos-sidebar border border-pos-border rounded-xl mx-2 mb-2 shadow-sm flex flex-col gap-0 overflow-hidden transition-all duration-300">
            <div 
              onClick={() => setShowQuickAddons(!showQuickAddons)}
              className="flex items-center justify-between cursor-pointer px-3 py-2.5 bg-pos-card hover:bg-pos-bg transition-colors select-none group"
            >
              <div className="flex items-center gap-2 shrink-0">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="font-black text-xs uppercase tracking-wider text-pos-text-muted group-hover:text-pos-text transition-colors">Quick Add-ons</span>
              </div>
              
              <div className="flex items-center gap-3 overflow-hidden">
                {!showQuickAddons && (
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 mask-image-linear-right opacity-80 group-hover:opacity-100 transition-opacity">
                    {activeAddons.map(addon => (
                      <span key={`preview-${addon.id}`} className="text-[10px] font-bold whitespace-nowrap text-pos-text bg-pos-bg border border-pos-border px-2 py-0.5 rounded-md shadow-2xs">
                        {addon.name} <span className="text-emerald-600 dark:text-emerald-400 font-black">+₹{addon.price}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="bg-pos-bg border border-pos-border p-1 rounded-lg shrink-0 shadow-sm text-pos-text-muted group-hover:text-pos-text group-hover:border-pos-accent/30 transition-all">
                  {showQuickAddons ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </div>

            {showQuickAddons && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2 p-3 bg-pos-sidebar border-t border-pos-border/50">
                {activeAddons.map(addon => (
                  <button
                    key={`global-${addon.id}`}
                    onClick={() => addItem({ id: `standalone-addon-${addon.id}`, name: `${addon.name} (Add-on)`, price: addon.price, category: 'Add-on' })}
                    className="flex flex-col items-center justify-center p-2 bg-pos-bg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-pos-border hover:border-emerald-400 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 group"
                  >
                    <span className="text-[11px] font-bold text-pos-text text-center leading-tight truncate w-full group-hover:text-emerald-700">{addon.name}</span>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                      +₹{addon.price}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT AREA: Billing Cart & Checkout */}
      <div className="col-span-12 lg:col-span-4 bg-pos-sidebar rounded-2xl border border-pos-border shadow-glass flex flex-col justify-between overflow-hidden transition-colors duration-250">

        {/* Folio Tabs Header */}
        <div className="flex border-b border-pos-border bg-pos-card z-10">
          <button
            onClick={() => setActiveFolioTab('CURRENT')}
            className={`flex-1 py-3 text-sm font-black transition-colors border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeFolioTab === 'CURRENT'
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40'
                : 'border-transparent text-pos-text-muted hover:text-pos-text hover:bg-pos-bg'
            }`}
          >
            <Utensils className="h-4 w-4" /> Current Folio
          </button>
          <button
            onClick={() => setActiveFolioTab('PARKED')}
            className={`flex-1 py-3 text-sm font-black transition-colors border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeFolioTab === 'PARKED'
                ? 'border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/40'
                : 'border-transparent text-pos-text-muted hover:text-pos-text hover:bg-pos-bg'
            }`}
          >
            <Clock className="h-4 w-4" /> Parked ({heldOrders.length})
          </button>
        </div>

        {activeFolioTab === 'CURRENT' ? (
          <>
            {/* CURRENT FOLIO HEADER TOOLS */}
            <div className="p-3 border-b border-pos-border bg-pos-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedTableName ? (
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-500/30 shadow-sm">
                    {selectedTableName}
                  </span>
                ) : (
                  <span className="text-xs font-black text-pos-text-muted px-2 py-1 bg-pos-bg rounded-md border border-pos-border shadow-sm">Walk-in</span>
                )}
                
                {selectedWaiter && (
                  <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm shrink-0">
                    <User className="h-3 w-3" /> {selectedWaiter}
                  </span>
                )}
                
                {items.some(i => i.status === 'SENT') && getKitchenStatusBadge(selectedTableName)}
              </div>
              <div className="flex items-center gap-2">
                {currentUser?.role !== 'WAITER' && (
                  <button
                    onClick={() => setReturnModalData({
                      billNumber: lastBill?.billNumber || `FOLIO-${Date.now().toString().slice(-4)}`,
                      orderType: orderType,
                      customerName: customer?.name || 'Walk-in Guest',
                      customerPhone: customer?.phone,
                      items: items.length > 0 ? items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })) : (lastBill?.items || []),
                      grandTotal: grandTotal || lastBill?.grandTotal || 0,
                      paymentMethod: 'CASH'
                    })}
                    disabled={items.length === 0 && !lastBill}
                    className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 text-amber-600 dark:text-amber-400 text-xs font-black rounded-lg border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Return / Refund Item"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Return
                  </button>
                )}
                <button onClick={() => { if (items.length) holdCurrentOrder(); }} disabled={items.length === 0} className="p-1.5 bg-pos-bg hover:bg-amber-50 text-pos-text hover:text-amber-600 rounded-lg border border-pos-border disabled:opacity-40 transition-colors cursor-pointer shadow-sm" title="Park/Hold Folio">
                  <Pause className="h-4 w-4" />
                </button>
                {!items.some(i => i.status === 'SENT') ? (
                  <button onClick={() => { if(window.confirm('Delete this entire folio? This cannot be undone.')) clearCart(); }} disabled={items.length === 0} className="p-1.5 bg-pos-bg hover:bg-rose-50 text-pos-text hover:text-rose-600 rounded-lg border border-pos-border disabled:opacity-40 transition-colors cursor-pointer shadow-sm" title="Delete Folio (Clear)">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.permissions?.canVoid) {
                        if (window.confirm('Void this entire sent folio? Cooking items will be cancelled.')) {
                          clearCart();
                        }
                      } else {
                        setManagerAuthAction({
                          isOpen: true,
                          title: 'Void Sent Folio',
                          desc: 'This folio has cooking items sent to KDS. Manager PIN required to void.',
                          onConfirm: () => clearCart()
                        });
                      }
                    }}
                    className="p-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/30 transition-colors cursor-pointer shadow-sm"
                    title="Void Sent Folio (Requires Manager PIN)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Order Type Selector */}
            <div className="px-3 py-2 border-b border-pos-border bg-pos-bg flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-pos-text-muted shrink-0 mr-1">Type:</span>
              <div className="flex gap-1.5">
                <button onClick={() => setOrderType('DINE_IN')} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer border transition-colors ${orderType === 'DINE_IN' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-pos-card text-pos-text-muted border-pos-border hover:text-pos-text'}`}><Utensils className="h-3 w-3" /> Dine-In</button>
                <button onClick={() => { setOrderType('PARCEL'); setTable(null, null); }} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer border transition-colors ${orderType === 'PARCEL' ? 'bg-amber-500 text-white border-amber-600' : 'bg-pos-card text-pos-text-muted border-pos-border hover:text-pos-text'}`}><Package className="h-3 w-3" /> Parcel</button>
                <button onClick={() => { setOrderType('DELIVERY'); setTable(null, null); }} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer border transition-colors ${orderType === 'DELIVERY' ? 'bg-purple-500 text-white border-purple-600' : 'bg-pos-card text-pos-text-muted border-pos-border hover:text-pos-text'}`}><Bike className="h-3 w-3" /> Delivery</button>
              </div>
            </div>

            {/* Delivery Fields — compact two-button row */}
            {orderType === 'DELIVERY' && (
              <div className="px-3 py-2 border-b border-pos-border bg-purple-50 dark:bg-purple-950/20 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <button
                  onClick={() => setShowMapPicker(true)}
                  className="flex-1 text-left text-xs font-bold truncate text-purple-700 dark:text-purple-300 hover:text-purple-900 cursor-pointer"
                >
                  {deliveryAddress || <span className="text-purple-300 dark:text-purple-600">Enter delivery address...</span>}
                </button>
                <button
                  onClick={() => setShowMapPicker(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black rounded-lg cursor-pointer transition-colors shrink-0"
                >
                  🗺 Map
                </button>
                <div className="relative shrink-0">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-purple-400">₹</span>
                  <input type="number" value={deliveryFee || ''} onChange={e => setDeliveryFee(Number(e.target.value))} placeholder="Fee" className="w-16 pl-4 pr-1 py-1 bg-white dark:bg-pos-card border border-purple-200 dark:border-purple-800 rounded-lg text-[11px] font-bold focus:outline-none focus:border-purple-400 placeholder:text-purple-300" />
                </div>
              </div>
            )}

            {/* Server Select */}
            <div className="px-3 py-2 border-b border-pos-border bg-pos-bg flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-pos-text-muted shrink-0 mr-2">Server:</span>
              <div className="flex gap-2 overflow-x-auto scrollbar-none w-full">
                {activeWaiters.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setWaiter(selectedWaiter === w.name ? null : w.name)}
                    className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors whitespace-nowrap shadow-sm ${selectedWaiter === w.name ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-pos-card text-pos-text-muted hover:text-pos-text border border-pos-border'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>

            {/* UX Optimized List Items */}
            <div className="flex-1 overflow-y-auto bg-pos-bg">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-pos-text-muted">
                  <div className="w-16 h-16 rounded-3xl bg-pos-card border border-pos-border flex items-center justify-center mb-4 shadow-sm">
                    <Sparkles className="h-8 w-8 text-pos-accent stroke-1 shrink-0" />
                  </div>
                  <p className="font-extrabold text-pos-text text-base">Folio is empty</p>
                  <p className="text-xs mt-1 max-w-[200px] leading-relaxed">Tap dishes to add to order.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {items.map((item, idx) => (
                    <div key={`${item.productId}-${idx}`} className={`p-2 transition-colors border-b border-dotted border-pos-border/70 ${item.status === 'SENT' ? 'opacity-70 bg-pos-bg/80' : 'hover:bg-pos-card'}`}>
                      
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-pos-text leading-tight">{item.name}</span>
                            {item.status === 'NEW' && (
                              <button
                                onClick={() => {
                                  const note = window.prompt(`Enter note for ${item.name}`, item.notes || '');
                                  if (note !== null) {
                                    updateItemNoteByIndex(idx, note);
                                  }
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer shadow-sm ml-1 shrink-0"
                                title="Add Note"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span className="text-[9px] font-black uppercase">Note</span>
                              </button>
                            )}
                          </div>

                          {/* Notes & Addons compactly inline */}
                          {(item.notes || (item.addons && item.addons.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
                              {item.notes && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded truncate max-w-[150px]">Note: {item.notes}</span>}
                              {item.addons?.map((addon, aIdx) => (
                                <span key={aIdx} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded truncate">+{addon.name}</span>
                              ))}
                            </div>
                          )}
                          
                          <div className="mt-1">
                            <span className="font-black text-xs text-pos-text block leading-none">
                              ₹{((item.price + (item.addons?.reduce((sum, a) => sum + a.price, 0) || 0)) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Right: Controls (Right-most corner) */}
                        {item.status === 'NEW' ? (
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center bg-pos-card rounded-lg border border-pos-border shadow-sm h-9">
                              <button onClick={() => updateQuantityByIndex(idx, -1)} className="px-4 hover:bg-rose-50 hover:text-rose-600 h-full rounded-l-lg transition-colors cursor-pointer"><Minus className="h-5 w-5" /></button>
                              <span className="w-8 text-center text-sm font-black">{item.quantity}</span>
                              <button onClick={() => updateQuantityByIndex(idx, 1)} className="px-4 hover:bg-emerald-50 hover:text-emerald-600 h-full rounded-r-lg transition-colors cursor-pointer"><Plus className="h-5 w-5" /></button>
                            </div>
                            <button onClick={() => removeItemByIndex(idx)} className="text-[9px] font-bold text-pos-text-muted hover:text-rose-500 uppercase tracking-widest px-2 py-0.5 rounded cursor-pointer transition-colors">
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end justify-center shrink-0 gap-1">
                            {getItemKdsStatus(item.name, selectedTableName)}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-black">Qty: {item.quantity}</span>
                              <button
                                onClick={() => {
                                  if (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.permissions?.canVoid) {
                                    if (window.confirm(`Void sent item "${item.name}"?`)) {
                                      removeItemByIndex(idx);
                                    }
                                  } else {
                                    setManagerAuthAction({
                                      isOpen: true,
                                      title: `Void Sent Item: ${item.name}`,
                                      desc: `Item "${item.name}" is already cooking/sent to KDS. Manager PIN required to void.`,
                                      onConfirm: () => {
                                        removeItemByIndex(idx);
                                      }
                                    });
                                  }
                                }}
                                className="text-[9px] font-black text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider cursor-pointer border border-rose-500/20"
                                title="Void Sent Item (Requires Manager PIN)"
                              >
                                Void
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Architect Footer */}
            <div className="border-t-2 border-pos-border bg-pos-card flex flex-col shrink-0">
              
              {/* Guest and Fast Cash */}
              <div className="flex items-center justify-between p-2.5 border-b border-pos-border/60 gap-2">
                <button
                  onClick={() => { setCustomerForm(customer || { name: '', phone: '' }); setShowCustomerModal(true); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer shadow-sm active:scale-95 text-xs ${
                    customer
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-pos-bg hover:bg-pos-card border-pos-border text-pos-text-muted hover:text-pos-text'
                  }`}
                >
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-black truncate max-w-[120px]">
                    {customer ? customer.name : 'Add Guest'}
                  </span>
                  {customer && <span className="text-[10px] opacity-60 ml-1">✕</span>}
                </button>
                {customer?.phone && (
                  <span className="text-[10px] font-bold text-pos-text-muted">{customer.phone}</span>
                )}
              </div>

              {/* Ledger Calculation Row */}
              <div className="p-4 space-y-2 bg-pos-bg/50">
                <div className="flex justify-between items-center text-sm font-bold text-pos-text-muted">
                  <span>Subtotal</span>
                  <span className="font-black">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-pos-text-muted">
                  <span>Taxes (5%)</span>
                  <span>₹{(cgst + sgst).toFixed(2)}</span>
                </div>
                
                {/* Quick Discounts Row */}
                {currentUser?.role !== 'WAITER' && predefinedDiscounts.length > 0 && (
                  <div className="flex gap-2 pt-2 border-t border-pos-border/50">
                    <button onClick={() => setDiscount(0)} className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-colors cursor-pointer shadow-sm ${discount === 0 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-pos-card text-pos-text-muted border-pos-border hover:bg-pos-bg'}`}>No Disc</button>
                    {predefinedDiscounts.map(d => {
                      const calcAmt = d.type === 'PERCENTAGE' ? (subtotal * d.amount) / 100 : d.amount;
                      const isDisabled = (currentUser?.role === 'CASHIER' && calcAmt > 50);
                      return (
                        <button key={d.id} onClick={() => setDiscount(calcAmt)} disabled={isDisabled} className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-colors cursor-pointer shadow-sm ${isDisabled ? 'opacity-40' : ''} ${discount === calcAmt ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-pos-card text-pos-text-muted border-pos-border hover:bg-pos-bg'}`}>{d.label}</button>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex justify-between items-end pt-2">
                  <span className="text-sm font-black text-pos-text">Total Payable</span>
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none drop-shadow-sm">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Row - context-aware for DELIVERY vs normal */}
              {deliveryStatus === 'COLLECTED' ? (
                <div className="p-3 pt-1 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      const orderNum = `KORD-${Math.floor(Math.random() * 10000)}`;
                      const billNum = `DEL-${Date.now().toString().slice(-6)}`;
                      const deliveryGrandTotal = grandTotal + (deliveryFee || 0);
                      const billData = {
                        orderNumber: orderNum,
                        billNumber: billNum,
                        table: '🛵 Delivery Completed',
                        cashier: currentUser?.name || 'System',
                        waiter: selectedWaiter || 'Delivery Rider',
                        items: [...items],
                        subtotal,
                        discount,
                        cgst,
                        sgst,
                        deliveryFee: deliveryFee || 0,
                        grandTotal: deliveryGrandTotal,
                        method: `DELIVERED & PAID (${collectedMethod || 'CASH'})`,
                        customerName: customer?.name || 'Customer',
                        customerPhone: customer?.phone || '',
                        deliveryAddress: deliveryAddress || '',
                        time: new Date().toLocaleTimeString(),
                        date: new Date().toLocaleDateString(),
                        isDelivery: true,
                      };
                      setLastBill(billData);
                      setReceiptType('CHECKOUT');
                      clearCart();
                    }}
                    className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                  >
                    <Check className="h-5 w-5 animate-bounce" /> Complete Delivery & Print Bill ({collectedMethod || 'PAID'})
                  </button>
                  <p className="text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-bold">✓ Payment collected by delivery rider. Click to finalize & print receipt.</p>
                </div>
              ) : (
                <>
                  {orderType === 'DELIVERY' ? (
                    // DELIVERY: two dispatch options (COD vs Pre-Paid Online)
                    <div className="p-3 pt-1 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleDispatchDelivery(false)}
                          disabled={items.length === 0 || !deliveryAddress}
                          className="flex flex-col items-center justify-center gap-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 text-xs uppercase tracking-wide"
                        >
                          <div className="flex items-center gap-1.5 text-sm">
                            <Bike className="h-4 w-4" />
                            <span>Dispatch COD</span>
                          </div>
                          <span className="text-[9px] opacity-80 font-bold">Pay at Doorstep</span>
                        </button>

                        <button
                          onClick={() => handleDispatchDelivery(true)}
                          disabled={items.length === 0 || !deliveryAddress}
                          className="flex flex-col items-center justify-center gap-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 text-xs uppercase tracking-wide"
                        >
                          <div className="flex items-center gap-1.5 text-sm">
                            <QrCode className="h-4 w-4" />
                            <span>Pre-Paid (UPI)</span>
                          </div>
                          <span className="text-[9px] opacity-80 font-bold">Already Paid Online</span>
                        </button>
                      </div>
                      {!deliveryAddress && items.length > 0 && (
                        <p className="text-[10px] text-center text-red-400 font-bold">⚠ Enter delivery address to dispatch</p>
                      )}
                      <p className="text-[10px] text-center text-pos-text-muted font-bold">Select Pre-Paid if customer paid via phone/WhatsApp before dispatch</p>
                    </div>
                  ) : (
                    // DINE_IN / PARCEL: normal payment buttons or Server Mode banner
                    currentUser?.role === 'WAITER' ? (
                      <div className="p-3 pt-1 flex flex-col gap-2">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
                          <User className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-amber-600 dark:text-amber-400">Server Mode Active</p>
                            <p className="text-[10px] text-pos-text-muted mt-0.5 leading-relaxed">
                              You can send KOT orders and park table folios. Billing and payment settlement is restricted to front desk cashiers.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 pt-1 grid grid-cols-2 gap-3">
                        <button onClick={() => setSettleState({ isOpen: true, method: 'CASH' })} disabled={items.length === 0} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                          <Banknote className="h-5 w-5" />
                          <span className="text-sm uppercase tracking-wider">Cash</span>
                        </button>
                        <button onClick={() => setSettleState({ isOpen: true, method: 'UPI' })} disabled={items.length === 0} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                          <QrCode className="h-5 w-5" />
                          <span className="text-sm uppercase tracking-wider">UPI</span>
                        </button>
                        <button onClick={() => setSettleState({ isOpen: true, method: 'CARD' })} disabled={items.length === 0} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                          <CreditCard className="h-5 w-5" />
                          <span className="text-sm uppercase tracking-wider">Card</span>
                        </button>
                        <button onClick={() => setSettleState({ isOpen: true, method: 'CREDIT' })} disabled={items.length === 0} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black rounded-xl transition-all cursor-pointer shadow-sm active:scale-95">
                          <Smartphone className="h-5 w-5" />
                          <span className="text-sm uppercase tracking-wider">Credit</span>
                        </button>
                      </div>
                    )
                  )}
                  
                  <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                    <button onClick={sendKot} disabled={!items.some(i => i.status === 'NEW')} className={`py-3 bg-pos-card hover:bg-emerald-50 text-emerald-600 font-black text-xs rounded-xl border border-emerald-500/50 hover:border-emerald-500 transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 uppercase tracking-wide ${currentUser?.role === 'WAITER' ? 'col-span-2 py-4 text-sm bg-emerald-600 hover:bg-emerald-500 text-white border-none' : ''}`}>
                      <UtensilsCrossed className="h-4 w-4" /> Send KOT to Kitchen
                    </button>
                    {currentUser?.role !== 'WAITER' && (
                      <button onClick={handlePrintPreBill} disabled={items.length === 0} className="py-3 bg-pos-card hover:bg-pos-sidebar text-pos-text font-black text-xs rounded-xl border border-pos-border hover:border-pos-accent transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 uppercase tracking-wide">
                        <Printer className="h-4 w-4" /> Pre-Bill
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* PARKED ORDERS TAB CONTENT */
          <div className="flex-1 overflow-y-auto bg-pos-bg p-4 flex flex-col gap-3">
            {heldOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-pos-text-muted">
                <div className="w-16 h-16 rounded-3xl bg-pos-card border border-pos-border flex items-center justify-center mb-4 shadow-sm">
                  <Clock className="h-8 w-8 text-amber-500/50 stroke-1 shrink-0" />
                </div>
                <p className="font-extrabold text-pos-text text-base">No Parked Orders</p>
                <p className="text-xs mt-1 max-w-[200px] leading-relaxed">Active orders you hold will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {heldOrders.map(order => (
                    <div
                      key={order.id} 
                      onClick={() => { resumeOrder(order.id); setActiveFolioTab('CURRENT'); }}
                      className={`rounded-xl border p-3 shadow-sm flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98] group ${
                        order.orderType === 'PARCEL'
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:border-amber-400'
                          : order.orderType === 'DELIVERY'
                          ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 hover:border-purple-400'
                          : 'bg-pos-card hover:bg-pos-bg border-pos-border hover:border-amber-400/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            {order.orderType === 'PARCEL' && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                                <Package className="h-2.5 w-2.5" /> Parcel
                              </span>
                            )}
                            {order.orderType === 'DELIVERY' && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-purple-700 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded">
                                <Bike className="h-2.5 w-2.5" /> Delivery
                              </span>
                            )}
                            {order.deliveryStatus === 'COLLECTED' && (
                              <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-400 px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                                <Check className="h-3 w-3 text-emerald-600" /> Delivered & Paid ({order.collectedMethod || 'CASH'})
                              </span>
                            )}
                            <span className="font-black text-sm text-pos-text truncate pr-2">{order.tableName || order.customerName || 'Takeaway'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 px-1.5 py-0.5 rounded shrink-0">
                            <Clock className="h-3 w-3" /> {order.timestamp}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[11px] font-bold text-pos-text-muted truncate">
                            {order.customerName ? order.customerName : 'Walk-In Guest'}
                          </p>
                          <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                            <User className="h-3 w-3" /> {order.waiterName || 'No Server'}
                          </span>
                          {order.items.some(i => i.status === 'SENT') && getKitchenStatusBadge(order.tableName || null, order.orderType)}
                        </div>
                      
                      <p className="text-[10px] text-pos-text-muted truncate flex items-center gap-1">
                        <span className="font-black text-pos-text bg-pos-bg px-1 rounded">{order.items.length} items</span>
                        {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </p>
                    </div>
                    
                    <button className="h-10 w-10 shrink-0 bg-emerald-50 dark:bg-emerald-950/40 group-hover:bg-emerald-500 text-emerald-600 group-hover:text-white border border-emerald-200 dark:border-emerald-700/50 group-hover:border-emerald-500 rounded-full flex items-center justify-center transition-colors shadow-sm">
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
          <div className="bg-pos-sidebar w-full max-w-sm rounded-2xl border border-pos-border p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${receiptType === 'CHECKOUT' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-pos-bg text-pos-text-muted border-pos-border'}`}>
              {receiptType === 'CHECKOUT' ? <CheckCircle2 className="h-7 w-7 shrink-0" /> : <Printer className="h-6 w-6 shrink-0" />}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-pos-text">
                {receiptType === 'CHECKOUT' ? 'Bill Settled Successfully!' : 'Pre-Bill Preview'}
              </h3>
              <p className="text-xs font-bold text-pos-text-muted">Invoice: {lastBill.billNumber} • {lastBill.time}</p>
            </div>

            {/* Simulated ESC/POS Thermal Paper Preview */}
            <div className="w-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 font-mono text-left p-4 rounded-lg shadow-inner text-xs space-y-2 border-t-4 border-dashed border-pos-border">
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
                        <div key={aIdx} className="flex justify-between text-[10px] text-emerald-600 dark:text-emerald-400 pl-2">
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
                className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span>Confirm & Print</span>
              </button>
              <button
                onClick={() => {
                  window.open(`https://wa.me/?text=Here is your Karvaan POS receipt #${lastBill.billNumber} for ₹${lastBill.grandTotal}. Thank you for visiting!`, '_blank');
                }}
                className="flex items-center justify-center gap-2 py-2.5 bg-pos-card hover:bg-pos-card-hover text-pos-text font-bold text-xs rounded-xl border border-pos-border transition-colors shadow-sm cursor-pointer"
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
                className="w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-extrabold text-xs rounded-xl transition-colors border border-amber-500/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Process Return / Refund</span>
              </button>
            )}

            <button
              onClick={() => setReceiptType(null)}
              className="w-full py-2.5 bg-pos-bg hover:bg-pos-card-hover text-pos-text-muted hover:text-pos-text text-xs font-extrabold rounded-xl transition-colors border border-pos-border cursor-pointer flex items-center justify-center gap-2"
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
          <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-pos-text">Customize: {customNoteModal.name}</h3>
            
            {/* Notes Section */}
            <div>
              <label className="text-xs font-bold text-pos-text-muted mb-1 block">Custom Note</label>
              <input
                type="text"
                placeholder="e.g. Less spicy, Extra cheese, No onions..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text placeholder-pos-text-muted text-sm focus:outline-none focus:border-pos-accent font-bold shadow-inner"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {predefinedNotes.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setNoteText(prev => prev ? `${prev}, ${preset.label}` : preset.label)}
                    className="px-2.5 py-1 bg-pos-bg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[10px] font-black text-pos-text-muted hover:text-emerald-700 dark:hover:text-emerald-400 border border-pos-border rounded-lg transition-all cursor-pointer shadow-2xs"
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
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-pos-bg border-pos-border text-pos-text hover:border-emerald-400'
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
                className="px-4 py-2 bg-pos-bg text-pos-text-muted hover:text-pos-text rounded-xl text-sm font-bold border border-pos-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNoteAndAddons}
                className="px-4 py-2 bg-gradient-to-r from-pos-accent to-teal-600 text-white font-extrabold rounded-xl text-sm shadow-sm transition-transform active:scale-95 cursor-pointer"
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
