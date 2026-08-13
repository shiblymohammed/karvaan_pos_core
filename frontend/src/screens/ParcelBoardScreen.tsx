import React, { useState, useEffect } from 'react';
import { useDeliveryStore, DeliveryOrder, DeliveryStatus } from '../store/useDeliveryStore';
import { Package, Phone, Clock, ChefHat, CheckCircle2, XCircle, User, Search, Bell } from 'lucide-react';

const STATUS_FLOW: DeliveryStatus[] = ['RECEIVED', 'PREPARING', 'READY', 'CANCELLED'];

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  RECEIVED: { label: 'Received', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Bell className="h-3 w-3" /> },
  PREPARING: { label: 'Preparing', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <ChefHat className="h-3 w-3" /> },
  READY: { label: 'Ready for Pickup', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: null },
  DELIVERED: { label: 'Delivered', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: null },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="h-3 w-3" /> },
};

const ParcelCard: React.FC<{ order: DeliveryOrder; onAdvance: () => void; onCancel: () => void; onSettle: () => void }> = ({ order, onAdvance, onCancel, onSettle }) => {
  const [elapsed, setElapsed] = useState(0);
  const cfg = STATUS_CONFIG[order.status];

  useEffect(() => {
    const placed = new Date(order.updatedAt).getTime();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - placed) / 60000)), 10000);
    setElapsed(Math.floor((Date.now() - placed) / 60000));
    return () => clearInterval(tick);
  }, [order.updatedAt]);

  const canAdvance = order.status === 'RECEIVED' || order.status === 'PREPARING';
  const isReady = order.status === 'READY';

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-4 shadow-sm flex flex-col gap-3 transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-pos-text-muted">{order.orderNumber}</span>
          <h3 className="font-black text-pos-text text-base leading-tight">{order.customerName}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-3 text-xs text-pos-text-muted">
        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {order.customerPhone}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {order.placedAt}</span>
        {elapsed > 0 && <span className={`font-bold ${elapsed > 15 ? 'text-red-500' : elapsed > 8 ? 'text-amber-500' : 'text-emerald-500'}`}>{elapsed}m ago</span>}
      </div>

      {/* Items */}
      <div className="bg-pos-bg/50 rounded-xl p-2.5 border border-pos-border/50">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs py-0.5">
            <span className="font-bold text-pos-text">{item.quantity}× {item.name}</span>
            <span className="text-pos-text-muted">₹{(item.price * item.quantity).toFixed(0)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-black text-pos-text border-t border-pos-border mt-1.5 pt-1.5">
          <span>Total</span>
          <span className="text-emerald-600">₹{order.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {canAdvance && (
          <button onClick={onAdvance} className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm">
            {order.status === 'RECEIVED' ? '▶ Start Preparing' : '✓ Mark Ready'}
          </button>
        )}
        {isReady && (
          <button onClick={onSettle} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm animate-pulse">
            🎉 Picked Up / Close
          </button>
        )}
        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
          <button onClick={onCancel} className="py-2 px-3 bg-pos-card hover:bg-red-50 text-red-500 text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer border border-red-200 shadow-sm">
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export const ParcelBoardScreen: React.FC = () => {
  const { orders, updateOrderStatus, removeOrder } = useDeliveryStore();
  const [search, setSearch] = useState('');

  const parcelOrders = orders
    .filter(o => o.orderType === 'PARCEL')
    .filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
    .filter(o => !search || o.customerName.toLowerCase().includes(search.toLowerCase()) || o.orderNumber.toLowerCase().includes(search.toLowerCase()));

  const received = parcelOrders.filter(o => o.status === 'RECEIVED');
  const preparing = parcelOrders.filter(o => o.status === 'PREPARING');
  const ready = parcelOrders.filter(o => o.status === 'READY');

  const handleAdvance = (order: DeliveryOrder) => {
    if (order.status === 'RECEIVED') updateOrderStatus(order.id, 'PREPARING');
    else if (order.status === 'PREPARING') updateOrderStatus(order.id, 'READY');
  };

  return (
    <div className="h-[calc(100vh-64px)] bg-pos-bg overflow-hidden flex flex-col text-pos-text">
      {/* Header */}
      <div className="bg-pos-sidebar border-b border-pos-border px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-pos-text flex items-center gap-2"><Package className="h-6 w-6 text-amber-500" /> Parcel Board</h1>
          <p className="text-xs font-bold text-pos-text-muted">{parcelOrders.length} active parcel orders</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="pl-9 pr-4 py-2 bg-pos-card border border-pos-border rounded-xl text-sm font-bold placeholder:text-pos-text-muted focus:outline-none focus:border-pos-accent" />
        </div>
      </div>

      {/* Pipeline Columns */}
      <div className="flex-1 overflow-auto p-6">
        {parcelOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-pos-text-muted">
            <Package className="h-16 w-16 opacity-20" />
            <p className="text-lg font-black">No active parcel orders</p>
            <p className="text-sm">New parcel orders will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Received Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h2 className="font-black text-sm text-pos-text uppercase tracking-wide">Received</h2>
                <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{received.length}</span>
              </div>
              <div className="space-y-3">
                {received.map(o => (
                  <ParcelCard key={o.id} order={o} onAdvance={() => handleAdvance(o)} onCancel={() => updateOrderStatus(o.id, 'CANCELLED')} onSettle={() => removeOrder(o.id)} />
                ))}
              </div>
            </div>

            {/* Preparing Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="font-black text-sm text-pos-text uppercase tracking-wide">Preparing</h2>
                <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{preparing.length}</span>
              </div>
              <div className="space-y-3">
                {preparing.map(o => (
                  <ParcelCard key={o.id} order={o} onAdvance={() => handleAdvance(o)} onCancel={() => updateOrderStatus(o.id, 'CANCELLED')} onSettle={() => removeOrder(o.id)} />
                ))}
              </div>
            </div>

            {/* Ready Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="font-black text-sm text-pos-text uppercase tracking-wide">Ready for Pickup</h2>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{ready.length}</span>
              </div>
              <div className="space-y-3">
                {ready.map(o => (
                  <ParcelCard key={o.id} order={o} onAdvance={() => handleAdvance(o)} onCancel={() => updateOrderStatus(o.id, 'CANCELLED')} onSettle={() => removeOrder(o.id)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
