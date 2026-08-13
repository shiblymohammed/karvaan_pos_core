import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useMenuStore, Product } from '../../store/useMenuStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useCartStore } from '../../store/cartStore';
import { MenuItemCard } from './MenuItemCard';

interface MenuGridProps {
  activeCategory: string;
  searchQuery: string;
  onCustomize: (item: Product) => void;
}

export const MenuGrid: React.FC<MenuGridProps> = ({ activeCategory, searchQuery, onCustomize }) => {
  
  const { products } = useMenuStore();
  const { checkIs86d } = useInventoryStore();
  const { addItem, items } = useCartStore();

  const filteredProducts = products.filter((p) => {
    if (!p.isAvailable) return false;
    const matchesCat = activeCategory === 'All' 
      ? true 
      : p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Product Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 overflow-y-auto pb-24 pr-2 pt-2">
        {filteredProducts.map((product) => {
          const is86d = checkIs86d(product.name);
          const isInCart = items.some(item => item.productId === product.id);
          return (
            <MenuItemCard
              key={product.id}
              product={product}
              is86d={is86d}
              isInCart={isInCart}
              onAdd={addItem}
              onCustomize={onCustomize}
            />
          );
        })}
      </div>
    </div>
  );
};
