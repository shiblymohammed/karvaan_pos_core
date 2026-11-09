import React, { useRef, useState } from 'react';
import { resolveMediaUrl } from '../../services/mediaUrl';
import { Clock, MessageSquare, Plus } from 'lucide-react';
import * as Icons from 'lucide-react';
import { Product } from '../../store/useMenuStore';
import { toast } from '../../store/useToastStore';
import { OptionDialog } from './OptionDialog';
import { VariantOptions } from './VariantOptions';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const [variantTrigger, setVariantTrigger] = useState<HTMLElement | null>(null);
  const hasVariants = !!(product.variants && product.variants.length > 0);
  const isList = layout === 'list';

  const handleClick = (event: React.SyntheticEvent<HTMLElement>) => {
    if (is86d) toast.warning('Recorded stock is short. Manager approval will be required at checkout.');
    setIsVibrating(true);
    setTimeout(() => setIsVibrating(false), 200);

    if (hasVariants) {
      setVariantTrigger(event.currentTarget);
      return;
    }

    onAdd(product);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      aria-haspopup={hasVariants ? 'dialog' : undefined}
      aria-expanded={hasVariants ? !!variantTrigger : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Add ${product.name}`}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleClick(event);
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
          if (hasVariants) setVariantTrigger(e.currentTarget);
          else onCustomize(product);
        }}
        className="pos-product-action"
        aria-label={hasVariants ? `Choose size for ${product.name}` : `Customize ${product.name}`}
        title={hasVariants ? 'Select Size / Variant' : 'Customize / Add'}
      >
        {isInCart ? <Icons.Check className="h-5 w-5 text-emerald-700" /> : <Plus className="h-5 w-5" />}
      </button>

      {variantTrigger && <OptionDialog
        title={product.name}
        subtitle="Choose an option · Tap to add to bill"
        anchor={cardRef.current}
        returnFocus={variantTrigger}
        onClose={() => setVariantTrigger(null)}
        footer={<button
          type="button"
          className="pos-option-secondary flex items-center justify-center gap-2 w-full"
          onClick={() => { setVariantTrigger(null); onCustomize(product); }}
        ><MessageSquare size={16} /> Notes &amp; add-ons</button>}
      >
        <VariantOptions variants={product.variants!} instantAdd onSelect={variant => {
          onAdd({ ...product, price: variant.price, variantId: variant.id, variantName: variant.name });
          setVariantTrigger(null);
        }} />
      </OptionDialog>}
    </div>
  );
});
