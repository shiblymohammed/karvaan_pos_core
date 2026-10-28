import React, { useState } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { useAddonStore, type PaidAddon } from '../../store/useAddonStore';
import { useSettingsStore } from '../../store/useSettingsStore';

import { ProductVariant } from '../../store/useMenuStore';

interface CustomizeItemModalProps {
  product: { id: string; name: string; price: number; variants?: ProductVariant[]; variantId?: string; variantName?: string };
  onConfirm: (note: string, addons: PaidAddon[], selectedVariant?: ProductVariant) => void;
  onClose: () => void;
}

export const CustomizeItemModal: React.FC<CustomizeItemModalProps> = ({ product, onConfirm, onClose }) => {
  const [noteText, setNoteText] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<PaidAddon[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(() => {
    if (product.variantId && product.variants) {
      return product.variants.find(v => v.id === product.variantId);
    }
    return product.variants && product.variants.length > 0 ? product.variants[0] : undefined;
  });
  const { notes: predefinedNotes } = useSettingsStore();
  const { getActiveAddons } = useAddonStore();
  const activeAddons = getActiveAddons();

  const handleConfirm = () => {
    onConfirm(noteText, selectedAddons, selectedVariant);
  };

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

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-card w-full max-w-md rounded-2xl border border-pos-border p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-pos-text text-base">Customize: {product.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variant / Size Selection */}
        {product.variants && product.variants.length > 0 && (
          <div className="p-3 bg-pos-bg/80 rounded-xl border border-pos-border/70">
            <label className="text-xs font-bold text-pos-text-muted mb-2 block uppercase tracking-wider">
              Select Size / Portion
            </label>
            <div className="grid grid-cols-2 gap-2">
              {product.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-pos-card border-pos-border hover:border-slate-300'
                    }`}
                  >
                    <div className={`text-xs font-black truncate ${isSelected ? 'text-emerald-600' : 'text-pos-text'}`}>
                      {v.name}
                    </div>
                    <div className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                      ₹{v.price}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                const qty = selectedAddons.filter(a => a.id === addon.id).length;
                return (
                  <div
                    key={addon.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl border transition-all ${
                      qty > 0 ? 'bg-pos-accent/10 border-pos-accent/50' : 'bg-pos-bg border-pos-border'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`text-xs font-bold truncate ${qty > 0 ? 'text-emerald-500' : 'text-pos-text'}`}>{addon.name}</span>
                      <span className="text-[10px] font-black text-pos-text-muted">+₹{addon.price}</span>
                    </div>

                    {qty === 0 ? (
                      <button
                        onClick={() => addAddon(addon)}
                        className="w-7 h-7 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center font-bold active:scale-95 transition-colors border border-emerald-100"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-emerald-100 rounded-lg p-1 shrink-0 border border-emerald-200">
                        <button onClick={() => removeAddon(addon.id)} className="w-5 h-5 rounded bg-white text-emerald-700 flex items-center justify-center shadow-sm active:scale-95">
                          <Minus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <span className="text-[11px] font-black text-emerald-800 w-3 text-center">{qty}</span>
                        <button onClick={() => addAddon(addon)} className="w-5 h-5 rounded bg-white text-emerald-700 flex items-center justify-center shadow-sm active:scale-95">
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-pos-border/50 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-pos-bg text-pos-text-muted hover:text-pos-text hover:bg-pos-card rounded-xl text-sm font-bold border border-pos-border transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold rounded-xl text-sm shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-transform active:scale-95 cursor-pointer"
          >
            Add to Cart • ₹{(currentPrice + addonsTotal).toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
};
