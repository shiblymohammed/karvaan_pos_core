import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useAddonStore, type PaidAddon } from '../../store/useAddonStore';
import { useCartStore } from '../../store/cartStore';

interface StandaloneAddonModalProps {
  onClose: () => void;
}

export const StandaloneAddonModal: React.FC<StandaloneAddonModalProps> = ({ onClose }) => {
  const [selectedAddons, setSelectedAddons] = useState<PaidAddon[]>([]);
  const { getActiveAddons } = useAddonStore();
  const { addItem } = useCartStore();
  const activeAddons = getActiveAddons();

  const addAddon = (addon: PaidAddon) => setSelectedAddons(prev => [...prev, addon]);
  const removeAddon = (addonId: string) => {
    setSelectedAddons(prev => {
      const idx = prev.findIndex(a => a.id === addonId);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const handleAddToCart = () => {
    const grouped = selectedAddons.reduce<Record<string, PaidAddon & { qty: number }>>((acc, addon) => {
      if (!acc[addon.id]) acc[addon.id] = { ...addon, qty: 0 };
      acc[addon.id].qty += 1;
      return acc;
    }, {});

    Object.values(grouped).forEach(addon => {
      for (let i = 0; i < addon.qty; i++) {
        addItem({ id: `standalone-${addon.id}`, name: `+ ${addon.name}`, price: addon.price, category: 'ADD-ON' });
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="bg-pos-card rounded-3xl shadow-2xl border border-pos-border w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 relative z-10 flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-pos-border/50 flex items-center gap-3 bg-pos-bg/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-inner shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-pos-text text-lg leading-tight">Standalone Add-ons</h3>
            <p className="text-[11px] font-bold text-pos-text-muted">Add extras directly to cart</p>
          </div>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2">
            {activeAddons.map(addon => {
              const qty = selectedAddons.filter(a => a.id === addon.id).length;
              return (
                <div
                  key={addon.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                    qty > 0 ? 'bg-amber-50 border-amber-200' : 'bg-pos-bg border-pos-border hover:border-amber-200'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-sm font-bold truncate ${qty > 0 ? 'text-amber-700' : 'text-pos-text'}`}>{addon.name}</span>
                    <span className="text-xs font-black text-pos-text-muted">₹{addon.price}</span>
                  </div>

                  {qty === 0 ? (
                    <button
                      onClick={() => addAddon(addon)}
                      className="w-8 h-8 shrink-0 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center justify-center font-bold active:scale-95 transition-colors border border-amber-200/50"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-200 rounded-lg p-1 shrink-0 border border-amber-300">
                      <button onClick={() => removeAddon(addon.id)} className="w-6 h-6 rounded bg-white text-amber-800 flex items-center justify-center shadow-sm active:scale-95">
                        <Minus className="w-3 h-3 stroke-[3]" />
                      </button>
                      <span className="text-xs font-black text-amber-900 w-4 text-center">{qty}</span>
                      <button onClick={() => addAddon(addon)} className="w-6 h-6 rounded bg-white text-amber-800 flex items-center justify-center shadow-sm active:scale-95">
                        <Plus className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-pos-border bg-pos-bg/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-500 hover:text-slate-700 rounded-xl text-sm font-bold border border-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddToCart}
            disabled={selectedAddons.length === 0}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold rounded-xl text-sm shadow-md disabled:opacity-50 transition-all active:scale-95"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
