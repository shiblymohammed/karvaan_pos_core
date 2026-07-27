import React, { useState } from 'react';
import { QrCode, Utensils, CheckCircle2, ShoppingBag, Plus, Minus, Send, Sparkles, Smartphone, Bell, Coffee } from 'lucide-react';
import { useMenuStore } from '../store/useMenuStore';
import { useKdsStore } from '../store/useKdsStore';
import { useInventoryStore } from '../store/useInventoryStore';

export const QROrderScreen: React.FC = () => {
  const [cart, setCart] = useState<Array<{ id: string; name: string; price: number; qty: number; notes?: string }>>([]);
  const [tableNum, setTableNum] = useState('T3');
  const [orderSent, setOrderSent] = useState(false);
  const [lastOrderNum, setLastOrderNum] = useState('');
  const [waiterCalled, setWaiterCalled] = useState(false);

  const { products } = useMenuStore();
  const { checkIs86d } = useInventoryStore();
  const activeMenu = products.filter(p => p.isAvailable && !checkIs86d(p.name));

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    const orderNum = `QR-${Math.floor(100 + Math.random() * 900)}`;

    useKdsStore.getState().addTicket({
      id: `kot-${Date.now()}`,
      orderNumber: orderNum,
      tableNumber: tableNum,
      items: cart.map(i => ({ name: i.name, quantity: i.qty, notes: i.notes || '', status: 'COOKING' })),
      firedAt: new Date().toISOString()
    });

    setLastOrderNum(orderNum);
    setOrderSent(true);
    setCart([]);
  };

  const handleCallWaiter = () => {
    setWaiterCalled(true);
    alert(`🔔 Waiter alert triggered for Table ${tableNum}! Staff will attend to your table shortly.`);
    setTimeout(() => setWaiterCalled(false), 5000);
  };

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-pos-bg flex justify-center text-pos-text transition-colors duration-300">
      {/* Smartphone Mockup Frame */}
      <div className="w-full max-w-md bg-pos-sidebar rounded-[40px] border-8 border-pos-border shadow-2xl overflow-hidden flex flex-col min-h-[680px] transition-colors duration-300">
        {/* Phone Top Bar */}
        <div className="bg-gradient-to-r from-pos-accent to-teal-600 p-6 text-white text-center relative shrink-0">
          <div className="w-20 h-4 bg-black/30 rounded-full mx-auto mb-3"></div>
          <div className="inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-extrabold mb-2 backdrop-blur-sm">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Zero-Install PWA / QR Table Ordering</span>
          </div>
          <h2 className="text-xl font-black tracking-tight">Karvaan Digital Menu</h2>
          <p className="text-xs font-bold mt-0.5 opacity-90">Instant Contactless Table-to-Kitchen Ordering</p>

          <div className="mt-4 flex justify-center items-center gap-2 bg-black/30 backdrop-blur-md p-2 rounded-xl text-xs font-extrabold">
            <span>Seated at Dining Table:</span>
            <select
              value={tableNum}
              onChange={(e) => setTableNum(e.target.value)}
              className="bg-pos-sidebar text-pos-text font-black px-2 py-1 rounded border border-pos-border focus:outline-none shadow-2xs cursor-pointer"
            >
              {['T1', 'T2', 'T3', 'T4', 'T5', 'VIP-1', 'VIP-2'].map((t) => (
                <option key={t} value={t}>
                  Table {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Customer Assistance Bar */}
        <div className="bg-pos-card px-4 py-2.5 border-b border-pos-border flex items-center justify-between text-xs font-bold shrink-0 shadow-2xs">
          <span className="text-pos-text-muted flex items-center gap-1">
            <Coffee className="h-3.5 w-3.5 text-pos-accent" />
            <span>Need Table Service?</span>
          </span>
          <button
            onClick={handleCallWaiter}
            disabled={waiterCalled}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition-all shadow-2xs active:scale-95 ${
              waiterCalled
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                : 'bg-pos-bg hover:bg-pos-sidebar text-pos-text border border-pos-border'
            }`}
          >
            <Bell className={`h-3.5 w-3.5 ${waiterCalled ? 'animate-bounce text-emerald-500' : 'text-pos-accent'}`} />
            <span>{waiterCalled ? '✓ Waiter Notified!' : 'Call Waiter / Bill'}</span>
          </button>
        </div>

        {/* Menu Content Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-pos-bg">
          {orderSent ? (
            <div className="py-12 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-full flex items-center justify-center border border-emerald-300 dark:border-emerald-500/40">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="font-black text-lg text-pos-text">Order Fired to Kitchen!</h3>
              <p className="text-xs text-pos-text-muted px-6 font-medium leading-relaxed">
                Your ticket <strong className="text-emerald-600 dark:text-emerald-400">{lastOrderNum}</strong> has been routed directly to the Kitchen Display System (KDS) via WebSockets without waiter intervention!
              </p>
              <button
                onClick={() => setOrderSent(false)}
                className="mt-4 px-6 py-2.5 bg-pos-card hover:bg-pos-card-hover text-pos-text font-extrabold text-xs rounded-xl border border-pos-border transition-all shadow-sm active:scale-95"
              >
                Order More Items
              </button>
            </div>
          ) : (
            activeMenu.map((item) => (
              <div
                key={item.id}
                className="bg-pos-card p-4 rounded-2xl border border-pos-border flex justify-between items-center gap-3 shadow-2xs hover:border-pos-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-sm text-pos-text truncate">{item.name}</h4>
                  <p className="text-xs text-pos-text-muted mt-0.5 line-clamp-2 font-medium">{item.category}</p>
                  <span className="inline-block mt-2 font-black text-emerald-600 dark:text-emerald-400 text-sm">₹{item.price}</span>
                </div>

                <div>
                  <button
                    onClick={() => addToCart(item)}
                    className="px-3.5 py-2 bg-pos-bg hover:bg-gradient-to-r hover:from-pos-accent hover:to-teal-600 hover:text-white text-pos-text font-extrabold text-xs rounded-xl border border-pos-border transition-all shadow-2xs active:scale-95"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Cart Drawer */}
        {!orderSent && cart.length > 0 && (
          <div className="p-4 bg-pos-card border-t border-pos-border space-y-3 shrink-0 shadow-lg">
            <div className="flex justify-between items-center text-pos-text font-extrabold border-b border-pos-border pb-2">
              <span>Total Payable</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{total}</span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 py-1 my-2">
              {cart.map((i, idx) => (
                <div key={idx} className="flex justify-between text-xs text-pos-text-muted font-bold">
                  <span>{i.name}</span>
                  <span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">{i.qty}</span> x ₹{i.price}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleSendToKitchen}
              className="w-full py-3 bg-gradient-to-r from-pos-accent to-teal-600 hover:from-teal-500 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-glow-accent transition-all active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span>Fire Order to Kitchen KDS →</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
