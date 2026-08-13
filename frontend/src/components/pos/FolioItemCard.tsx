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
      className={`p-3 md:p-4 mb-2 rounded-xl transition-all border group ${
        isSent 
          ? 'bg-slate-50 border-slate-200 opacity-90' 
          : 'bg-white border-slate-200 hover:border-emerald-200 shadow-sm hover:shadow'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        
        {/* Left: Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm text-slate-800 leading-tight">
              {item.name}
            </span>
            
            {!isSent && (
              <button
                onClick={() => {
                  const note = window.prompt(`Enter note for ${item.name}`, item.notes || '');
                  if (note !== null) onUpdateNote(index, note);
                }}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded text-amber-600 hover:bg-amber-50 transition-all cursor-pointer shrink-0 border border-transparent hover:border-amber-200"
                title="Add Note"
              >
                <Edit3 className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Note</span>
              </button>
            )}
          </div>

          {/* Notes & Addons */}
          {(item.notes || (item.addons && item.addons.length > 0)) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {item.notes && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                  Note: {item.notes}
                </span>
              )}
              {item.addons?.map((addon: any, aIdx: number) => (
                <span key={aIdx} className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md truncate">
                  +{addon.name}
                </span>
              ))}
            </div>
          )}
          
          <div>
            <span className="font-bold text-sm text-slate-600">
              ₹{totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right: Controls & Status */}
        {!isSent ? (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Quantity Controls */}
            <div className="flex items-center gap-1 shrink-0 bg-slate-50 rounded-full p-1 border border-slate-200">
              <button 
                onClick={() => onUpdateQuantity(index, -1)} 
                className="w-7 h-7 flex items-center justify-center bg-white text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer shadow-sm border border-slate-200"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-bold text-slate-800">
                {item.quantity}
              </span>
              <button 
                onClick={() => onUpdateQuantity(index, 1)} 
                className="w-7 h-7 flex items-center justify-center bg-white text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer shadow-sm border border-slate-200"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Remove Action */}
            <button 
              onClick={() => onRemove(index)} 
              className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 uppercase tracking-wider px-1 py-0.5 transition-all flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {kdsStatusBadge}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                Qty: {item.quantity}
              </span>
              <button
                onClick={() => onVoid(index, item)}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 bg-red-50 border border-red-200 px-2 py-1 rounded-md uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1"
                title="Void Sent Item (Requires Manager PIN)"
              >
                <Trash2 className="h-3 w-3" /> Void
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
