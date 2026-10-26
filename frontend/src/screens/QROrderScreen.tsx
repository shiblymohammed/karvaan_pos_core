import React, { useState } from 'react';
import { resolveMediaUrl } from '../services/mediaUrl';
import { useMenuStore } from '../store/useMenuStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { Smartphone, Plus, Minus, Info } from 'lucide-react';

// This route is inside the authenticated staff app. Customer table sessions and
// acknowledged service requests must exist before it can accept guest orders.
export const QROrderScreen: React.FC = () => {
  const products = useMenuStore(state => state.products);
  const { checkIs86d } = useInventoryStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const available = products.filter(product => product.isAvailable && !product.isArchived && !checkIs86d(product.id));
  const total = available.reduce((sum, product) => sum + product.price * (quantities[product.id] || 0), 0);
  const change = (id: string, delta: number) => setQuantities(current => ({ ...current, [id]: Math.max(0, (current[id] || 0) + delta) }));
  return <div className="p-4 sm:p-6 h-full overflow-auto bg-pos-bg text-pos-text flex justify-center">
    <div className="w-full max-w-lg space-y-4">
      <header className="rounded-3xl bg-pos-card border border-pos-border p-5 space-y-2">
        <h1 className="text-xl font-bold flex items-center gap-2"><Smartphone className="w-5 h-5" /> QR Menu Preview</h1>
        <p className="text-sm text-pos-text-muted">Preview your restaurant’s customer menu.</p>
        <div className="rounded-xl bg-amber-100 text-amber-950 p-3 text-sm flex gap-2"><Info className="w-5 h-5 shrink-0" /><p>Customer ordering and digital waiter requests are not enabled. Staff should use POS Billing to place an order.</p></div>
      </header>
      {available.length === 0 && <p className="p-5 rounded-xl bg-pos-card">No available menu items. Load the restaurant menu or update item availability.</p>}
      {available.map(product => <div key={product.id} className="bg-pos-card rounded-2xl border border-pos-border p-4 flex gap-3 items-center">
        {product.imageUrl && <img src={resolveMediaUrl(product.imageUrl)} alt="" className="w-16 h-16 rounded-xl object-cover" />}
        <div className="flex-1 min-w-0"><h2 className="font-bold">{product.name}</h2><p className="text-xs text-pos-text-muted">{product.category}</p><p className="font-bold mt-1">₹{product.price.toFixed(2)}</p></div>
        <div className="flex items-center gap-2"><button aria-label={`Remove one ${product.name}`} disabled={!quantities[product.id]} onClick={() => change(product.id, -1)} className="p-2 rounded-lg border border-pos-border disabled:opacity-30"><Minus className="w-4 h-4" /></button><span>{quantities[product.id] || 0}</span><button aria-label={`Add one ${product.name}`} onClick={() => change(product.id, 1)} className="p-2 rounded-lg bg-pos-accent text-white"><Plus className="w-4 h-4" /></button></div>
      </div>)}
      <div className="rounded-2xl bg-pos-card border border-pos-border p-4 space-y-3"><p className="flex justify-between font-bold"><span>Preview subtotal</span><span>₹{total.toFixed(2)}</span></p><p className="text-xs text-pos-text-muted">Taxes and applicable charges are calculated in POS Billing.</p><button disabled className="w-full rounded-xl p-3 bg-pos-border text-pos-text-muted">Customer ordering is not enabled</button></div>
    </div>
  </div>;
};
