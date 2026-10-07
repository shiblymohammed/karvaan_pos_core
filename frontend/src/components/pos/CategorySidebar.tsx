import React from 'react';
import * as Icons from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import { motion, LayoutGroup } from 'framer-motion';

interface CategorySidebarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({ activeCategory, onSelectCategory }) => {
  const { categories } = useMenuStore();

  const displayCategories = [
    { id: 'fav', name: 'Favourites', sortOrder: -1, emoji: '⭐', iconName: 'Star' },
    ...[...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  ];

  return (
    <LayoutGroup id="category-sidebar">
      <div className="w-full h-auto flex flex-row items-center gap-2 overflow-x-auto scrollbar-none py-1.5 shrink-0 z-10 relative">
        {displayCategories.map((cat) => {
          const isActive = activeCategory === cat.name;
          return (
            <div key={cat.id} className="relative h-full shrink-0 group">
              <motion.button
                layout
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelectCategory(cat.name)}
                className={`relative group/btn flex flex-row items-center justify-start gap-2 md:gap-3.5 px-2.5 md:px-3 py-1.5 md:py-2.5 h-[34px] md:h-[44px] w-auto rounded-[10px] md:rounded-xl transition-colors duration-300 cursor-pointer z-10 border border-transparent ${
                  isActive
                    ? 'text-white'
                    : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
              >
                {/* Sliding Active Background */}
                {isActive && (
                  <motion.div
                    layoutId="activeCategoryBg"
                    className="absolute inset-0 bg-gradient-to-br from-violet-600 to-[#b58bff] rounded-[10px] md:rounded-xl -z-10 shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  />
                )}

                {/* Category Image / Icon Container */}
                <div className="w-4 h-4 md:w-6 md:h-6 flex items-center justify-center shrink-0 relative z-10">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover rounded-[4px] md:rounded-md shadow-sm" />
                  ) : (
                    cat.iconName ? React.createElement((Icons as any)[cat.iconName] || Icons.Tag, { className: `w-3.5 h-3.5 md:w-5 md:h-5 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover/btn:text-slate-700'}` }) : <span className="text-[13px] md:text-xl leading-none">{cat.emoji || '🍽️'}</span>
                  )}
                </div>
                
                {/* Category Name */}
                <span className={`text-[12px] md:text-[14px] font-extrabold whitespace-nowrap relative z-10 transition-colors ${isActive ? 'text-white' : 'text-slate-600 group-hover/btn:text-slate-800'}`}>
                  {cat.name}
                </span>
              </motion.button>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
};
