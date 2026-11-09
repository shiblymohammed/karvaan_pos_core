import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { OptionDialog } from './OptionDialog';
import { VariantOptions, formatVariantPrice } from './VariantOptions';
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
      return product.variants.find(v => v.id === product.variantId) || product.variants[0];
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
    <OptionDialog
      title={`Customize: ${product.name}`}
      subtitle="Choose your option, notes and add-ons"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="pos-option-secondary">Cancel</button>
        <button type="button" onClick={handleConfirm} className="pos-option-primary">
          Add to bill · {formatVariantPrice(currentPrice + addonsTotal)}
        </button>
      </>}
    >
      {product.variants && product.variants.length > 0 && (
        <section className="pos-variant-section" aria-label="Size or portion">
          <h3>Size / portion</h3>
          <VariantOptions variants={product.variants} selectedId={selectedVariant?.id} onSelect={setSelectedVariant} />
        </section>
      )}

        {/* Notes Section */}
        <div>
          <label className="text-sm font-bold text-slate-600 mb-2 block" htmlFor="custom-item-note">Custom note</label>
          <input
            id="custom-item-note"
            type="text"
            placeholder="e.g. Less spicy, Extra cheese, No onions..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-pos-accent focus:ring-1 focus:ring-pos-accent font-bold shadow-inner transition-shadow"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {predefinedNotes.map(preset => (
              <button
                key={preset.id}
                onClick={() => setNoteText(prev => prev ? `${prev}, ${preset.label}` : preset.label)}
                className="min-h-9 px-2.5 py-1 bg-slate-50 hover:bg-pos-accent/10 text-xs font-bold text-slate-600 hover:text-emerald-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <span>{preset.icon}</span> <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Paid Add-ons Section */}
        {activeAddons.length > 0 && (
          <div className="pt-3 border-t border-slate-200/50">
            <label className="text-xs font-bold text-slate-500 mb-2 block">Paid Add-ons</label>
            <div className="grid grid-cols-1 gap-2">
              {activeAddons.map(addon => {
                const qty = selectedAddons.filter(a => a.id === addon.id).length;
                return (
                  <div
                    key={addon.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl border transition-all ${
                      qty > 0 ? 'bg-pos-accent/10 border-pos-accent/50' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`text-sm font-bold break-words ${qty > 0 ? 'text-emerald-500' : 'text-slate-800'}`}>{addon.name}</span>
                      <span className="text-xs font-semibold text-slate-500">+{formatVariantPrice(addon.price)}</span>
                    </div>

                    {qty === 0 ? (
                      <button
                        type="button"
                        aria-label={`Add ${addon.name}`}
                        onClick={() => addAddon(addon)}
                        className="w-11 h-11 shrink-0 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center font-bold active:scale-95 transition-colors border border-emerald-100"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-emerald-100 rounded-lg shrink-0 border border-emerald-200">
                        <button type="button" aria-label={`Remove ${addon.name}`} onClick={() => removeAddon(addon.id)} className="w-11 h-11 rounded-lg bg-white text-emerald-700 flex items-center justify-center active:scale-95">
                          <Minus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <span className="text-sm font-bold text-emerald-800 min-w-3 text-center">{qty}</span>
                        <button type="button" aria-label={`Add ${addon.name}`} onClick={() => addAddon(addon)} className="w-11 h-11 rounded-lg bg-white text-emerald-700 flex items-center justify-center active:scale-95">
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

    </OptionDialog>
  );
};
