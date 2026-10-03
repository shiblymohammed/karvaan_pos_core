import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { X, Search } from 'lucide-react';

export const COMMON_ICONS = [
  'Coffee', 'Pizza', 'Beef', 'Cake', 'Salad', 'Utensils', 'Beer', 'Wine', 'IceCream',
  'Sandwich', 'Fish', 'Croissant', 'Carrot', 'CupSoda', 'Apple', 'UtensilsCrossed',
  'ShoppingBag', 'Store', 'Gift', 'Flame', 'Leaf', 'Star', 'Heart', 'Bone', 'Soup',
  'Martini', 'GlassWater', 'Milestone', 'Package', 'Droplet', 'Candy'
];

interface IconPickerProps {
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export const IconPicker: React.FC<IconPickerProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filteredIcons = COMMON_ICONS.filter(name => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-pos-surface border border-pos-border rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-pos-border flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black text-pos-text tracking-tight">Choose Icon</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-pos-card rounded-xl text-pos-text-muted transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-pos-border shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pos-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full bg-pos-card border-2 border-pos-border rounded-2xl pl-12 pr-4 py-3 text-pos-text font-bold focus:border-pos-accent focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-3">
          {filteredIcons.map(name => {
            const Icon = (Icons as any)[name];
            if (!Icon) return null;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelect(name)}
                className="aspect-square flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 border-transparent hover:border-pos-accent hover:bg-pos-accent/10 transition-all text-pos-text group"
              >
                <Icon className="w-8 h-8 group-hover:scale-110 transition-transform text-pos-text" />
                <span className="text-[10px] font-bold text-pos-text-muted truncate w-full text-center">{name}</span>
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <div className="col-span-full py-12 text-center text-pos-text-muted font-bold">
              No icons found for "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
