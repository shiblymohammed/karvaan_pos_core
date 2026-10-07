import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMenuStore, Product } from '../../store/useMenuStore';
import { Plus, Edit3, Trash2, X, AlertCircle } from 'lucide-react';

interface ComboFormProps {
  initial?: Partial<Product>;
  products: Product[];
  onSave: (data: Partial<Product>) => void;
  onClose: () => void;
}

const ComboForm: React.FC<ComboFormProps> = ({ initial, products, onSave, onClose }) => {
  const [form, setForm] = useState<Partial<Product>>({
    name: '', price: 0, category: 'Combos', isAvailable: true,
    prepTime: 5, gstRate: 5, imageEmoji: '🍱', iconName: 'UtensilsCrossed', description: '', isCombo: true, comboItems: [], ...initial
  });

  const [searchQuery, setSearchQuery] = useState('');

  const addComboItem = (productId: string) => {
    setForm({ ...form, comboItems: [...(form.comboItems || []), productId] });
  };

  const removeComboItem = (productId: string) => {
    const current = form.comboItems || [];
    const idx = current.indexOf(productId);
    if (idx !== -1) {
      const newItems = [...current];
      newItems.splice(idx, 1);
      setForm({ ...form, comboItems: newItems });
    }
  };

  const filteredProducts = products.filter(p => !p.isCombo && p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800">{initial ? 'Edit Combo' : 'New Combo'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Combo Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Combo Price</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold" />
            </div>
          </div>

          <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4">
            <div className="flex justify-between items-end mb-2 gap-2">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="Search items..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white/60 border border-emerald-200/80 rounded-lg text-emerald-900 text-xs font-bold focus:outline-none focus:border-emerald-400 placeholder:text-emerald-300"
                />
              </div>
              <div className="text-sm font-bold text-slate-600 bg-emerald-100/50 px-2 py-1 rounded-md shrink-0">
                Normal Price: ₹{(form.comboItems || []).reduce((sum, id) => sum + (products.find(p => p.id === id)?.price || 0), 0)}
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto flex flex-col gap-2 custom-scrollbar pr-2">
              {filteredProducts.map(p => {
                const qty = (form.comboItems || []).filter(id => id === p.id).length;
                return (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${qty > 0 ? 'bg-emerald-100/30 border-emerald-300' : 'hover:bg-white border-transparent hover:border-emerald-200'}`}>
                    <div className="flex-1 flex flex-col justify-center text-sm font-bold text-slate-700 min-w-0 pr-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-slate-400 text-xs">₹{p.price}</span>
                    </div>
                    {qty === 0 ? (
                      <button type="button" onClick={() => addComboItem(p.id)} className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center font-bold transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-emerald-100 rounded-lg p-1 shrink-0">
                        <button type="button" onClick={() => removeComboItem(p.id)} className="w-6 h-6 rounded bg-white text-emerald-700 flex items-center justify-center shadow-sm">
                          <span className="text-lg leading-none font-black block mt-[-2px]">-</span>
                        </button>
                        <span className="text-xs font-black text-emerald-900 w-4 text-center">{qty}</span>
                        <button type="button" onClick={() => addComboItem(p.id)} className="w-6 h-6 rounded bg-white text-emerald-700 flex items-center justify-center shadow-sm">
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-white text-slate-600 font-black rounded-2xl shadow-sm border border-slate-200">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name || form.price === undefined} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-sm disabled:opacity-50">Save Combo</button>
        </div>
      </motion.div>
    </div>
  );
};

export const AdminComboStudio: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useMenuStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Product | null>(null);

  const combos = products.filter(p => p.isCombo);

  return (
    <div className="h-full bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-lg p-6 flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Combo Studio</h2>
          <p className="text-sm font-bold text-slate-500">Create and manage meal combos</p>
        </div>
        <button onClick={() => { setEditingCombo(null); setIsFormOpen(true); }} className="px-5 py-2.5 bg-emerald-500 text-white font-extrabold rounded-xl shadow-md hover:bg-emerald-600 transition flex items-center gap-2">
          <Plus className="w-5 h-5" /> New Combo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {combos.map(combo => (
            <div key={combo.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">{combo.name}</h3>
                  <div className="text-emerald-600 font-black">₹{combo.price}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingCombo(combo); setIsFormOpen(true); }} className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center hover:bg-amber-100"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => { if(confirm('Delete combo?')) deleteProduct(combo.id); }} className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-500 border-t border-slate-100 pt-2 flex flex-wrap gap-1">
                {(combo.comboItems || []).map((id, idx) => {
                  const p = products.find(prod => prod.id === id);
                  return p ? <span key={idx} className="bg-slate-100 px-2 py-1 rounded-md">{p.name}</span> : null;
                })}
              </div>
            </div>
          ))}
          {combos.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-bold">No combos found. Create one above!</p>
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <ComboForm 
          initial={editingCombo || undefined} 
          products={products} 
          onSave={(data) => {
            if (editingCombo) updateProduct(editingCombo.id, data);
            else addProduct(data as Omit<Product, 'id'>);
            setIsFormOpen(false);
          }} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}
    </div>
  );
};
