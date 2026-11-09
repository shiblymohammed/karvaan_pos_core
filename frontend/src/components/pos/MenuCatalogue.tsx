import React from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { CategorySidebar } from './CategorySidebar';
import { MenuGrid } from './MenuGrid';
import { CategoryTiles } from './CategoryTiles';
import { useSettingsStore } from '../../store/useSettingsStore';
import './menu-catalogue.css';

interface MenuCatalogueProps {
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSearchExpanded: boolean;
  onSearchExpand: () => void;
  onSearchClose: () => void;
  onOpenAddonModal: () => void;
  onCustomize: (product: any) => void;
}

export const MenuCatalogue: React.FC<MenuCatalogueProps> = React.memo(({
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  isSearchExpanded,
  onSearchExpand,
  onSearchClose,
  onOpenAddonModal,
  onCustomize,
}) => {
  const categoryFirst = useSettingsStore(state => state.posMenuLayout === 'CATEGORY_LIST');
  const showCategories = categoryFirst && activeCategory === 'All' && !searchQuery.trim();
  React.useEffect(() => {
    if (categoryFirst) {
      onSelectCategory('All');
      onSearchChange('');
    }
  }, [categoryFirst, onSelectCategory, onSearchChange]);
  const openCategories = () => {
    onSearchChange('');
    onSelectCategory('All');
  };
  return (
    <div className="pos-catalogue flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-300 pt-10 md:pt-14">
      {/* Unified Top Bar: Categories + Search */}
      <div className="pos-menu-toolbar">
        <div className="pos-menu-navigation min-w-0 flex-1 overflow-hidden">
          {categoryFirst
            ? <div className="flex min-h-[44px] items-center gap-3">
                {showCategories
                  ? <span className="px-3 font-bold text-slate-800">Categories</span>
                  : <>
                      <button type="button" onClick={openCategories} className="flex shrink-0 items-center gap-1 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500">
                        <ArrowLeft className="h-4 w-4" /> Categories
                      </button>
                      <span className="truncate text-sm font-bold text-slate-700">{activeCategory === 'All' ? 'Search results' : activeCategory}</span>
                    </>}
              </div>
            : <CategorySidebar activeCategory={activeCategory} onSelectCategory={onSelectCategory} />}
        </div>

        <div className={`pos-menu-tools ${isSearchExpanded ? 'is-searching' : ''}`}>
          <button
            onClick={onOpenAddonModal}
            className="px-2.5 md:px-3 h-[34px] md:h-[44px] bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold border border-amber-200 rounded-xl shadow-sm flex items-center justify-center transition-all active:scale-95 text-[11px] md:text-xs whitespace-nowrap"
          >
            + Add-on
          </button>

          {isSearchExpanded ? (
            <div className="pos-menu-search relative min-w-0 animate-in slide-in-from-right-8 duration-300">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                aria-label="Search menu"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-9 py-1.5 md:py-2 bg-white/90 backdrop-blur-2xl border border-white/80 rounded-xl text-slate-800 placeholder-slate-500 focus:outline-none focus:bg-white focus:border-[#b5ef85] focus:ring-2 focus:ring-[#b5ef85]/40 transition-all text-xs md:text-[13px] font-bold shadow-sm"
              />
              <button
                onClick={onSearchClose}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 active:bg-slate-300 transition-colors cursor-pointer"
                title="Close Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSearchExpand}
              aria-label="Search menu"
              className="w-[34px] md:w-[44px] h-[34px] md:h-[44px] bg-white/70 backdrop-blur-md border border-white/80 rounded-xl shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      <div className="pos-menu-content flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {showCategories
          ? <CategoryTiles onSelectCategory={onSelectCategory} />
          : <MenuGrid activeCategory={activeCategory} onCustomize={onCustomize} searchQuery={searchQuery} layout={categoryFirst ? 'list' : 'grid'} />}
      </div>
    </div>
  );
});
