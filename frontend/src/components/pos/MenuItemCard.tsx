import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveMediaUrl } from '../../services/mediaUrl';
import { Clock, MessageSquare, Plus } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Product } from '../../store/useMenuStore';
import { toast } from '../../store/useToastStore';

interface MenuItemCardProps {
  product: Product;
  is86d: boolean;
  isInCart?: boolean;
  onAdd: (product: any) => void;
  onCustomize: (product: any) => void;
  layout?: 'grid' | 'list';
  comboLabel?: string;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = React.memo(({
  product,
  is86d,
  isInCart = false,
  onAdd,
  onCustomize,
  layout = 'grid',
  comboLabel,
}) => {
  const [isVibrating, setIsVibrating] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const hasVariants = !!(product.variants && product.variants.length > 0);
  const isList = layout === 'list';

  const handleClick = () => {
    if (is86d) toast.warning('Recorded stock is short. Manager approval will be required at checkout.');
    setIsVibrating(true);
    setTimeout(() => setIsVibrating(false), 200);

    if (hasVariants) {
      setShowVariantModal(true);
      return;
    }

    onAdd(product);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Add ${product.name}`}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleClick();
        }
      }}
      className={`pos-product-card ${isList ? 'is-list' : 'is-grid'} ${isVibrating ? 'animate-shake' : ''} ${is86d ? 'is-short' : ''} ${isInCart ? 'is-in-cart' : ''}`}
    >
      <div className="pos-product-image">
        {product.imageUrl ? (
          <img src={resolveMediaUrl(product.imageUrl)} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">
            {product.iconName ? React.createElement((Icons as any)[product.iconName] || Icons.Utensils, { className: 'h-9 w-9' }) : (product.imageEmoji || '🍽️')}
          </div>
        )}
      </div>
      <div className="pos-product-description">
        <h3 className="line-clamp-2 break-words text-sm font-bold leading-snug text-slate-800">{product.name}</h3>
        {product.isCombo && comboLabel && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{comboLabel}</p>}
        <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${is86d ? 'text-red-700' : 'text-slate-500'}`}>
          {is86d ? 'Stock shortage' : <><Clock className="h-3 w-3" /> {product.prepTime} min</>}
        </span>
      </div>
      <div className="pos-product-price">
        <span className="font-extrabold text-slate-900 tracking-tight">
          {hasVariants ? `₹${Math.min(...product.variants!.map(v => v.price))}` : `₹${product.price}`}
        </span>
        {hasVariants && <span className="text-[10px] font-semibold text-slate-500">From · {product.variants!.length} sizes</span>}
      </div>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          if (hasVariants) setShowVariantModal(true);
          else onCustomize(product);
        }}
        className="pos-product-action"
        aria-label={hasVariants ? `Choose size for ${product.name}` : `Customize ${product.name}`}
        title={hasVariants ? 'Select Size / Variant' : 'Customize / Add'}
      >
        {isInCart ? <Icons.Check className="h-5 w-5 text-emerald-700" /> : <Plus className="h-5 w-5" />}
      </button>

      {/* Quick Variant Picker Dialog */}
      {showVariantModal && createPortal(
        <div
          onClick={(e) => { e.stopPropagation(); setShowVariantModal(false); }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 backdrop-blur-xl w-full max-w-sm rounded-[28px] border border-white shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  {product.iconName ? React.createElement((Icons as any)[product.iconName] || Icons.Utensils, { className: 'w-5 h-5' }) : (product.imageEmoji || '🍽️')}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-sm leading-tight">{product.name}</h4>
                  <p className="text-[11px] font-bold text-slate-400">Choose portion / size</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVariantModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-60 overflow-y-auto pr-0.5">
              {product.variants!.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    onAdd({
                      ...product,
                      price: variant.price,
                      variantId: variant.id,
                      variantName: variant.name,
                    });
                    setShowVariantModal(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-[#b5ef85]/20 border border-slate-200 hover:border-[#b5ef85] rounded-2xl transition-all active:scale-[0.98] cursor-pointer group shadow-sm"
                >
                  <span className="font-black text-slate-800 text-sm group-hover:text-slate-950">
                    {variant.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-600 text-base">
                      ₹{variant.price}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowVariantModal(false);
                  onCustomize(product);
                }}
                className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Customize with Notes
              </button>
              <button
                type="button"
                onClick={() => setShowVariantModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
