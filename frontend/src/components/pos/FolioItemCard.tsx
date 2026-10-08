import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, Minus, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { useMenuStore } from '../../store/useMenuStore';
import { useAddonStore, PaidAddon } from '../../store/useAddonStore';

interface FolioItemCardProps {
  item: any;
  index: number;
  onUpdateQuantity: (idx: number, delta: number) => void;
  onRemove: (idx: number) => void;
  onUpdateNote: (idx: number, note: string) => void;
  onUpdateAddons?: (idx: number, addons: any[]) => void;
  onVoid: (idx: number, item: any) => void;
  kdsStatusBadge?: React.ReactNode;
}

export const FolioItemCard: React.FC<FolioItemCardProps> = ({
  item,
  index,
  onUpdateQuantity,
  onRemove,
  onUpdateNote,
  onUpdateAddons,
  onVoid,
  kdsStatusBadge
}) => {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState(item.notes || '');
  const [selectedAddons, setSelectedAddons] = useState<PaidAddon[]>(item.addons || []);
  
  const { getActiveAddons } = useAddonStore();
  const activeAddons = getActiveAddons();

  const handleSaveNote = () => {
    onUpdateNote(index, noteText);
    if (onUpdateAddons) {
      onUpdateAddons(index, selectedAddons);
    }
    setIsNoteModalOpen(false);
  };

  const isSent = item.status === 'SENT';
  const isAddon = item.category === 'ADD-ON';
  const addonsTotal = item.addons?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
  const totalPrice = (item.price + addonsTotal) * item.quantity;
  const product = useMenuStore.getState().products.find(p => p.id === item.productId);

  return (
    <div 
      className={`mb-1.5 rounded-lg transition-all border group ${
        isAddon 
          ? 'p-1.5 bg-amber-50/50 border-dashed border-amber-200/50 scale-[0.97] opacity-80'
          : `p-2 ${isSent 
              ? 'bg-white/40 border-white/40 opacity-90 backdrop-blur-md' 
              : 'bg-white/70 border-white/70 hover:border-emerald-300 hover:bg-white/90 backdrop-blur-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
            }`
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
                  setNoteText(item.notes || '');
                  setIsNoteModalOpen(true);
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

      {/* Second Row: Notes & Addons & Combos (Only shown if present) */}
      {(item.notes || (item.addons && item.addons.length > 0) || (product?.isCombo && product?.comboItems?.length > 0)) && (
        <div className="flex flex-wrap gap-1 mt-1 pl-10 md:pl-12">
          {item.notes && (
            <span className="text-[9px] md:text-[10px] font-semibold text-amber-700 bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 rounded truncate max-w-[150px]">
              {item.notes}
            </span>
          )}
          {Object.entries(
            (item.addons || []).reduce((acc: any, addon: any) => {
              acc[addon.name] = (acc[addon.name] || 0) + 1;
              return acc;
            }, {})
          ).map(([name, qty]: [string, any], aIdx: number) => (
            <span key={aIdx} className="text-[9px] md:text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 px-1.5 py-0.5 rounded truncate">
              {qty > 1 ? `${qty}x ` : '+'}{name}
            </span>
          ))}
          {product?.isCombo && Object.entries(
            (product.comboItems || []).reduce((acc: any, id: string) => {
              const pName = useMenuStore.getState().products.find(p => p.id === id)?.name;
              if (pName) acc[pName] = (acc[pName] || 0) + 1;
              return acc;
            }, {})
          ).map(([name, qty]: [string, any], cIdx: number) => (
            <span key={cIdx} className="text-[9px] md:text-[10px] font-semibold text-purple-700 bg-purple-50/80 border border-purple-200/60 px-1.5 py-0.5 rounded truncate">
              • {qty}x {name}
            </span>
          ))}
        </div>
      )}

      {/* Note Modal via React Portal to prevent overflow clipping */}
      {isNoteModalOpen && document.body && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsNoteModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-sm">Add Note to {item.name}</h3>
            </div>
            <div className="p-4">
              <input
                type="text"
                autoFocus
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="e.g. Extra spicy, no onions..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveNote();
                  if (e.key === 'Escape') setIsNoteModalOpen(false);
                }}
              />

              {activeAddons.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wider">Select Add-ons</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                    {activeAddons.map(addon => {
                      const qty = selectedAddons.filter(a => a.id === addon.id).length;
                      return (
                        <div 
                          key={addon.id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                            qty > 0 
                              ? 'bg-amber-50 border-amber-200 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/50'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className={`text-sm font-semibold truncate ${qty > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{addon.name}</span>
                            <span className="text-xs opacity-70 tabular-nums text-slate-500">+₹{addon.price}</span>
                          </div>

                          {qty === 0 ? (
                            <button 
                              onClick={() => setSelectedAddons(prev => [...prev, addon])}
                              className="w-7 h-7 shrink-0 rounded bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-600 flex items-center justify-center font-bold active:scale-95 transition-colors border border-transparent"
                            >
                              <Plus className="w-4 h-4 stroke-[3]" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-amber-100/50 rounded-lg p-1 shrink-0 border border-amber-200/50">
                              <button 
                                onClick={() => {
                                  const idx = selectedAddons.findIndex(a => a.id === addon.id);
                                  if(idx !== -1) {
                                    const newArr = [...selectedAddons];
                                    newArr.splice(idx, 1);
                                    setSelectedAddons(newArr);
                                  }
                                }}
                                className="w-5 h-5 rounded bg-white text-amber-700 flex items-center justify-center shadow-sm active:scale-95"
                              >
                                <Minus className="w-3 h-3 stroke-[3]" />
                              </button>
                              <span className="text-[11px] font-black text-amber-800 w-3 text-center">{qty}</span>
                              <button 
                                onClick={() => setSelectedAddons(prev => [...prev, addon])}
                                className="w-5 h-5 rounded bg-white text-amber-700 flex items-center justify-center shadow-sm active:scale-95"
                              >
                                <Plus className="w-3 h-3 stroke-[3]" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 pt-0 flex gap-2 justify-end">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
