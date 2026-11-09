import React, { useRef } from 'react';
import { Check, Plus } from 'lucide-react';
import type { ProductVariant } from '../../store/useMenuStore';
import './variant-picker.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatVariantPrice = (price: number) => currency.format(price);

interface VariantOptionsProps {
  variants: ProductVariant[];
  selectedId?: string;
  instantAdd?: boolean;
  onSelect: (variant: ProductVariant) => void;
}

export function VariantOptions({ variants, selectedId, instantAdd = false, onSelect }: VariantOptionsProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  return <div className="pos-variant-container">
    <div ref={gridRef} className="pos-variant-options" role={instantAdd ? 'group' : 'radiogroup'} aria-label={instantAdd ? 'Tap a variant to add' : 'Choose a variant'}>
      {variants.map((variant, index) => {
        const selected = variant.id === selectedId;
        return <button
          key={variant.id}
          type="button"
          data-variant-option
          role={instantAdd ? undefined : 'radio'}
          aria-checked={instantAdd ? undefined : selected}
          tabIndex={instantAdd || selected || (!selectedId && index === 0) ? 0 : -1}
          className={`pos-variant-option ${selected ? 'is-selected' : ''}`}
          onClick={() => onSelect(variant)}
          onKeyDown={event => {
            const buttons = Array.from(gridRef.current!.querySelectorAll<HTMLButtonElement>('[data-variant-option]'));
            const columns = getComputedStyle(gridRef.current!).gridTemplateColumns.split(' ').length;
            let next = index;
            if (event.key === 'ArrowRight') next++;
            else if (event.key === 'ArrowLeft') next--;
            else if (event.key === 'ArrowDown') next += columns;
            else if (event.key === 'ArrowUp') next -= columns;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = buttons.length - 1;
            else return;
            event.preventDefault();
            event.stopPropagation();
            next = (next + buttons.length) % buttons.length;
            buttons[next].focus();
            if (!instantAdd) onSelect(variants[next]);
          }}
        >
          <span className="pos-variant-name">{variant.name}</span>
          <span className="pos-variant-price">{formatVariantPrice(variant.price)}</span>
          <span className="pos-variant-mark" aria-hidden="true">{instantAdd ? <Plus size={18} /> : selected ? <Check size={18} /> : null}</span>
        </button>;
      })}
    </div>
  </div>;
}
