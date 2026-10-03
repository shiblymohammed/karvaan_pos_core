import React from 'react';
import { Edit3, Minus, Plus, Trash2 } from 'lucide-react';

interface FolioItemCardProps {
  item: any;
  index: number;
  onUpdateQuantity: (idx: number, delta: number) => void;
  onRemove: (idx: number) => void;
  onUpdateNote: (idx: number, note: string) => void;
  onVoid: (idx: number, item: any) => void;
  kdsStatusBadge?: React.ReactNode;
}

export const FolioItemCard: React.FC<FolioItemCardProps> = ({
  item,
  index,
  onUpdateQuantity,
  onRemove,
  onUpdateNote,
  onVoid,
  kdsStatusBadge
}) => {
  const isSent = item.status === 'SENT';
  const addonsTotal = item.addons?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
  const totalPrice = (item.price + addonsTotal) * item.quantity;

  return (
    <div 
      className={`p-2 mb-1.5 rounded-lg transition-all border group ${
        isSent 
          ? 'bg-white/40 border-white/40 opacity-90 backdrop-blur-md' 
          : 'bg-white/70 border-white/70 hover:border-emerald-300 hover:bg-white/90 backdrop-blur-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        
        {/* Left: Controls & Item Name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          
          {/* Quantity Controls or Badge */}
          {!isSent ? (
            <div className="flex items-center shrink-0 bg-white/50 backdrop-blur-sm rounded-md p-0.5 border border-white/60 shadow-sm">
              <button 
                onClick={() => onUpdateQuantity(index, -1)} 
                className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-transparent hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-4 md:w-5 text-center text-xs md:text-sm font-bold text-slate-800">
                {item.quantity}
              </span>
              <button 
                onClick={() => onUpdateQuantity(index, 1)} 
                className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-transparent hover:bg-white rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="shrink-0 text-[11px] font-bold text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-white/60">
              {item.quantity}x
            </span>
          )}

          {/* Item Name & Quick Note Button */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-xs md:text-sm text-slate-800 truncate">
              {item.name}
            </span>
            
            {!isSent && (
              <button
                onClick={() => {
                  const note = window.prompt(`Enter note for ${item.name}`, item.notes || '');
                  if (note !== null) onUpdateNote(index, note);
                }}
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded-md text-amber-600 hover:bg-amber-50 transition-all cursor-pointer shrink-0 border border-transparent hover:border-amber-200"
                title="Add Note"
              >
                <Edit3 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Price & Remove/Void */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-black text-xs md:text-sm text-slate-900 tabular-nums tracking-tight">
            ₹{totalPrice.toFixed(2)}
          </span>
          
          {!isSent ? (
            <button 
              onClick={() => onRemove(index)} 
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer border border-transparent hover:border-red-200"
              title="Remove Item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              {kdsStatusBadge}
              <button
                onClick={() => onVoid(index, item)}
                className="p-1 rounded-md text-red-500 hover:text-red-600 bg-white/50 hover:bg-red-50 border border-white/60 hover:border-red-200 cursor-pointer transition-all flex items-center justify-center"
                title="Void Sent Item (Requires Manager PIN)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Second Row: Notes & Addons (Only shown if present) */}
      {(item.notes || (item.addons && item.addons.length > 0)) && (
        <div className="flex flex-wrap gap-1 mt-1 pl-10 md:pl-12">
          {item.notes && (
            <span className="text-[9px] md:text-[10px] font-semibold text-amber-700 bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 rounded truncate max-w-[150px]">
              {item.notes}
            </span>
          )}
          {item.addons?.map((addon: any, aIdx: number) => (
            <span key={aIdx} className="text-[9px] md:text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 px-1.5 py-0.5 rounded truncate">
              +{addon.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
