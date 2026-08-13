import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

export const EmptyCartState: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-slate-100">
        <UtensilsCrossed className="h-10 w-10 text-slate-300 stroke-1 shrink-0" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">No items selected</h3>
      <p className="text-sm text-slate-500 max-w-[240px] leading-relaxed mb-6">
        Your order folio is currently empty.
      </p>
      
      <div className="px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-semibold text-sm">
        Select a dish to start an order
      </div>
    </div>
  );
};
