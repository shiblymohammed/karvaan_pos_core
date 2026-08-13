import React from 'react';
import { useMenuStore } from '../../store/useMenuStore';
import { motion } from 'framer-motion';

interface CategorySidebarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({ activeCategory, onSelectCategory }) => {
  const { categories } = useMenuStore();

  return (
    <div className="w-full h-auto flex flex-row items-center gap-2 overflow-x-auto scrollbar-none py-2.5 px-3 shrink-0 z-10 relative border-b border-slate-300/30">
      {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((cat) => {
        const isActive = activeCategory === cat.name;
        return (
          <div key={cat.id} className="relative h-full shrink-0 group">
            <button
              onClick={() => onSelectCategory(cat.name)}
              className={`relative group/btn flex flex-row items-center justify-start gap-3.5 px-3 py-2.5 h-[44px] w-auto rounded-xl transition-all duration-300 cursor-pointer active:scale-95 z-10 border border-transparent ${
                isActive
                  ? 'text-white'
                  : 'bg-white/80 backdrop-blur-md text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              {/* Sliding Active Background */}
              {isActive && (
                <motion.div
                  layoutId="activeCategoryBg"
                  className="absolute inset-0 bg-gradient-to-br from-violet-600 to-[#b58bff] rounded-xl -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              {/* Category Image / Icon Container */}
              <div className="w-6 h-6 flex items-center justify-center shrink-0 relative z-10">
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover rounded-md shadow-sm" />
                ) : (
                  <span className="text-xl leading-none">{cat.emoji || '🍽️'}</span>
                )}
              </div>
              
              {/* Category Name */}
              <span className={`text-[14px] font-bold whitespace-nowrap relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-600 group-hover/btn:text-slate-800'}`}>
                {cat.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
