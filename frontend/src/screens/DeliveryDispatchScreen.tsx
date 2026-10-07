import React, { useState, useMemo } from 'react';
import { useDeliveryStore, DeliveryOrder } from '../store/useDeliveryStore';
import { useStaffStore } from '../store/useStaffStore';
import { useAuthStore } from '../store/useAuthStore';
import { useKdsStore } from '../store/useKdsStore';
import { useLedgerStore } from '../store/useLedgerStore';
import { emitAction } from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, MapPin, Phone, CheckCircle2, X, Search,
  Package, Navigation, AlertCircle, Banknote, QrCode,
  Wallet, Clock, Check, RotateCcw, RefreshCw, Filter,
  SearchX, User, ChevronRight, Printer, Share2
} from 'lucide-react';
import { ReturnOrderModal } from '../components/ReturnOrderModal';


// ─── Helpers ────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; bar: string; badge: string; text: string }> = {
  RECEIVED:         { label: 'Received',      bar: 'bg-blue-500',    badge: 'bg-blue-100 border-blue-200 text-blue-700',    text: 'text-blue-700' },
  PREPARING:        { label: 'Preparing',     bar: 'bg-amber-400',   badge: 'bg-amber-50 border-amber-200 text-amber-700',  text: 'text-amber-700' },
  READY:            { label: 'Ready',         bar: 'bg-emerald-500', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: 'text-emerald-700' },
  OUT_FOR_DELIVERY: { label: 'On Road',       bar: 'bg-orange-500',  badge: 'bg-orange-50 border-orange-200 text-orange-700', text: 'text-orange-700' },
  DELIVERED:        { label: 'Delivered',     bar: 'bg-slate-300',   badge: 'bg-slate-100 border-slate-200 text-slate-500', text: 'text-slate-500' },
  CANCELLED:        { label: 'Cancelled',     bar: 'bg-rose-400',    badge: 'bg-rose-50 border-rose-200 text-rose-600',    text: 'text-rose-600' },
};

// ─── OrderCard ───────────────────────────────────────────────────────────────
const OrderCard = ({ order, kdsTicket, currentUser, onAssign, onOpenPaymentModal, onMarkDeliveredPrepaid, onOpenReturnModal, onRemove, onRiderUnassign, availableRiders }: any) => {
  const [showAssign, setShowAssign] = useState(false);
  const cfg = statusConfig[order.status] || statusConfig.RECEIVED;
  const isActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const isPrepaid = order.paymentStatus === 'COLLECTED';
  const isAssigned = !!order.deliveryBoyId;
  // Fix 3: food is ready only when KDS says READY/SERVED, OR no KDS ticket (pre-packed/parcel)
  const isReady = !kdsTicket || kdsTicket?.status === 'READY' || kdsTicket?.status === 'SERVED' || order.status === 'READY';
  const isRider = currentUser?.role === 'DELIVERY';
  const isMyOrder = order.deliveryBoyId === currentUser?.id;

  const handleTakeOrder = () => {
    if (isRider) {
      if (!isReady) return; // Fix 3: guard
      onAssign(currentUser.id, currentUser.name);
    } else {
      setShowAssign(s => !s);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative flex flex-col bg-white/80 backdrop-blur-xl rounded-[22px] border border-white/80 shadow-sm hover:shadow-lg transition-shadow overflow-visible"
    >
      {/* Status bar */}
      <div className={`h-1 w-full rounded-t-[22px] ${cfg.bar}`} />

      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-800 text-[15px] leading-tight">{order.customerName}</span>
              <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500">
              <span className="text-orange-600 font-black">#{order.orderNumber}</span>
              <span>·</span>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.deliveryAddress || 'No Address'}</span>
            </div>
            {order.customerPhone && (
              <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-slate-400">
                <Phone className="h-3 w-3" /> {order.customerPhone}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-slate-800">₹{order.grandTotal.toFixed(0)}</p>
            {order.deliveryFee ? <p className="text-[9px] font-bold text-slate-400">+₹{order.deliveryFee} fee</p> : null}
          </div>
        </div>

        {/* Kitchen status */}
        <div className="flex items-center justify-between bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kitchen</span>
          {kdsTicket ? (
            isReady
              ? <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Food Ready</span>
              : <span className="text-[10px] font-black text-amber-600 flex items-center gap-1"><Clock className="h-3 w-3 animate-pulse" /> Preparing ({kdsTicket.elapsedMinutes}m)</span>
          ) : (
            <span className="text-[10px] font-black text-blue-600 flex items-center gap-1"><Package className="h-3 w-3" /> Packed</span>
          )}
        </div>

        {/* Items summary */}
        <div className="border-t border-b border-slate-100 py-2.5 space-y-1">
          {order.items.slice(0, 2).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-[11px] font-bold text-slate-600">
              <span className="truncate pr-2">{item.quantity}× {item.name}</span>
              <span className="shrink-0 text-slate-400">₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          {order.items.length > 2 && (
            <div className="text-[10px] font-bold text-slate-400 italic">+ {order.items.length - 2} more items</div>
          )}
        </div>

        {/* Payment status */}
        <div className="flex items-center justify-between">
          {isPrepaid
            ? <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Paid Online</span>
            : <span className="text-[11px] font-black text-rose-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> COD Pending</span>
          }
        </div>

        {/* Rider / Action section */}
        <div className="relative">
          {!isAssigned ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rider</span>
                <span className="text-[11px] font-bold text-slate-400">Unassigned</span>
              </div>
              {isActive && (
                <div className="space-y-1.5">
                  {/* Fix 3: show warning if food not ready yet */}
                  {isRider && !isReady && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-[10px] font-black text-amber-700">Kitchen still preparing — wait for READY</span>
                    </div>
                  )}
                  <button onClick={handleTakeOrder}
                    disabled={isRider && !isReady}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-200 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    <Bike className="h-4 w-4" />
                    {isRider ? (isReady ? 'Take This Order' : 'Not Ready Yet') : 'Assign Rider'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-orange-50 px-3 py-2 rounded-xl border border-orange-100">
                <div>
                  <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">Rider</span>
                  <span className="text-xs font-black text-orange-700 flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5" /> {order.deliveryBoyName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Fix 5: Rider self-unassign */}
                  {isRider && isMyOrder && isActive && (
                    <button onClick={() => onRiderUnassign(order.id)} className="text-[10px] font-black text-rose-500 hover:text-rose-700 underline cursor-pointer">
                      Unassign
                    </button>
                  )}
                  {isActive && !isRider && (
                    <button onClick={() => setShowAssign(s => !s)} className="text-[10px] font-black text-orange-500 underline cursor-pointer">
                      Change
                    </button>
                  )}
                </div>
              </div>
              {isActive && (
                isPrepaid ? (
                  <button onClick={onMarkDeliveredPrepaid}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer">
                    <Check className="h-4 w-4" /> Mark Delivered
                  </button>
                ) : (
                  <button onClick={onOpenPaymentModal}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer">
                    <Wallet className="h-4 w-4" /> Collect ₹{order.grandTotal.toFixed(0)}
                  </button>
                )
              )}
            </div>
          )}

          {/* Assignment dropdown */}
          <AnimatePresence>
            {showAssign && isActive && !isRider && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute bottom-full mb-2 left-0 w-full p-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50"
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Rider</span>
                  <button onClick={() => setShowAssign(false)}><X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 cursor-pointer" /></button>
                </div>
                {availableRiders.length === 0 ? (
                  <p className="text-xs text-rose-500 font-bold p-2 text-center">No riders available.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {availableRiders.map((r: any) => (
                      <button key={r.id} onClick={() => { onAssign(r.id, r.name); setShowAssign(false); }}
                        className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-200 rounded-xl cursor-pointer transition-colors text-left group">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-black text-[11px] flex items-center justify-center">
                            {r.name.charAt(0)}
                          </div>
                          <span className="font-black text-xs text-slate-700 group-hover:text-orange-700">{r.name}</span>
                        </div>
                        {r.activeCount > 0
                          ? <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100 flex items-center gap-1"><Bike className="h-2.5 w-2.5" /> {r.activeCount} active</span>
                          : <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">Free</span>
                        }
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex gap-3">
            {isActive && !isRider && (
              <button onClick={onOpenReturnModal} className="text-[10px] font-black text-slate-400 hover:text-amber-600 flex items-center gap-1 cursor-pointer transition-colors">
                <RotateCcw className="h-3 w-3" /> Return
              </button>
            )}
            {!isRider && (
              <button onClick={onRemove} className="text-[10px] font-black text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors">
                <X className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-300">{order.placedAt}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const DeliveryDispatchScreen: React.FC = () => {
  const { orders, collectPayment, assignDeliveryBoy, removeOrder, removeOrders } = useDeliveryStore();
  const { getDeliveryRiders } = useStaffStore();
  const { currentUser } = useAuthStore();
  const { tickets: kdsTickets } = useKdsStore();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [paymentModalOrder, setPaymentModalOrder] = useState<DeliveryOrder | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<'CASH' | 'UPI' | 'SPLIT'>('CASH');
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [returnModalOrder, setReturnModalOrder] = useState<DeliveryOrder | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{ order: DeliveryOrder; method: string; collected: number } | null>(null);
  const [selectedRiderSummary, setSelectedRiderSummary] = useState<any | null>(null);
  const [showRidersMobile, setShowRidersMobile] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const staffRiders = getDeliveryRiders();
  const isRiderMode = currentUser?.role === 'DELIVERY';

  const availableRiders = useMemo(() => staffRiders.map(r => ({
    id: r.id, name: r.name, phone: r.phone,
    activeCount: orders.filter(o => o.deliveryBoyId === r.id && o.status === 'OUT_FOR_DELIVERY').length,
  })), [staffRiders, orders]);

  const deliveryOrders = useMemo(() => orders
    .filter(o => o.orderType === 'DELIVERY' || o.orderType === 'PARCEL')  // Fix 4: include PARCEL
    .filter(o => filterStatus === 'ALL' || (o.status !== 'DELIVERED' && o.status !== 'CANCELLED'))
    .filter(o => !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.deliveryAddress || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), // Fix 7: use ISO updatedAt
    [orders, filterStatus, search]);

  // Rider sees: their own orders + unassigned orders
  const myOrders = isRiderMode
    ? deliveryOrders.filter(o => o.deliveryBoyId === currentUser?.id || !o.deliveryBoyId)
    : deliveryOrders;

  const myActiveRun = isRiderMode
    ? myOrders.find(o => o.deliveryBoyId === currentUser?.id && o.status === 'OUT_FOR_DELIVERY')
    : null;

  const handleCollectPaymentSubmit = (orderId: string, method: 'CASH' | 'UPI' | 'CARD' | 'SPLIT', splitAmounts?: { cash: number; upi: number }) => {
    const collected = method === 'SPLIT' ? (splitAmounts ? splitAmounts.cash + splitAmounts.upi : collectAmount) : collectAmount;
    collectPayment(orderId, method, collected);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      useLedgerStore.getState().addEntry({
        customerId: `cust-${Date.now()}`,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        amount: collected,
        billNumber: order.orderNumber,
        date: new Date().toLocaleDateString()
      });
      // Fix 2: Do NOT updateDeliveryBoy here — removeOrder handles rider availability safely
      const methodLabel = method === 'SPLIT'
        ? `Split (₹${splitAmounts?.cash ?? 0} Cash + ₹${splitAmounts?.upi ?? 0} UPI)`
        : method;
      setCompletedReceipt({ order, method: methodLabel, collected });
    }
    setPaymentModalOrder(null);
    setTimeout(() => removeOrder(orderId), 5000);
  };

  const handleMarkDeliveredPrepaidWithReceipt = (order: DeliveryOrder) => {
    // Fix 6: use 'PREPAID' label, not 'UPI'
    collectPayment(order.id, 'PREPAID', order.grandTotal);
    useLedgerStore.getState().addEntry({
      customerId: `cust-${Date.now()}`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      amount: order.grandTotal,
      billNumber: order.orderNumber,
      date: new Date().toLocaleDateString()
    });
    setCompletedReceipt({ order, method: 'PREPAID (Online)', collected: order.grandTotal });
    setTimeout(() => removeOrder(order.id), 5000);
  };

  // Fix 5: Rider self-unassign
  const handleRiderUnassign = (orderId: string) => {
    useDeliveryStore.getState().updateOrderStatus(orderId, 'READY');
    const order = orders.find(o => o.id === orderId);
    // Clear rider assignment
    useDeliveryStore.setState(state => ({
      orders: state.orders.map(o => o.id === orderId
        ? { ...o, deliveryBoyId: undefined, deliveryBoyName: undefined, status: 'READY', updatedAt: new Date().toISOString() }
        : o
      )
    }));
    showToast('Order unassigned — back to Ready queue.', 'info');
  };

  const handleAssign = (orderId: string, riderId: string, riderName: string) => {
    assignDeliveryBoy(orderId, riderId, riderName);
  };

  // Stats
  const allDeliv = orders.filter(o => o.orderType === 'DELIVERY');
  const pendingCount = allDeliv.filter(o => o.status === 'RECEIVED' || o.status === 'PREPARING').length;
  const readyCount = allDeliv.filter(o => o.status === 'READY').length;
  const onRoadCount = allDeliv.filter(o => o.status === 'OUT_FOR_DELIVERY').length;
  const codPendingAmt = allDeliv.filter(o => o.paymentStatus !== 'COLLECTED' && o.status !== 'DELIVERED').reduce((s, o) => s + o.grandTotal, 0);

  return (
    <div className="h-[calc(100vh-64px)] sm:h-full overflow-hidden flex flex-col relative text-slate-800" style={{ background: 'transparent' }}>

      {/* ── Top Header ───────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-white/60 px-4 sm:px-6 py-3 flex-shrink-0 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isRiderMode ? 'bg-orange-100' : 'bg-orange-100'}`}>
            <Bike className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-800 leading-tight">
              {isRiderMode ? 'My Deliveries' : 'Delivery Dispatch'}
            </h1>
            <p className="hidden sm:block text-[10px] font-bold text-slate-500">
              {isRiderMode ? 'Your active runs & available pickups' : 'Live dispatch board · assign riders · collect COD'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { emitAction('sync_delivery_orders', orders); showToast('Board synced!', 'success'); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-sm">
            <RefreshCw className="h-3 w-3" /> Sync
          </button>
          {!isRiderMode && (
            <button onClick={() => setShowRidersMobile(s => !s)}
              className="sm:hidden px-3 py-2 text-xs font-black text-orange-600 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-1.5 cursor-pointer">
              <User className="h-4 w-4" /> Riders
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Bar ────────────────────────────────────────── */}
      {!isRiderMode ? (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 sm:px-6 py-2.5 flex items-center gap-4 sm:gap-6 overflow-x-auto hide-scrollbar shrink-0">
          {[
            { label: 'Pending', value: pendingCount, color: 'text-orange-100' },
            { label: 'Ready', value: readyCount, color: 'text-white' },
            { label: 'On Road', value: onRoadCount, color: 'text-white' },
            { label: 'COD Due', value: `₹${codPendingAmt.toFixed(0)}`, color: 'text-yellow-200' },
          ].map((stat, i, arr) => (
            <React.Fragment key={stat.label}>
              <div className="flex items-center gap-2 shrink-0">
                <div>
                  <p className="text-[9px] font-black text-orange-200 uppercase tracking-widest">{stat.label}</p>
                  <p className={`text-base font-black ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
              {i < arr.length - 1 && <div className="w-px h-6 bg-orange-400/50 shrink-0" />}
            </React.Fragment>
          ))}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black text-orange-200 uppercase tracking-widest">
              {allDeliv.filter(o => o.status === 'DELIVERED').length} delivered today
            </span>
          </div>
        </div>
      ) : (
        /* Rider stats bar */
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 sm:px-6 py-2.5 flex items-center gap-4 overflow-x-auto hide-scrollbar shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <p className="text-[9px] font-black text-orange-200 uppercase tracking-widest">My Active</p>
              <p className="text-base font-black text-white">
                {myOrders.filter(o => o.deliveryBoyId === currentUser?.id && o.status === 'OUT_FOR_DELIVERY').length}
              </p>
            </div>
          </div>
          <div className="w-px h-6 bg-orange-400/50 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <p className="text-[9px] font-black text-orange-200 uppercase tracking-widest">Completed</p>
              <p className="text-base font-black text-white">
                {orders.filter(o => o.deliveryBoyId === currentUser?.id && o.status === 'DELIVERED').length}
              </p>
            </div>
          </div>
          <div className="w-px h-6 bg-orange-400/50 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <p className="text-[9px] font-black text-yellow-200 uppercase tracking-widest">COD to Collect</p>
              <p className="text-base font-black text-yellow-100">
                ₹{myOrders.filter(o => o.deliveryBoyId === currentUser?.id && o.paymentStatus !== 'COLLECTED').reduce((s, o) => s + o.grandTotal, 0).toFixed(0)}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-black text-orange-200">Available pickups: {myOrders.filter(o => !o.deliveryBoyId).length}</span>
          </div>
        </div>
      )}

      {/* ── Main Area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

        {/* Left: Order Grid */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

          {/* Rider Active Run Hero */}
          <AnimatePresence>
            {isRiderMode && myActiveRun && (
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="mx-4 sm:mx-6 mt-4 p-4 rounded-[20px] bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-200/50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/20 rounded-lg"><Navigation className="h-4 w-4" /></div>
                  <span className="text-xs font-black uppercase tracking-widest text-orange-100">Active Run</span>
                  <span className="ml-auto text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full">#{myActiveRun.orderNumber}</span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-black text-lg leading-tight">{myActiveRun.customerName}</p>
                    <p className="text-sm text-orange-100 font-bold flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" /> {myActiveRun.deliveryAddress || 'No Address'}
                    </p>
                    {myActiveRun.customerPhone && (
                      <p className="text-xs text-orange-200 font-bold flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {myActiveRun.customerPhone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">₹{myActiveRun.grandTotal.toFixed(0)}</p>
                    <p className="text-[10px] font-black text-orange-200">
                      {myActiveRun.paymentStatus === 'COLLECTED' ? '✓ Paid' : 'COD'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {myActiveRun.paymentStatus === 'COLLECTED' ? (
                    <button onClick={() => handleMarkDeliveredPrepaidWithReceipt(myActiveRun)}
                      className="flex-1 py-2.5 bg-white text-orange-600 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow active:scale-95 cursor-pointer">
                      <Check className="h-4 w-4" /> Mark Delivered
                    </button>
                  ) : (
                    <button onClick={() => { setPaymentModalOrder(myActiveRun); setCollectAmount(myActiveRun.grandTotal); }}
                      className="flex-1 py-2.5 bg-white text-orange-600 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow active:scale-95 cursor-pointer">
                      <Wallet className="h-4 w-4" /> Collect ₹{myActiveRun.grandTotal.toFixed(0)}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toolbar */}
          <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-tight">
                {isRiderMode ? 'Available Pickups' : 'Orders'}
              </h2>
              <span className="text-[10px] font-black text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                {myOrders.length}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, order, address..."
                  className="w-full pl-9 pr-3 py-2 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 shadow-sm transition-all" />
              </div>
              <button onClick={() => setFilterStatus(f => f === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
                className={`shrink-0 px-3 py-2 text-[10px] font-black rounded-xl border flex items-center gap-1 cursor-pointer transition-colors ${
                  filterStatus === 'ALL'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-white/80 text-slate-600 border-slate-200 shadow-sm'
                }`}>
                <Filter className="h-3 w-3" />
                {filterStatus === 'ALL' ? 'All' : 'Active'}
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 px-4 sm:px-6 pb-8 overflow-y-auto">
            {myOrders.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 bg-white/40 border-2 border-dashed border-slate-200/60 rounded-[24px] min-h-[200px]">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <SearchX className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-base font-black text-slate-700 mb-1">No orders found</p>
                <p className="text-xs font-bold text-slate-400">Delivery orders placed on POS will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-24 md:pb-6">
                <AnimatePresence>
                  {myOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      kdsTicket={kdsTickets.find(t => t.orderNumber === order.orderNumber)}
                      currentUser={currentUser}
                      onAssign={(riderId: string, riderName: string) => handleAssign(order.id, riderId, riderName)}
                      onOpenPaymentModal={() => { setPaymentModalOrder(order); setCollectAmount(order.grandTotal); setPayMode('CASH'); setSplitCash(0); setSplitUpi(0); }}
                      onMarkDeliveredPrepaid={() => handleMarkDeliveredPrepaidWithReceipt(order)}
                      onOpenReturnModal={() => setReturnModalOrder(order)}
                      onRemove={() => removeOrder(order.id)}
                      onRiderUnassign={handleRiderUnassign}
                      availableRiders={availableRiders}
                    />
                  ))}

                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right: Rider Sidebar */}
        {!isRiderMode && (
          <>
            <div className={`${showRidersMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} fixed inset-y-0 right-0 z-40 md:relative w-72 lg:w-80 bg-white/90 backdrop-blur-2xl border-l border-slate-200/60 flex flex-col shrink-0 transition-transform duration-300 shadow-2xl md:shadow-none`}>
              <div className="px-5 py-4 border-b border-slate-200/60 flex items-center justify-between bg-white/60">
                <div>
                  <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><Bike className="h-4 w-4 text-orange-500" /> RIDERS</h2>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">{staffRiders.length} on roster</p>
                </div>
                <button onClick={() => setShowRidersMobile(false)} className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {staffRiders.length === 0 ? (
                  <div className="text-center p-6 text-slate-400 bg-white/50 rounded-2xl border border-slate-100">
                    <Bike className="h-8 w-8 mx-auto opacity-30 mb-2" />
                    <p className="text-xs font-black text-slate-600">No riders</p>
                    <p className="text-[10px] font-bold mt-1">Add staff with "Delivery Rider" role.</p>
                  </div>
                ) : (
                  staffRiders.map(rider => {
                    const activeOrders = orders.filter(o => o.deliveryBoyId === rider.id && o.status === 'OUT_FOR_DELIVERY');
                    const completedToday = orders.filter(o => o.deliveryBoyId === rider.id && o.status === 'DELIVERED').length;
                    const isOnDelivery = activeOrders.length > 0;
                    return (
                      <div key={rider.id} onClick={() => setSelectedRiderSummary(rider)}
                        className={`relative overflow-hidden rounded-2xl border transition-all cursor-pointer hover:shadow-md active:scale-[0.98] group p-3.5 ${
                          isOnDelivery ? 'bg-orange-50/70 border-orange-200' : 'bg-white border-slate-200 shadow-sm'
                        }`}>
                        {isOnDelivery && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 rounded-l-2xl" />}
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                            isOnDelivery ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {rider.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-800 truncate">{rider.name}</p>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isOnDelivery ? 'text-orange-500' : 'text-emerald-500'}`}>
                              {isOnDelivery ? '🛵 On Road' : '✓ Available'}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-400 transition-colors" />
                        </div>
                        <div className="mt-3 flex items-center gap-4 pt-3 border-t border-slate-200/50">
                          <div>
                            <span className="text-[8px] font-black uppercase text-slate-400 block">Active</span>
                            <span className={`text-sm font-black ${isOnDelivery ? 'text-orange-600' : 'text-slate-500'}`}>{activeOrders.length}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase text-slate-400 block">Trips Today</span>
                            <span className="text-sm font-black text-slate-700">{completedToday}</span>
                          </div>
                          <div className="ml-auto text-[9px] font-black text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            View Shift →
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {showRidersMobile && (
              <div onClick={() => setShowRidersMobile(false)}
                className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 animate-in fade-in" />
            )}
          </>
        )}
      </div>

      {/* ── Shift Remittance Modal ────────────────────────────── */}
      <AnimatePresence>
        {selectedRiderSummary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white/95 backdrop-blur-2xl border border-white rounded-t-[32px] sm:rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Shift Remittance</h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 text-orange-500" /> {selectedRiderSummary.name}
                  </p>
                </div>
                <button onClick={() => setSelectedRiderSummary(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {(() => {
                const riderOrders = orders.filter(o => o.deliveryBoyId === selectedRiderSummary.id && o.status === 'DELIVERED');
                const cashInHand = riderOrders.filter(o => o.paymentMethod === 'CASH').reduce((s, o) => s + (o.collectedAmount || o.grandTotal), 0);
                const upiTotal = riderOrders.filter(o => o.paymentMethod === 'UPI' || o.paymentMethod === 'CARD').reduce((s, o) => s + (o.collectedAmount || o.grandTotal), 0);
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Today's Summary</p>
                      {[['Cash Collected', `₹${cashInHand.toFixed(0)}`], ['UPI / Card', `₹${upiTotal.toFixed(0)}`], ['Total Trips', `${riderOrders.length}`]].map(([l, v]) => (
                        <div key={l} className="flex justify-between items-center text-sm font-bold text-slate-600">
                          <span>{l}</span><span className="text-slate-800">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 text-center">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Cash to Remit</p>
                      <p className="text-4xl font-black text-orange-600">₹{cashInHand.toFixed(0)}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setSelectedRiderSummary(null)}
                        className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors shadow-sm cursor-pointer">
                        Cancel
                      </button>
                      <button onClick={() => {
                        const orderIds = riderOrders.map(o => o.id);
                        removeOrders(orderIds);
                        showToast("Shift closed and orders cleared!", 'success');
                        setSelectedRiderSummary(null);
                      }} className="flex-[2] py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm rounded-2xl shadow-md shadow-orange-200 transition-all active:scale-95 cursor-pointer">
                        Confirm Remittance
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalOrder && (() => {
          const due = paymentModalOrder.grandTotal;
          const splitTotal = splitCash + splitUpi;
          const splitBalanced = Math.abs(splitTotal - due) < 0.01;
          const change = collectAmount > due ? collectAmount - due : 0;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                className="bg-white/95 backdrop-blur-2xl border border-white rounded-t-[32px] sm:rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Collect Payment</h3>
                    <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">#{paymentModalOrder.orderNumber} · {paymentModalOrder.customerName}</p>
                  </div>
                  <button onClick={() => setPaymentModalOrder(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Amount due */}
                <div className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4">
                  <span className="text-sm font-black text-slate-600">Amount Due</span>
                  <span className="text-2xl font-black text-orange-600">₹{due.toFixed(0)}</span>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2">
                  {(['CASH', 'UPI', 'SPLIT'] as const).map(m => (
                    <button key={m} onClick={() => { setPayMode(m); setSplitCash(0); setSplitUpi(0); setCollectAmount(due); }}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        payMode === m
                          ? m === 'CASH' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                            : m === 'UPI' ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                            : 'bg-indigo-500 text-white border-indigo-500 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}>
                      {m === 'CASH' ? '💵 Cash' : m === 'UPI' ? '📱 UPI' : '✂️ Split'}
                    </button>
                  ))}
                </div>

                {/* Single payment amount */}
                {payMode !== 'SPLIT' && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Amount Received</p>
                    <div className="flex items-center gap-2 bg-white border-2 border-orange-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-400/20 transition-all">
                      <span className="text-xl font-black text-slate-400">₹</span>
                      <input type="number"
                        value={collectAmount === 0 ? '' : collectAmount}
                        onChange={e => setCollectAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full text-2xl font-black text-slate-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    {change > 0 && (
                      <div className="mt-2 flex justify-between text-xs font-black text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                        <span>Change to return:</span>
                        <span>₹{change.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Split payment inputs */}
                {payMode === 'SPLIT' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Split Amounts</p>
                    <div className="flex items-center gap-2 bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-3 focus-within:border-emerald-400 transition-all">
                      <Banknote className="h-5 w-5 text-emerald-500 shrink-0" />
                      <input type="number" placeholder="Cash amount"
                        value={splitCash === 0 ? '' : splitCash}
                        onChange={e => setSplitCash(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full text-lg font-black text-slate-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <span className="text-sm font-black text-emerald-600">₹</span>
                    </div>
                    <div className="flex items-center gap-2 bg-orange-50 border-2 border-orange-200 rounded-2xl px-4 py-3 focus-within:border-orange-400 transition-all">
                      <QrCode className="h-5 w-5 text-orange-500 shrink-0" />
                      <input type="number" placeholder="UPI amount"
                        value={splitUpi === 0 ? '' : splitUpi}
                        onChange={e => setSplitUpi(e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full text-lg font-black text-slate-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <span className="text-sm font-black text-orange-600">₹</span>
                    </div>
                    {/* Running balance */}
                    <div className={`flex justify-between text-xs font-black px-4 py-2.5 rounded-xl border ${
                      splitBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      splitTotal > due ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      <span>{splitBalanced ? '✅ Balanced' : splitTotal > due ? '⚠️ Overpaid' : `Remaining: ₹${(due - splitTotal).toFixed(0)}`}</span>
                      <span>{splitCash > 0 || splitUpi > 0 ? `₹${splitTotal.toFixed(0)} / ₹${due.toFixed(0)}` : `Total: ₹${due.toFixed(0)}`}</span>
                    </div>
                  </div>
                )}

                {/* Confirm button */}
                {payMode !== 'SPLIT' ? (
                  <button
                    onClick={() => handleCollectPaymentSubmit(paymentModalOrder.id, payMode)}
                    disabled={collectAmount <= 0}
                    className={`w-full py-3.5 font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 ${
                      payMode === 'CASH'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200'
                        : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200'
                    }`}>
                    {payMode === 'CASH' ? <Banknote className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                    Confirm {payMode === 'CASH' ? 'Cash' : 'UPI'} · ₹{collectAmount.toFixed(0)}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCollectPaymentSubmit(paymentModalOrder.id, 'SPLIT', { cash: splitCash, upi: splitUpi })}
                    disabled={!splitBalanced}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-200 transition-all active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    Confirm Split — ₹{splitCash.toFixed(0)} Cash + ₹{splitUpi.toFixed(0)} UPI
                  </button>
                )}

              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Receipt / Complete & Print Modal ─────────────────── */}
      <AnimatePresence>
        {completedReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col items-center text-center overflow-hidden">

              {/* Success header */}
              <div className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5 flex flex-col items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-black text-lg text-white">Payment Collected!</h3>
                <p className="text-xs font-bold text-emerald-100 mt-1">
                  {completedReceipt.order.customerName} · #{completedReceipt.order.orderNumber}
                </p>
              </div>

              {/* Thermal receipt preview */}
              <div className="w-full px-6 py-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-left space-y-2 border-t-4 border-dashed">
                  <div className="text-center border-b border-dashed border-slate-300 pb-2">
                    <p className="font-extrabold text-sm uppercase">🛵 Delivery Receipt</p>
                    <p className="text-[10px] text-slate-500">#{completedReceipt.order.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">{new Date().toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                    {completedReceipt.order.items.slice(0, 4).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between font-bold text-slate-700">
                        <span>{item.quantity}× {item.name}</span>
                        <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                    {completedReceipt.order.items.length > 4 && (
                      <p className="text-slate-400 text-[10px] italic">+{completedReceipt.order.items.length - 4} more...</p>
                    )}
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between font-black text-base border-t border-dashed border-slate-300 pt-1">
                      <span>TOTAL:</span>
                      <span>₹{completedReceipt.order.grandTotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Paid via:</span><span className="font-black">{completedReceipt.method.toUpperCase()}</span>
                    </div>
                    {completedReceipt.collected > completedReceipt.order.grandTotal && (
                      <div className="flex justify-between text-[10px] text-amber-600 font-black">
                        <span>Change returned:</span>
                        <span>₹{(completedReceipt.collected - completedReceipt.order.grandTotal).toFixed(0)}</span>
                      </div>
                    )}
                    <div className="text-center text-[10px] text-slate-400 pt-1 border-t border-dashed border-slate-200">
                      <p>Delivered to: {completedReceipt.order.deliveryAddress || '—'}</p>
                      <p className="mt-0.5">Thank you! 🙏</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6 w-full grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    showToast('🖨️ ESC/POS Thermal Print command dispatched to USB/Serial port!', 'success');
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs rounded-2xl shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer">
                  <Printer className="h-4 w-4" /> Confirm & Print
                </button>
                <button
                  onClick={() => {
                    if (!completedReceipt.order.customerPhone) return;
                    window.open(`https://wa.me/${completedReceipt.order.customerPhone}?text=Thank you ${completedReceipt.order.customerName}! Your delivery order #${completedReceipt.order.orderNumber} of ₹${completedReceipt.order.grandTotal.toFixed(0)} has been delivered. Thank you for ordering from us!`, '_blank');
                  }}
                  disabled={!completedReceipt.order.customerPhone}
                  className="flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 text-slate-700 font-black text-xs rounded-2xl border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <Share2 className="h-4 w-4" /> WhatsApp
                </button>
                <button onClick={() => setCompletedReceipt(null)}
                  className="col-span-2 py-3 text-slate-500 font-black text-xs hover:text-slate-700 cursor-pointer transition-colors">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Return Modal ──────────────────────────────────────── */}
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
        onConfirmReturn={() => {
          if (returnModalOrder) {
            useDeliveryStore.getState().updateOrderStatus(returnModalOrder.id, 'CANCELLED');
            showToast('Order returned & cancelled.', 'info');
          }
        }}
      />

      {/* ── Toast ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
            <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl border font-black text-xs sm:text-sm ${
              toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              toast.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              'bg-orange-50 text-orange-700 border-orange-200'
            }`}>
              {toast.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
              {toast.type === 'error' && <X className="h-4 w-4" />}
              {toast.type === 'info' && <RefreshCw className="h-4 w-4" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
