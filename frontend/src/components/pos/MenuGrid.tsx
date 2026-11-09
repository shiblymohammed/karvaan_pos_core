import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useMenuStore, Product } from '../../store/useMenuStore';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useCartStore } from '../../store/cartStore';
import { MenuItemCard } from './MenuItemCard';
import { createMenuStockLookup, filterMenuProducts } from '../../services/menuBrowse';

interface MenuGridProps {
  activeCategory: string;
  searchQuery: string;
  onCustomize: (item: Product) => void;
  layout?: 'grid' | 'list';
}

export const MenuGrid: React.FC<MenuGridProps> = React.memo(({ activeCategory, searchQuery, onCustomize, layout = 'grid' }) => {
  
  const products = useMenuStore(state => state.products);
  const serverRevision = useMenuStore(state => state.serverRevision);
  const fetchMenu = useMenuStore(state => state.fetchMenu);
  const recipes = useInventoryStore(state => state.recipes);
  const ingredients = useInventoryStore(state => state.ingredients);
  const addItem = useCartStore(state => state.addItem);
  const items = useCartStore(state => state.items);

  const filteredProducts = useMemo(() => filterMenuProducts(products, activeCategory, searchQuery), [products, activeCategory, searchQuery]);
  const checkIs86d = useMemo(() => createMenuStockLookup(recipes, ingredients), [recipes, ingredients]);
  const cartProductIds = useMemo(() => new Set(items.map(item => item.productId)), [items]);
  const comboLabels = useMemo(() => {
    const names = new Map(products.map(product => [product.id, product.name]));
    return new Map(products.filter(product => product.isCombo).map(product => {
      const counts = new Map<string, number>();
      for (const id of product.comboItems || []) {
        const name = names.get(id);
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      }
      return [product.id, [...counts].map(([name, count]) => `${count}x ${name}`).join(' • ')];
    }));
  }, [products]);

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-4 overflow-hidden">
      {/* Product Grid */}
      {filteredProducts.length === 0 && (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {serverRevision < 0
              ? 'Connect to the restaurant server to load the menu.'
              : searchQuery
              ? 'No menu items match this search.'
              : 'No available items in this category. A manager can update the menu.'}
          </p>
          {serverRevision < 0 && (
            <button
              type="button"
              onClick={() => void fetchMenu()}
              className="px-4 py-2 bg-pos-accent text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload Menu
            </button>
          )}
        </div>
      )}
      <div className="pos-menu-scroll">
      <div className={`pos-menu-workspace ${layout === 'list' ? 'pos-product-list' : 'pos-product-grid'}`}>
        {filteredProducts.map((product) => {
          const is86d = checkIs86d(product.name);
          const isInCart = cartProductIds.has(product.id);
          return (
            <MenuItemCard
              key={product.id}
              product={product}
              is86d={is86d}
              isInCart={isInCart}
              onAdd={addItem}
              onCustomize={onCustomize}
              layout={layout}
              comboLabel={comboLabels.get(product.id)}
            />
          );
        })}
      </div>
      </div>
    </div>
  );
});
