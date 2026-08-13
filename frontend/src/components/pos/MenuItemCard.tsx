import React, { useState } from 'react';
import { Clock, MessageSquare, Plus } from 'lucide-react';
import { Product } from '../../store/useMenuStore';
import { motion } from 'framer-motion';

interface MenuItemCardProps {
  product: Product;
  is86d: boolean;
  isInCart?: boolean;
  onAdd: (product: Product) => void;
  onCustomize: (product: Product) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  product,
  is86d,
  isInCart = false,
  onAdd,
  onCustomize
}) => {
  const [isVibrating, setIsVibrating] = useState(false);

  const handleClick = () => {
    if (is86d) return;
    setIsVibrating(true);
    onAdd(product);
    setTimeout(() => setIsVibrating(false), 200);
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative backdrop-blur-xl rounded-3xl transition-all duration-300 flex flex-col h-[300px] overflow-hidden ${isVibrating ? 'animate-shake' : ''} ${
        is86d 
          ? 'opacity-50 grayscale bg-slate-50/50 border-2 border-dashed border-slate-300 shadow-[0_16px_40px_rgb(0,0,0,0.12)] cursor-not-allowed' 
          : isInCart
            ? 'bg-[#b5ef85] border-2 border-transparent shadow-[0_16px_40px_rgba(181,239,133,0.5)] cursor-pointer'
            : 'bg-white/50 border-2 border-dashed border-slate-300/80 shadow-[0_16px_40px_rgb(0,0,0,0.12)] cursor-pointer hover:bg-[#b5ef85] hover:border-transparent hover:border-solid hover:shadow-[0_16px_40px_rgba(181,239,133,0.5)]'
      }`}
    >
      {/* Full-card Striped Overlay for 86d */}
      {is86d && (
        <div 
          className="absolute inset-0 z-40 pointer-events-none rounded-3xl opacity-60"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.08) 10px, rgba(0,0,0,0.08) 20px)' }}
        />
      )}

      {/* Product Image Cover */}
      <div className="relative h-[190px] w-full shrink-0 p-1 pb-0">
        <div className="w-full h-full bg-white/50 backdrop-blur-md rounded-[20px] overflow-hidden relative shadow-sm border border-white/40">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {product.imageEmoji || '🍽️'}
            </div>
          )}
        </div>
        
        {/* Status Overlay */}
        {is86d && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center rounded-[20px] m-1 mb-0 z-50">
            <span className="text-sm text-white font-black bg-red-500 px-5 py-2 rounded-full uppercase shadow-lg border-2 border-red-400 tracking-wide">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="p-3 px-3.5 flex flex-col justify-between flex-1 gap-1">
        <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight text-[14px]">
          {product.name}
        </h3>

        <div className="flex items-end justify-between mt-auto">
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-black text-slate-900 leading-none">
              ₹{product.price}
            </span>
            {!is86d && (
              <span className="text-[10px] text-slate-500 font-bold inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{product.prepTime} min</span>
              </span>
            )}
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCustomize(product);
            }}
            className="w-8 h-8 bg-[#b5ef85] rounded-[10px] flex items-center justify-center text-slate-900 hover:brightness-95 transition-all active:scale-95 shadow-sm shrink-0"
            title="Customize / Add"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
