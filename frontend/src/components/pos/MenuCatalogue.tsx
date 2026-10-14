import React from 'react';
import { Search, X } from 'lucide-react';
import { CategorySidebar } from './CategorySidebar';
import { MenuGrid } from './MenuGrid';

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

export const MenuCatalogue: React.FC<MenuCatalogueProps> = ({
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
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 pt-10 md:pt-14">
      {/* Unified Top Bar: Categories + Search */}
      <div className="flex items-center gap-1.5 md:gap-2 px-1.5 md:px-4 z-30 bg-white/40 backdrop-blur-md rounded-2xl mx-1.5 md:mx-4 py-1.5 border border-white/40 shadow-sm mt-1">
        <div className="flex-1 overflow-hidden">
          <CategorySidebar activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
        </div>

        <div className="shrink-0 flex items-center justify-end gap-1.5 md:gap-2 relative z-30">
          <button
            onClick={onOpenAddonModal}
            className="px-2.5 md:px-3 h-[34px] md:h-[44px] bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold border border-amber-200 rounded-xl shadow-sm flex items-center justify-center transition-all active:scale-95 text-[11px] md:text-xs whitespace-nowrap"
          >
            + Add-on
          </button>

          {isSearchExpanded ? (
            <div className="relative w-40 sm:w-48 md:w-80 animate-in slide-in-from-right-8 duration-300">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
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
              className="w-[34px] md:w-[44px] h-[34px] md:h-[44px] bg-white/70 backdrop-blur-md border border-white/80 rounded-xl shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
            >
              <Search className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-2 md:p-5 md:pb-24 lg:pb-5 overflow-hidden">
        <MenuGrid activeCategory={activeCategory} onCustomize={onCustomize} searchQuery={searchQuery} />
      </div>
    </div>
  );
};
