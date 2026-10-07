import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMenuStore, Product, Category } from '../../store/useMenuStore';
import {
  Plus, Edit3, Trash2, X, Check, PowerOff, ChevronUp, ChevronDown,
  Search, LayoutGrid, UtensilsCrossed, Tag, Save, AlertCircle, ImagePlus, Trash, Star
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { IconPicker } from '../../components/IconPicker';
import CustomSelect from '../../components/shared/CustomSelect';

// ─── Image Compress Helper ──────────────────────────────────────────────────────
function compressImage(file: File, maxSize = 200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Emoji colour token → Tailwind colours ────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; pill: string }> = {
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300',  pill: 'bg-slate-500' },
  amber:   { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  pill: 'bg-amber-500' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300',    pill: 'bg-cyan-500' },
  orange:  { bg: 'bg-orange-100',text: 'text-orange-700',border: 'border-orange-300',pill: 'bg-orange-500' },
  red:     { bg: 'bg-red-100',      text: 'text-red-700',      border: 'border-red-300',      pill: 'bg-red-500' },
  yellow:  { bg: 'bg-yellow-100',text: 'text-yellow-700',border: 'border-yellow-300',pill: 'bg-yellow-500' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-300',    pill: 'bg-pink-500' },
  emerald: { bg: 'bg-emerald-100',text:'text-emerald-700',border:'border-emerald-300',pill:'bg-emerald-500'},
  purple:  { bg: 'bg-purple-100',text: 'text-purple-700',border: 'border-purple-300',pill: 'bg-purple-500' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    pill: 'bg-blue-500' },
};
const COLOR_OPTIONS = Object.keys(COLOR_MAP);
const EMOJI_PRESETS = ['🍽️','☕','🧋','🍔','🍕','🍛','🍰','🥤','🍹','🥗','🍜','🍣','🍦','🥐','🥪','🫕','🌯','🍫','🍵','🍺','🥂','🧇','🥞','🍩'];

const inputCls = 'w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all';
const labelCls = 'block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2';

// ─── Product Form Modal ───────────────────────────────────────────────────────
interface ProductFormProps {
  initial?: Partial<Product>;
  categories: Category[];
  products: Product[];
  onSave: (data: Omit<Product, 'id' | 'isAvailable'>) => void;
  onClose: () => void;
  title: string;
}
const ProductForm: React.FC<ProductFormProps> = ({ initial, categories, products, onSave, onClose, title }) => {
  const [form, setForm] = useState<Partial<Product>>({
    name: '', price: 0, category: categories[0]?.name || '', isAvailable: true,
    prepTime: 5, gstRate: 5, imageEmoji: '', iconName: 'UtensilsCrossed', description: '', imageUrl: '', isCombo: false, comboItems: [], ...initial
  });
  
  const toggleComboItem = (productId: string) => {
    const current = form.comboItems || [];
    if (current.includes(productId)) {
      setForm({ ...form, comboItems: current.filter(id => id !== productId) });
    } else {
      setForm({ ...form, comboItems: [...current, productId] });
    }
  };
  const [showIconPicker, setShowIconPicker] = useState(false);
  const nonAll = categories.filter(c => c.name !== 'All').sort((a, b) => a.sortOrder - b.sortOrder);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://${window.location.hostname}:3001/upload?type=menu`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setForm({ ...form, imageUrl: data.url });
    } catch (err) {
      console.error('Image upload failed', err);
      alert('Failed to upload image. Please try again.');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    onSave(form as Omit<Product, 'id' | 'isAvailable'>);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-lg rounded-[32px] border border-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200/60 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-emerald-100 rounded-xl"><UtensilsCrossed className="h-5 w-5 text-emerald-600" /></div> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Live Preview */}
          <div className="flex items-center gap-4 px-5 py-4 rounded-[20px] border border-slate-200/60 bg-white/50 shadow-sm">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="Preview" className="w-12 h-12 rounded-[14px] object-cover shadow-md" />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center text-2xl bg-white rounded-[14px] shadow-sm border border-slate-100">
                {form.iconName ? React.createElement((Icons as any)[form.iconName] || Icons.Utensils, { className: 'w-6 h-6 text-slate-600' }) : (form.imageEmoji || '🍽️')}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-base text-slate-800 leading-tight">{form.name || 'Product Preview'}</span>
              <span className="text-sm font-bold text-emerald-600">₹{form.price || 0}</span>
            </div>
          </div>

          {/* Icon + Name row */}
          <div className="flex gap-4">
            <div className="w-24">
              <label className={labelCls}>Icon</label>
              <button 
                type="button" 
                onClick={() => setShowIconPicker(true)}
                className="w-full h-[46px] flex items-center justify-center bg-white/60 border border-slate-200/80 rounded-2xl hover:bg-white shadow-sm transition-colors text-slate-600"
              >
                {form.iconName ? React.createElement((Icons as any)[form.iconName] || Icons.Utensils, { className: 'w-6 h-6' }) : (form.imageEmoji || '🍽️')}
              </button>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Product Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="e.g. Garlic Bread" />
            </div>
          </div>

          {/* Image Upload Zone */}
          <div>
            <label className={labelCls}>Product Photo (optional)</label>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            {form.imageUrl ? (
              <div className="flex items-center gap-4 bg-white/40 p-4 rounded-2xl border border-slate-200/60">
                <img src={form.imageUrl} alt="Preview" className="w-16 h-16 rounded-[14px] object-cover shadow-sm" />
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer w-fit">Change Image</button>
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })}
                    className="text-[11px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer w-fit">
                    <Trash className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-slate-300 rounded-[20px] flex flex-col items-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all cursor-pointer group bg-white/40">
                {uploading ? (
                  <span className="text-sm font-bold text-slate-400 animate-pulse">Compressing...</span>
                ) : (
                  <>
                    <ImagePlus className="h-8 w-8 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-sm font-bold text-slate-500 group-hover:text-emerald-600">Click to upload photo</span>
                    <span className="text-[11px] font-medium text-slate-400">JPG, PNG — auto-resized to 200×200</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div>
            <label className={labelCls}>Description (optional)</label>
            <input type="text" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
              className={inputCls} placeholder="Short description for menu display" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Price (₹) *</label>
              <input type="number" required min="0" value={form.price === 0 ? '' : form.price}
                onChange={e => setForm({ ...form, price: e.target.value === '' ? 0 : Number(e.target.value) })}
                className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} placeholder="150" />
            </div>
            <div>
              <label className={labelCls}>GST %</label>
              <input type="number" min="0" max="28" value={form.gstRate === 0 ? '' : (form.gstRate ?? 5)}
                onChange={e => setForm({ ...form, gstRate: e.target.value === '' ? 0 : Number(e.target.value) })}
                className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} placeholder="5" />
            </div>
            <div>
              <label className={labelCls}>Prep (min)</label>
              <input type="number" min="0" value={form.prepTime === 0 ? '' : form.prepTime}
                onChange={e => setForm({ ...form, prepTime: e.target.value === '' ? 0 : Number(e.target.value) })}
                className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} placeholder="5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category *</label>
              <CustomSelect
                value={form.category || (nonAll[0]?.name ?? '')}
                onChange={val => setForm({ ...form, category: val as string })}
                options={nonAll.map(cat => ({ value: cat.name, label: `${cat.emoji} ${cat.name}` }))}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.isCombo || false}
                  onChange={e => {
                    const isCombo = e.target.checked;
                    setForm({ 
                      ...form, 
                      isCombo, 
                      category: isCombo ? 'Combos' : form.category 
                    });
                  }}
                  className="w-5 h-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-slate-700">Is this a Combo?</span>
              </label>
            </div>
          </div>

          {form.isCombo && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">Select items included in this combo</label>
                <div className="text-sm font-bold text-slate-600 bg-emerald-100/50 px-2 py-1 rounded-md">
                  Normal Price: ₹{(form.comboItems || []).reduce((sum, id) => {
                    const p = products.find(prod => prod.id === id);
                    return sum + (p?.price || 0);
                  }, 0)}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-2 pr-2 custom-scrollbar">
                {products.filter(p => !p.isCombo).map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors border border-transparent hover:border-emerald-200">
                    <input 
                      type="checkbox" 
                      checked={(form.comboItems || []).includes(p.id)}
                      onChange={() => toggleComboItem(p.id)}
                      className="w-4 h-4 rounded text-emerald-500"
                    />
                    <div className="flex-1 flex justify-between items-center text-sm font-bold text-slate-700">
                      <span>{p.imageEmoji} {p.name}</span>
                      <span className="text-slate-400">₹{p.price}</span>
                    </div>
                  </label>
                ))}
                {products.filter(p => !p.isCombo).length === 0 && (
                  <p className="text-sm text-slate-500 italic">No products available to create a combo.</p>
                )}
              </div>
            </div>
          )}

          <div className="pt-6 mt-2 flex gap-3 border-t border-slate-200/60">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm">
              Cancel
            </button>
            <button type="submit" disabled={uploading}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] font-black text-sm rounded-2xl shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save Item
            </button>
          </div>
        </form>

        {showIconPicker && (
          <IconPicker
            onClose={() => setShowIconPicker(false)}
            onSelect={(iconName) => {
              setForm({ ...form, iconName, imageEmoji: '' });
              setShowIconPicker(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// ─── Category Form Modal ──────────────────────────────────────────────────────
interface CategoryFormProps {
  initial?: Partial<Category>;
  onSave: (data: Omit<Category, 'id' | 'sortOrder'>) => void;
  onClose: () => void;
  title: string;
}
const CategoryForm: React.FC<CategoryFormProps> = ({ initial, onSave, onClose, title }) => {
  const [form, setForm] = useState<Partial<Category>>({ name: '', emoji: '', iconName: 'Tag', imageUrl: '', ...initial });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://${window.location.hostname}:3001/upload?type=menu`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setForm({ ...form, imageUrl: data.url });
    } catch (err) {
      console.error('Image upload failed', err);
      alert('Failed to upload image. Please try again.');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) return;
    onSave({ name: form.name.trim(), emoji: form.emoji, iconName: form.iconName, imageUrl: form.imageUrl });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[32px] border border-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200/60 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-purple-100 rounded-xl"><Tag className="h-5 w-5 text-purple-600" /></div> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Live Preview */}
          <div className="flex items-center gap-4 px-5 py-4 rounded-[20px] border border-slate-200/60 bg-white/50 shadow-sm">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="Preview" className="w-12 h-12 rounded-[14px] object-cover shadow-md" />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center text-2xl bg-white rounded-[14px] shadow-sm border border-slate-100">
                {form.iconName ? React.createElement((Icons as any)[form.iconName] || Icons.Tag, { className: 'w-6 h-6 text-slate-600' }) : (form.emoji || '🍽️')}
              </div>
            )}
            <span className="font-black text-base text-slate-800">{form.name || 'Category Preview'}</span>
          </div>

          <div className="flex gap-4">
            <div className="w-24">
              <label className={labelCls}>Icon</label>
              <button 
                type="button" 
                onClick={() => setShowIconPicker(true)}
                className="w-full h-[46px] flex items-center justify-center bg-white/60 border border-slate-200/80 rounded-2xl hover:bg-white shadow-sm transition-colors text-slate-600"
              >
                {form.iconName ? React.createElement((Icons as any)[form.iconName] || Icons.Tag, { className: 'w-6 h-6' }) : (form.emoji || '🍽️')}
              </button>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Category Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="e.g. Soups & Starters" />
            </div>
          </div>

          {/* Image Upload Zone */}
          <div>
            <label className={labelCls}>Category Photo (optional)</label>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            {form.imageUrl ? (
              <div className="flex items-center gap-4 bg-white/40 p-4 rounded-2xl border border-slate-200/60">
                <img src={form.imageUrl} alt="Preview" className="w-16 h-16 rounded-[14px] object-cover shadow-sm" />
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer w-fit">Change Image</button>
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })}
                    className="text-[11px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer w-fit">
                    <Trash className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-slate-300 rounded-[20px] flex flex-col items-center gap-2 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer group bg-white/40">
                {uploading ? (
                  <span className="text-sm font-bold text-slate-400 animate-pulse">Compressing...</span>
                ) : (
                  <>
                    <ImagePlus className="h-8 w-8 text-slate-300 group-hover:text-purple-500 transition-colors" />
                    <span className="text-sm font-bold text-slate-500 group-hover:text-purple-600">Click to upload photo</span>
                    <span className="text-[11px] font-medium text-slate-400">JPG, PNG — auto-resized to 200×200</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="pt-6 mt-2 flex gap-3 border-t border-slate-200/60">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] font-black text-sm rounded-2xl shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Admin Menu Manager ──────────────────────────────────────────────────
type Tab = 'products' | 'categories';

export const AdminMenuManager: React.FC = () => {
  const {
    products, categories,
    addProduct, updateProduct, deleteProduct, toggleAvailability, toggleFavourite,
    addCategory, updateCategory, deleteCategory, reorderCategory
  } = useMenuStore();

  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');

  // Product modal state
  const [productModal, setProductModal] = useState<{ open: boolean; editing?: Product }>({ open: false });

  // Category modal state
  const [catModal, setCatModal] = useState<{ open: boolean; editing?: Category }>({ open: false });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'product' | 'category'; id: string; name: string } | null>(null);

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p =>
      (filterCat === 'All' || p.category === filterCat) &&
      (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [products, filterCat, search]);

  const getCategoryStyle = (catName: string) => {
    const cat = categories.find(c => c.name === catName);
    return COLOR_MAP[cat?.color || 'slate'] || COLOR_MAP['slate'];
  };

  const handleProductSave = (data: Omit<Product, 'id' | 'isAvailable'>) => {
    if (productModal.editing) {
      updateProduct(productModal.editing.id, data);
    } else {
      addProduct(data);
    }
    setProductModal({ open: false });
  };

  const handleCategorySave = (data: Omit<Category, 'id' | 'sortOrder'>) => {
    if (catModal.editing) {
      updateCategory(catModal.editing.id, data);
    } else {
      addCategory(data);
    }
    setCatModal({ open: false });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'product') deleteProduct(deleteConfirm.id);
    else deleteCategory(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-0 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          {/* Tabs */}
          <div className="flex gap-2 w-full sm:w-fit overflow-x-auto hide-scrollbar">
            {([['products', 'Menu Items', UtensilsCrossed], ['categories', 'Categories', LayoutGrid]] as const).map(([id, label, Icon]) => {
              const isActive = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id as Tab)}
                  className={`relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'bg-white/50 text-slate-600 border border-white/60 hover:bg-white/80'
                  }`}>
                  {isActive && (
                    <motion.div
                      layoutId="menuTabs"
                      className="absolute inset-0 bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full shadow-md z-0"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={`h-4 w-4 relative z-10 ${isActive ? 'text-white' : 'text-slate-500'}`} /> 
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Floating Action Buttons on Mobile, Inline on Desktop */}
          <div className="fixed sm:static bottom-[90px] right-6 sm:bottom-auto sm:right-auto z-40 flex flex-col sm:flex-row gap-3 items-end sm:items-center pointer-events-none">
            {activeTab === 'products' ? (
              <button onClick={() => setProductModal({ open: true })}
                className="px-5 py-3.5 sm:py-2.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] font-black rounded-full sm:rounded-[14px] shadow-xl sm:shadow-md shadow-slate-300/50 transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto shrink-0">
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Item</span>
              </button>
            ) : (
              <button onClick={() => setCatModal({ open: true })}
                className="px-5 py-3.5 sm:py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-full sm:rounded-[14px] shadow-xl sm:shadow-md shadow-purple-200 transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto shrink-0">
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Category</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Products Tab ─────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
            <div className="relative w-full sm:w-72 sm:min-w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all" />
            </div>
            <div className="flex gap-2 flex-nowrap overflow-x-auto hide-scrollbar pb-1 w-full sm:w-auto">
              {sortedCategories.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.name)}
                  className={`px-4 py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-black transition-all cursor-pointer border whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    filterCat === cat.name
                      ? 'bg-slate-800 text-[#b5ef85] border-slate-800 shadow-md'
                      : 'bg-white/60 border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-white/80 shadow-sm'
                  }`}>
                  <span className="text-sm">{cat.emoji}</span> {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[32px] overflow-hidden shadow-xl p-2 sm:p-5">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                <div className="p-5 bg-white/50 rounded-full shadow-inner border border-white">
                  <UtensilsCrossed className="h-10 w-10 text-slate-300" />
                </div>
                <div className="text-center">
                  <p className="font-black text-lg text-slate-700">No items found</p>
                  <p className="text-sm font-medium mt-1">Try a different search or category filter</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] uppercase font-extrabold tracking-widest text-slate-400 bg-white/50">
                      <th className="py-4 px-4">Item</th>
                      <th className="py-4 px-4">Category</th>
                      <th className="py-4 px-4">Price</th>
                      <th className="py-4 px-4">GST</th>
                      <th className="py-4 px-4">Prep</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 text-sm font-bold text-slate-700 bg-white/40">
                    {filteredProducts.map(prod => {
                      return (
                        <tr key={prod.id} className="hover:bg-white/80 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 shrink-0 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm">
                                {prod.imageUrl ? (
                                  <img src={prod.imageUrl} alt={prod.name} className="w-11 h-11 rounded-[10px] object-cover" />
                                ) : (
                                  prod.iconName ? React.createElement((Icons as any)[prod.iconName] || Icons.Utensils, { className: 'w-5 h-5 text-slate-400' }) : <span className="text-xl">{prod.imageEmoji || '🍽️'}</span>
                                )}
                              </div>
                              <div className="flex flex-col justify-center">
                                <p className={`font-black text-sm text-slate-800 ${!prod.isAvailable ? 'line-through text-slate-400' : ''}`}>
                                  {prod.name}
                                </p>
                                {prod.description && (
                                  <p className="text-[10px] font-semibold text-slate-400 truncate max-w-40 md:max-w-xs">{prod.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border bg-white border-slate-200 text-slate-600 shadow-sm">
                              {categories.find(c => c.name === prod.category)?.emoji} {prod.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-emerald-600 text-base">₹{prod.price}</td>
                          <td className="py-3 px-4 text-xs font-bold text-slate-400">{prod.gstRate ?? 5}%</td>
                          <td className="py-3 px-4 text-xs font-bold text-slate-400">{prod.prepTime}m</td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => toggleAvailability(prod.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border shadow-sm ${
                                prod.isAvailable
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                              }`}>
                              {prod.isAvailable ? <><Check className="h-3 w-3" /> In Stock</> : <><PowerOff className="h-3 w-3" /> 86'd</>}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => toggleFavourite(prod.id)}
                                title={prod.isFavourite ? "Remove from Favourites" : "Add to Favourites"}
                                className={`p-2 border shadow-sm rounded-xl transition-all cursor-pointer ${
                                  prod.isFavourite 
                                    ? 'text-amber-500 bg-amber-50 border-amber-200 hover:bg-amber-100' 
                                    : 'text-slate-400 bg-white border-slate-200 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50'
                                }`}>
                                <Star className={`h-4 w-4 ${prod.isFavourite ? 'fill-current' : ''}`} />
                              </button>
                              <button onClick={() => setProductModal({ open: true, editing: prod })}
                                className="p-2 text-slate-400 bg-white border border-slate-200 shadow-sm hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all cursor-pointer">
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button onClick={() => setDeleteConfirm({ type: 'product', id: prod.id, name: prod.name })}
                                className="p-2 text-slate-400 bg-white border border-slate-200 shadow-sm hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 rounded-xl transition-all cursor-pointer">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Categories Tab ────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10">


          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedCategories.map((cat, idx) => {
              const productCount = products.filter(p => p.category === cat.name).length;
              const isAll = cat.name === 'All';

              return (
                <div key={cat.id}
                  className="flex items-center gap-4 p-5 rounded-[24px] bg-white/70 backdrop-blur-xl border border-white/80 shadow-md transition-all group hover:shadow-lg">
                  {/* Drag handle / reorder */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => reorderCategory(cat.id, 'up')}
                      disabled={isAll || idx <= 1}
                      className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => reorderCategory(cat.id, 'down')}
                      disabled={isAll || idx === sortedCategories.length - 1}
                      className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white rounded-xl border border-slate-100 shadow-sm text-slate-600">
                      {cat.imageUrl ? (
                        <img src={cat.imageUrl} alt={cat.name} className="w-12 h-12 rounded-[10px] object-cover" />
                      ) : (
                        cat.iconName ? React.createElement((Icons as any)[cat.iconName] || Icons.Tag, { className: 'w-6 h-6' }) : <span className="text-2xl">{cat.emoji}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="font-black text-lg text-slate-800 truncate">{cat.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          #{cat.sortOrder}
                        </span>
                        <p className="text-[11px] text-slate-500 font-bold">
                          {isAll ? `${products.length} total items` : `${productCount} item${productCount !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isAll && (
                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setCatModal({ open: true, editing: cat })}
                        className="p-2 bg-white text-slate-400 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name })}
                        disabled={productCount > 0}
                        title={productCount > 0 ? `Move ${productCount} item(s) to another category first` : 'Delete category'}
                        className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Add Category Card CTA */}
            <button onClick={() => setCatModal({ open: true })}
              className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] border-2 border-dashed border-slate-300 bg-white/30 text-slate-400 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/50 transition-all cursor-pointer min-h-[104px]">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100"><Plus className="h-5 w-5" /></div>
              <span className="text-sm font-black uppercase tracking-wider">Add Category</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Product Modal ──────────────────────────────────────────────── */}
      {productModal.open && (
        <ProductForm
          initial={productModal.editing}
          categories={categories}
          products={products}
          title={productModal.editing ? 'Edit Menu Item' : 'Add New Menu Item'}
          onSave={handleProductSave}
          onClose={() => setProductModal({ open: false })}
        />
      )}

      {/* ─── Category Modal ─────────────────────────────────────────────── */}
      {catModal.open && (
        <CategoryForm
          initial={catModal.editing}
          title={catModal.editing ? 'Edit Category' : 'Add New Category'}
          onSave={handleCategorySave}
          onClose={() => setCatModal({ open: false })}
        />
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-2xl p-7 max-w-sm w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200 shadow-sm">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div className="pt-1">
                <h3 className="font-black text-lg text-slate-800 leading-tight">
                  Delete {deleteConfirm.type === 'product' ? 'Item' : 'Category'}?
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-2 leading-snug">
                  <span className="font-black text-slate-700">"{deleteConfirm.name}"</span>
                  {deleteConfirm.type === 'category'
                    ? ' will be removed. Products in this category will be moved to "Uncategorized".'
                    : ' will be permanently removed from the menu.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-sm rounded-2xl shadow-md shadow-rose-200 transition-transform active:scale-95 cursor-pointer">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
