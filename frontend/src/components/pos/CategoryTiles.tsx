import React from 'react';
import * as Icons from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import { resolveMediaUrl } from '../../services/mediaUrl';
import { menuCategoryTiles } from '../../services/menuBrowse';

export const CategoryTiles = React.memo(function CategoryTiles({ onSelectCategory }: { onSelectCategory: (category: string) => void }) {
  const categories = useMenuStore(state => state.categories);
  const products = useMenuStore(state => state.products);
  const serverRevision = useMenuStore(state => state.serverRevision);
  const fetchMenu = useMenuStore(state => state.fetchMenu);
  const tiles = React.useMemo(() => menuCategoryTiles(categories, products), [categories, products]);
  if (serverRevision < 0) {
    return <div className="p-8 text-center space-y-4 text-slate-600">
      <p>Connect to the restaurant server to load the menu.</p>
      <button type="button" onClick={() => void fetchMenu()} className="rounded-xl bg-pos-accent px-4 py-2 font-bold text-white">Reload Menu</button>
    </div>;
  }
  if (!categories.length && !products.length) {
    return <p className="p-8 text-center text-slate-600">No categories or menu items yet. A manager can add them in Menu settings.</p>;
  }
  return <div className="overflow-y-auto pb-[240px] lg:pb-24 pr-2 pt-2">
    <h2 className="mb-4 text-lg font-bold text-slate-800">Choose a category</h2>
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
      {tiles.map(category => {
        const Icon = (Icons as any)[category.iconName || ''] || Icons.Utensils;
        return <button
          key={category.id}
          type="button"
          onClick={() => onSelectCategory(category.name)}
          className="flex min-h-[170px] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/70 text-left shadow-sm transition hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.98]"
        >
          <div className="flex h-28 w-full items-center justify-center overflow-hidden bg-violet-50 text-violet-600">
            {category.imageUrl
              ? <img src={resolveMediaUrl(category.imageUrl)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              : category.iconName ? <Icon className="h-10 w-10" />
              : <span className="text-4xl">{category.emoji || '🍽️'}</span>}
          </div>
          <div className="p-4">
            <span className="block break-words font-extrabold text-slate-800">{category.name}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">{category.itemCount} {category.itemCount === 1 ? 'item' : 'items'}</span>
          </div>
        </button>;
      })}
    </div>
  </div>;
});
