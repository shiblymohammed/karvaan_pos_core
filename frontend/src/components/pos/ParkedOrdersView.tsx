import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Utensils } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';

interface ParkedOrdersViewProps {
  onClose: () => void;
}

export const ParkedOrdersView: React.FC<ParkedOrdersViewProps> = ({ onClose }) => {
  const { heldOrders, resumeOrder } = useCartStore();

  if (heldOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-60">
        <Clock className="w-16 h-16 text-slate-400 mb-4" />
        <h3 className="text-xl font-bold text-slate-700">No parked orders</h3>
        <p className="text-slate-500">Orders you hold will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {heldOrders.map((order) => (
        <div key={order.id} className="bg-white/80 backdrop-blur-md p-3 md:p-4 rounded-2xl shadow-sm border border-white/60 flex flex-col gap-2 hover:shadow-lg hover:border-white transition-all group overflow-hidden">
          <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap mb-0.5">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 text-base leading-tight truncate">{order.name}</h4>
              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                <span className="text-[10px] text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded-full flex items-center shadow-sm shrink-0">
                  <Clock className="w-3 h-3 mr-1" />
                  {order.timestamp.includes('T') ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : order.timestamp}
                </span>
                {order.orderType && (
                  <span className="text-[9px] text-blue-700 font-black bg-blue-50/80 px-1.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider shrink-0">
                    {order.orderType.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            <span className="bg-[#b5ef85] text-slate-900 text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm shrink-0">
              {order.items.length} items
            </span>
          </div>

          {/* Meta info */}
          {(order.tableName || order.waiterName || order.customerName) && (
            <div className="flex flex-wrap gap-1.5 py-1.5 border-y border-slate-100/80">
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
                  Customer: <span className="text-slate-800 truncate max-w-[100px] inline-block align-bottom">{order.customerName}</span>
                </span>
              )}
            </div>
          )}

          {/* Items List */}
          <div className="flex flex-col gap-1 mt-0.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-start text-[11px] bg-slate-50/80 border border-slate-100/50 p-1.5 rounded-lg gap-1">
                <span className="text-slate-700 font-bold w-5 shrink-0">{item.quantity}x</span>
                <span className="text-slate-600 font-semibold flex-1 leading-tight break-words">{item.name}</span>
                <span className="text-slate-500 font-bold shrink-0">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              resumeOrder(order.id);
              onClose();
            }}
            className="mt-auto w-full bg-[#0d212b] text-[#b5ef85] text-sm font-bold py-2 rounded-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md group-hover:shadow-lg"
          >
            <Utensils className="w-3.5 h-3.5" />
            Resume Order
          </button>
        </div>
      ))}
    </div>
  );
};
