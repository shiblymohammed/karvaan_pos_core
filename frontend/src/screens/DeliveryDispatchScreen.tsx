import React, { useState } from 'react';
import { useDeliveryStore, DeliveryOrder } from '../store/useDeliveryStore';
import { useStaffStore } from '../store/useStaffStore';
import { useAuthStore } from '../store/useAuthStore';
import { useKdsStore } from '../store/useKdsStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { socket } from '../services/socket';
import { 
  Bike, MapPin, Phone, User, CheckCircle2, X, Search, 
  Package, Navigation, ChevronRight, AlertCircle, Banknote, QrCode, CreditCard, Wallet, Clock, DollarSign, Check, RotateCcw
} from 'lucide-react';
import { ReturnOrderModal } from '../components/ReturnOrderModal';

const STATUS_STEPS = ['NEW / PREPARING', 'OUT FOR DELIVERY', 'DELIVERED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:         { label: 'Order Received',     color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-950/40',    border: 'border-blue-200 dark:border-blue-800' },
  PREPARING:        { label: 'Preparing',          color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/40',  border: 'border-amber-200 dark:border-amber-800' },
  READY:            { label: 'Ready for Pickup',   color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery',  color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800' },
  DELIVERED:        { label: 'Delivered',          color: 'text-gray-500',                       bg: 'bg-gray-50',                         border: 'border-gray-200' },
  CANCELLED:        { label: 'Cancelled',          color: 'text-red-600',                        bg: 'bg-red-50',                          border: 'border-red-200' },
};

const OrderCard: React.FC<{
  order: DeliveryOrder;
  kdsTicket?: any;
  currentUser?: any;
  onAssign: (riderId: string, riderName: string) => void;
  onOpenPaymentModal: () => void;
  onMarkDeliveredPrepaid: () => void;
  onOpenReturnModal: () => void;
  onRemove: () => void;
  availableRiders: Array<{ id: string; name: string; phone?: string; activeCount: number }>;
}> = ({ order, kdsTicket, currentUser, onAssign, onOpenPaymentModal, onMarkDeliveredPrepaid, onOpenReturnModal, onRemove, availableRiders }) => {
  const [showAssign, setShowAssign] = useState(false);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['RECEIVED'];
  
  let stepIdx = 0;
  if (order.status === 'OUT_FOR_DELIVERY') stepIdx = 1;
  if (order.status === 'DELIVERED') stepIdx = 2;

  const isActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const isPrepaid = order.paymentStatus === 'COLLECTED';

  const handleTakeOrder = () => {
    // If the logged-in user is a delivery rider, assign directly to them!
    if (currentUser?.role === 'DELIVERY') {
      onAssign(currentUser.id, currentUser.name);
    } else {
      setShowAssign(true);
    }
  };

  return (
    <div className={`rounded-2xl border ${cfg.border} shadow-sm overflow-hidden transition-all bg-pos-card`}>
      {/* Color accent bar */}
      <div className={`h-1.5 w-full ${
        order.status === 'OUT_FOR_DELIVERY' ? 'bg-purple-500' :
        order.status === 'READY' ? 'bg-emerald-500' :
        order.status === 'PREPARING' ? 'bg-amber-500' :
        order.status === 'DELIVERED' ? 'bg-gray-300' : 'bg-blue-400'
      }`} />

      <div className={`p-4 ${cfg.bg}`}>
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                {cfg.label}
              </span>
              
              {/* Live Kitchen Status from KDS */}
              {kdsTicket ? (
                kdsTicket.status === 'READY' || kdsTicket.status === 'SERVED' ? (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-white shadow-2xs flex items-center gap-1">
                    ✅ Kitchen: Food Ready
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-white shadow-2xs flex items-center gap-1 animate-pulse">
                    🍳 Kitchen: Preparing ({kdsTicket.elapsedMinutes}m)
                  </span>
                )
              ) : (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500 text-white shadow-2xs">
                  📦 Order Packed
                </span>
              )}

              {/* COD / Pre-Paid payment badge */}
              {order.orderType === 'DELIVERY' && (
                isPrepaid ? (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Pre-Paid ({order.paymentMethod || 'Online'})
                  </span>
                ) : (
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 animate-pulse">
                    💵 COD Pending
                  </span>
                )
              )}
            </div>
            <h3 className="font-black text-pos-text text-lg leading-tight">{order.customerName}</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-pos-text-muted">{order.orderNumber}</p>
            <p className="font-black text-emerald-600 text-base">₹{order.grandTotal.toFixed(0)}</p>
            {order.deliveryFee ? <p className="text-[10px] text-purple-600 font-bold">+₹{order.deliveryFee} del. fee</p> : null}
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-1 gap-1.5 mb-3">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-black/20 rounded-xl px-3 py-2 border border-white/40">
            <Phone className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="font-black text-pos-text text-sm">{order.customerPhone || '—'}</span>
            <span className="ml-auto text-[10px] text-pos-text-muted">{order.placedAt}</span>
          </div>

          {order.deliveryAddress && (
            <div className="flex items-start gap-2 bg-white/60 dark:bg-black/20 rounded-xl px-3 py-2 border border-white/40">
              <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="font-bold text-pos-text text-sm leading-snug">{order.deliveryAddress}</span>
            </div>
          )}
        </div>

        {/* Items Summary */}
        <div className="bg-white/50 dark:bg-black/20 rounded-xl p-2.5 border border-white/40 mb-3">
          <p className="text-[10px] font-black text-pos-text-muted uppercase mb-1.5">Order Items</p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5">
              <span className="font-bold text-pos-text">{item.quantity}× {item.name}</span>
              <span className="text-pos-text-muted">₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Status Pipeline (Simplified for Rider) */}
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
          {STATUS_STEPS.map((step, i) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0 transition-colors ${
                i < stepIdx ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' :
                i === stepIdx ? 'bg-pos-accent text-white shadow-sm' :
                'bg-white/40 dark:bg-black/20 text-pos-text-muted'
              }`}>
                {i < stepIdx && <CheckCircle2 className="h-2.5 w-2.5" />}
                {step}
              </div>
              {i < 2 && <ChevronRight className="h-3 w-3 text-pos-text-muted shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Assigned Rider */}
        {order.deliveryBoyName && (
          <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-2 mb-3">
            <Bike className="h-4 w-4 text-purple-600" />
            <span className="font-black text-sm text-purple-700 dark:text-purple-300">{order.deliveryBoyName}</span>
            <span className="ml-auto text-[10px] font-bold text-purple-500">Assigned Rider</span>
          </div>
        )}

        {/* Rider Assignment Dropdown (for Cashier / Admin - Supports Batched Deliveries) */}
        {showAssign && (
          <div className="mb-3 p-3 bg-white dark:bg-pos-card rounded-xl border border-pos-border shadow-sm">
            <p className="text-[10px] font-black text-pos-text-muted uppercase mb-2">Select Available Rider (Batched OK):</p>
            {availableRiders.length === 0 ? (
              <div className="flex items-center gap-2 text-red-500 text-xs font-bold py-1">
                <AlertCircle className="h-3.5 w-3.5" /> No riders in staff list
              </div>
            ) : (
              <div className="space-y-1.5">
                {availableRiders.map(r => (
                  <button key={r.id} onClick={() => { onAssign(r.id, r.name); setShowAssign(false); }}
                    className="w-full flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-pointer transition-colors text-left">
                    <div className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center font-black text-xs shrink-0">{r.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-xs text-pos-text">{r.name}</p>
                        {r.activeCount > 0 && (
                          <span className="text-[9px] font-bold text-purple-700 bg-purple-200 px-1.5 py-0.2 rounded-full">🛵 {r.activeCount} on road</span>
                        )}
                      </div>
                      {r.phone && <p className="text-[10px] text-pos-text-muted">{r.phone}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowAssign(false)} className="mt-2 w-full py-1.5 text-xs font-bold text-pos-text-muted bg-pos-bg rounded-lg border border-pos-border cursor-pointer">Cancel</button>
          </div>
        )}

        {/* Action Buttons (Context-Aware: COD demands cash modal, Pre-Paid marks delivered directly) */}
        {isActive && (
          <div className="flex gap-2">
            {!order.deliveryBoyId ? (
              <button onClick={handleTakeOrder} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 animate-pulse">
                <Bike className="h-4 w-4" /> <span>{currentUser?.role === 'DELIVERY' ? '🛵 Take Order for Delivery' : '🛵 Assign Rider'}</span>
              </button>
            ) : isPrepaid ? (
              <button onClick={onMarkDeliveredPrepaid} className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> <span>📦 Mark Delivered (Pre-Paid)</span>
              </button>
            ) : (
              <button onClick={onOpenPaymentModal} className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center gap-2">
                <Wallet className="h-4 w-4" /> <span>💰 Collect Payment & Deliver</span>
              </button>
            )}

            {currentUser?.role !== 'DELIVERY' && (
              <button onClick={onOpenReturnModal} className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-black rounded-xl cursor-pointer border border-amber-500/30 transition-colors active:scale-95 flex items-center gap-1" title="Return / Refund Order">
                <RotateCcw className="h-3.5 w-3.5" /> Return
              </button>
            )}

            {currentUser?.role !== 'DELIVERY' && (
              <button onClick={onRemove} className="py-2 px-3 bg-white/60 dark:bg-black/20 hover:bg-red-50 text-red-400 text-xs font-black rounded-xl cursor-pointer border border-red-200 transition-colors active:scale-95" title="Remove Order">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {!isActive && (
          <button onClick={onRemove} className="w-full py-1.5 text-xs font-bold text-pos-text-muted bg-white/40 hover:bg-red-50 rounded-xl border border-pos-border cursor-pointer transition-colors">
            Remove from list
          </button>
        )}
      </div>
    </div>
  );
};

export const DeliveryDispatchScreen: React.FC = () => {
  const { orders, collectPayment, assignDeliveryBoy, removeOrder, updateDeliveryBoy } = useDeliveryStore();
  const { getDeliveryRiders } = useStaffStore();
  const { currentUser } = useAuthStore();
  const { tickets: kdsTickets } = useKdsStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Payment Modal State (for COD orders)
  const [paymentModalOrder, setPaymentModalOrder] = useState<DeliveryOrder | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);

  // Return Modal State
  const [returnModalOrder, setReturnModalOrder] = useState<DeliveryOrder | null>(null);

  // Shift Remittance Modal State (Fix 3)
  const [selectedRiderSummary, setSelectedRiderSummary] = useState<any | null>(null);

  // Merge staff-based riders with delivery store boys
  const staffRiders = getDeliveryRiders();

  // Riders available for assignment — Fix 2: Never filter out! Allow batched deliveries (2-3 per trip).
  const availableRiders = staffRiders.map(r => {
    const activeCount = orders.filter(o => o.deliveryBoyId === r.id && o.status === 'OUT_FOR_DELIVERY').length;
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      activeCount,
    };
  });

  const deliveryOrders = orders
    .filter(o => o.orderType === 'DELIVERY')
    .filter(o => filterStatus === 'ALL' || (o.status !== 'DELIVERED' && o.status !== 'CANCELLED'))
    .filter(o => !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.deliveryAddress || '').toLowerCase().includes(search.toLowerCase())
    );

  // Fix 4: Inject COD collections directly into Master Revenue Ledger when collected!
  const handleCollectPaymentSubmit = (orderId: string, method: 'CASH' | 'UPI' | 'CARD') => {
    collectPayment(orderId, method, collectAmount);
    
    // Inject into master ledger
    const order = orders.find(o => o.id === orderId);
    if (order) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${Date.now()}`,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        amount: collectAmount,
        billNumber: order.orderNumber,
        date: new Date().toLocaleDateString()
      });
    }

    // Free up the rider
    if (order?.deliveryBoyId) {
      updateDeliveryBoy(order.deliveryBoyId, { isAvailable: true, activeOrderId: undefined });
    }
    setPaymentModalOrder(null);
    setTimeout(() => removeOrder(orderId), 5000);
  };

  // Fix 1: For Pre-Paid orders, mark delivered directly without money collection popup!
  const handleMarkDeliveredPrepaid = (order: DeliveryOrder) => {
    collectPayment(order.id, 'UPI', order.grandTotal);
    if (order.deliveryBoyId) {
      updateDeliveryBoy(order.deliveryBoyId, { isAvailable: true, activeOrderId: undefined });
    }
    setTimeout(() => removeOrder(order.id), 5000);
  };

  const handleAssign = (orderId: string, riderId: string, riderName: string) => {
    assignDeliveryBoy(orderId, riderId, riderName);
  };

  // Summary stats
  const activeCount = orders.filter(o => o.orderType === 'DELIVERY' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
  const outForDelivery = orders.filter(o => o.orderType === 'DELIVERY' && o.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = orders.filter(o => o.orderType === 'DELIVERY' && o.status === 'DELIVERED').length;

  return (
    <div className="h-[calc(100vh-64px)] bg-pos-bg overflow-hidden flex flex-col text-pos-text relative">
      {/* Header */}
      <div className="bg-pos-sidebar border-b border-pos-border px-6 py-4 flex items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-pos-text flex items-center gap-2">
            <Bike className="h-6 w-6 text-purple-500" /> Delivery Dispatch & Riders
          </h1>
          <p className="text-xs font-bold text-pos-text-muted">
            {availableRiders.length} riders available · {outForDelivery} out on road
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 ml-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pos-card rounded-xl border border-pos-border text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-pos-text-muted">Active:</span>
            <span className="text-pos-text">{activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pos-card rounded-xl border border-pos-border text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-pos-text-muted">On Road:</span>
            <span className="text-pos-text">{outForDelivery}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pos-card rounded-xl border border-pos-border text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-pos-text-muted">Delivered:</span>
            <span className="text-pos-text">{deliveredCount}</span>
          </div>
        </div>

        {/* Search + filter + sync */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => { socket.emit('sync_delivery_orders', orders); alert('📡 Broadcasted delivery orders to all connected POS screens!'); }} className="px-3 py-1.5 text-xs font-black rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-sm flex items-center gap-1 cursor-pointer transition-colors" title="Push this terminal's orders to all other browsers">
            🔄 Sync Screens
          </button>
          <button onClick={() => setFilterStatus(f => f === 'ACTIVE' ? 'ALL' : 'ACTIVE')} className={`px-3 py-1.5 text-xs font-black rounded-xl border cursor-pointer transition-colors ${filterStatus === 'ALL' ? 'bg-pos-accent text-white border-pos-accent' : 'bg-pos-card text-pos-text-muted border-pos-border'}`}>
            {filterStatus === 'ALL' ? 'All Orders' : 'Active Only'}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-pos-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, address..." className="pl-9 pr-4 py-1.5 bg-pos-card border border-pos-border rounded-xl text-xs font-bold placeholder:text-pos-text-muted focus:outline-none focus:border-purple-400 w-52" />
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 overflow-hidden flex gap-0">
        {/* LEFT: Orders */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {deliveryOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-pos-text-muted">
              <Bike className="h-16 w-16 opacity-20" />
              <p className="text-lg font-black">No delivery orders</p>
              <p className="text-sm">Create a Delivery order from the POS screen</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {deliveryOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  kdsTicket={kdsTickets.find(t => t.orderNumber === order.orderNumber)}
                  currentUser={currentUser}
                  onAssign={(riderId, riderName) => handleAssign(order.id, riderId, riderName)}
                  onOpenPaymentModal={() => {
                    setPaymentModalOrder(order);
                    setCollectAmount(order.grandTotal);
                  }}
                  onMarkDeliveredPrepaid={() => handleMarkDeliveredPrepaid(order)}
                  onOpenReturnModal={() => setReturnModalOrder(order)}
                  onRemove={() => removeOrder(order.id)}
                  availableRiders={availableRiders}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Rider Roster (Click card for Shift-End Settlement Summary) or My Shift Panel */}
        <div className="w-72 bg-pos-sidebar border-l border-pos-border flex flex-col overflow-hidden">
          {currentUser?.role === 'DELIVERY' ? (
            <div className="flex flex-col h-full p-4 space-y-4">
              <div className="border-b border-pos-border pb-3">
                <h2 className="font-black text-pos-text flex items-center gap-2 text-sm">
                  <Bike className="h-4 w-4 text-purple-500" /> My Rider Shift
                </h2>
                <p className="text-[10px] text-pos-text-muted mt-0.5">Route & Delivery Status</p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500 text-white font-black text-lg flex items-center justify-center mx-auto mb-2 shadow-sm">
                  {currentUser.name?.charAt(0) || 'D'}
                </div>
                <h3 className="font-black text-base text-pos-text">{currentUser.name || 'Delivery Rider'}</h3>
                <span className="inline-block text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-0.5 rounded-full mt-1">
                  🛵 Active Rider Shift
                </span>
              </div>

              <div className="bg-pos-card rounded-2xl border border-pos-border p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-pos-text-muted">On Road Now:</span>
                  <span className="font-black text-purple-600 dark:text-purple-400">{orders.filter(o => o.deliveryBoyId === currentUser.id && o.status === 'OUT_FOR_DELIVERY').length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-pos-text-muted">Completed Today:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{orders.filter(o => o.deliveryBoyId === currentUser.id && o.status === 'DELIVERED').length}</span>
                </div>
              </div>

              <div className="mt-auto p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 text-center leading-relaxed">
                  🔒 Shift Cash Settlement & Reconciliation is locked to Admin & Managers at shift end.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-pos-border px-4 py-3">
                <h2 className="font-black text-pos-text flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-purple-500" /> Rider Shift Roster
                </h2>
                <p className="text-[10px] text-pos-text-muted mt-0.5">Click rider for daily shift cash remittance</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {staffRiders.length === 0 ? (
                  <div className="text-center p-4 text-pos-text-muted">
                    <Bike className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs font-bold">No delivery riders found.</p>
                    <p className="text-[10px] mt-1">Go to Admin → Staff and add a staff member with the "Delivery Rider" role.</p>
                  </div>
                ) : (
                  staffRiders.map(rider => {
                    const activeOrders = orders.filter(o => o.deliveryBoyId === rider.id && o.status === 'OUT_FOR_DELIVERY');
                    const completedToday = orders.filter(o => o.deliveryBoyId === rider.id && o.status === 'DELIVERED').length;
                    const isOnDelivery = activeOrders.length > 0;

                    return (
                      <div
                        key={rider.id}
                        onClick={() => setSelectedRiderSummary(rider)}
                        className={`rounded-xl border p-3 transition-all cursor-pointer hover:border-purple-400 active:scale-[0.98] ${isOnDelivery ? 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20' : 'border-pos-border bg-pos-card'}`}
                        title="Click for Shift Remittance Settlement"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${isOnDelivery ? 'bg-purple-500 text-white' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'}`}>
                            {rider.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-pos-text truncate">{rider.name}</p>
                            <p className="text-[10px] text-pos-text-muted font-bold">Today: {completedToday} deliveries</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${isOnDelivery ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'}`}>
                            {isOnDelivery ? <><Bike className="h-2.5 w-2.5" /> {activeOrders.length} On Road</> : <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Available</>}
                          </span>
                          <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 underline">Shift Settle →</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SHIFT REMITTANCE SUMMARY MODAL (Fix 3) */}
      {selectedRiderSummary && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-pos-card border border-pos-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-pos-text">
            <div className="flex items-center justify-between border-b border-pos-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-950/60 rounded-2xl text-purple-600">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black leading-tight">Rider Shift Settlement</h3>
                  <p className="text-xs font-bold text-pos-text-muted mt-0.5">Reconcile cash collections for {selectedRiderSummary.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRiderSummary(null)} className="p-2 hover:bg-pos-bg rounded-full text-pos-text-muted transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const riderOrders = orders.filter(o => o.deliveryBoyId === selectedRiderSummary.id && o.status === 'DELIVERED');
              const totalDeliveries = riderOrders.length;
              const cashInHand = riderOrders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + (o.collectedAmount || o.grandTotal), 0);
              const upiBank = riderOrders.filter(o => o.paymentMethod === 'UPI' || o.paymentMethod === 'CARD').reduce((sum, o) => sum + (o.collectedAmount || o.grandTotal), 0);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-pos-bg p-3 rounded-2xl border border-pos-border text-center">
                      <p className="text-[10px] font-bold text-pos-text-muted uppercase">Total Completed</p>
                      <p className="text-2xl font-black text-pos-text mt-1">{totalDeliveries} <span className="text-xs font-normal">orders</span></p>
                    </div>
                    <div className="bg-pos-bg p-3 rounded-2xl border border-pos-border text-center">
                      <p className="text-[10px] font-bold text-pos-text-muted uppercase">Online / Pre-Paid</p>
                      <p className="text-2xl font-black text-indigo-500 mt-1">₹{upiBank.toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl p-4 text-center space-y-1 shadow-md">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">💵 CASH TO COLLECT FROM RIDER</p>
                    <p className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">₹{cashInHand.toFixed(0)}</p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">Physical cash rider collected from COD deliveries today</p>
                  </div>

                  <button
                    onClick={() => {
                      alert(`✅ Shift closed for ${selectedRiderSummary.name}!\n\nReconciled ₹${cashInHand.toFixed(0)} cash in hand and ₹${upiBank.toFixed(0)} online collections.`);
                      setSelectedRiderSummary(null);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" /> Reconcile & Close Shift
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PAYMENT COLLECTION MODAL (POPUP) */}
      {paymentModalOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-pos-card border border-pos-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-pos-text">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-pos-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl text-emerald-600">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black leading-tight">Collect Delivery Payment</h3>
                  <p className="text-xs font-bold text-pos-text-muted mt-0.5">Order #{paymentModalOrder.orderNumber} • 👤 {paymentModalOrder.customerName}</p>
                </div>
              </div>
              <button onClick={() => setPaymentModalOrder(null)} className="p-2 hover:bg-pos-bg rounded-full text-pos-text-muted transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Amount Payable Box */}
            <div className="bg-pos-bg border border-pos-border rounded-2xl p-4 text-center space-y-1">
              <p className="text-xs font-bold text-pos-text-muted uppercase">Total Amount to Collect</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-extrabold text-emerald-600">₹</span>
                <input
                  type="number"
                  value={collectAmount}
                  onChange={e => setCollectAmount(Number(e.target.value))}
                  className="text-3xl font-black text-emerald-600 bg-transparent text-center w-36 focus:outline-none border-b-2 border-emerald-500 pb-0.5"
                />
              </div>
              <p className="text-[10px] text-pos-text-muted">Editable if customer paid tip or partial</p>
            </div>

            {/* Payment Methods */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-pos-text-muted uppercase tracking-wider">Select Payment Mode:</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleCollectPaymentSubmit(paymentModalOrder.id, 'CASH')}
                  className="flex flex-col items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Banknote className="h-6 w-6" />
                  <span>Cash (₹)</span>
                </button>
                <button
                  onClick={() => handleCollectPaymentSubmit(paymentModalOrder.id, 'UPI')}
                  className="flex flex-col items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <QrCode className="h-6 w-6" />
                  <span>UPI / QR</span>
                </button>
                <button
                  onClick={() => handleCollectPaymentSubmit(paymentModalOrder.id, 'CARD')}
                  className="flex flex-col items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Card / POS</span>
                </button>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setPaymentModalOrder(null)}
              className="w-full py-2.5 bg-pos-bg hover:bg-pos-sidebar border border-pos-border rounded-xl font-bold text-xs text-pos-text-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RETURN & REFUND STUDIO MODAL */}
      <ReturnOrderModal
        isOpen={!!returnModalOrder}
        onClose={() => setReturnModalOrder(null)}
        orderData={returnModalOrder ? {
          orderId: returnModalOrder.id,
          billNumber: returnModalOrder.orderNumber,
          orderType: 'DELIVERY',
          customerName: returnModalOrder.customerName,
          customerPhone: returnModalOrder.customerPhone,
          items: returnModalOrder.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          grandTotal: returnModalOrder.grandTotal,
          paymentMethod: returnModalOrder.paymentMethod
        } : null}
        onConfirmReturn={(returnedItems, action, reason, refundDest, isFullOrder) => {
          if (returnModalOrder) {
            useDeliveryStore.getState().updateOrderStatus(returnModalOrder.id, 'CANCELLED');
          }
        }}
      />
    </div>
  );
};

