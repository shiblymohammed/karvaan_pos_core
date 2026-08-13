import React, { useState, useMemo, useRef } from 'react';
import { useMenuStore, Product, Category } from '../../store/useMenuStore';
import {
  Plus, Edit3, Trash2, X, Check, PowerOff, ChevronUp, ChevronDown,
  Search, LayoutGrid, UtensilsCrossed, Tag, Save, AlertCircle, ImagePlus, Trash
} from 'lucide-react';

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

const inputCls = 'w-full px-3 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent shadow-inner';
const labelCls = 'block text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1.5';

// ─── Product Form Modal ───────────────────────────────────────────────────────
interface ProductFormProps {
  initial?: Partial<Product>;
  categories: Category[];
  onSave: (data: Omit<Product, 'id' | 'isAvailable'>) => void;
  onClose: () => void;
  title: string;
}
const ProductForm: React.FC<ProductFormProps> = ({ initial, categories, onSave, onClose, title }) => {
  const [form, setForm] = useState<Partial<Product>>({
    name: '', price: 0, category: categories.find(c => c.name !== 'All')?.name || '',
    prepTime: 5, gstRate: 5, imageEmoji: '🍽️', description: '', imageUrl: '', ...initial
  });
  const nonAll = categories.filter(c => c.name !== 'All').sort((a, b) => a.sortOrder - b.sortOrder);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setForm({ ...form, imageUrl: dataUrl });
    } catch (err) {
      console.error('Image compression failed', err);
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    onSave(form as Omit<Product, 'id' | 'isAvailable'>);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-sidebar w-full max-w-lg rounded-2xl border border-pos-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-pos-border sticky top-0 bg-pos-sidebar z-10">
          <h3 className="text-xl font-black text-pos-text flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-emerald-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text cursor-pointer p-1 rounded-lg hover:bg-pos-card">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Emoji + Name row */}
          <div className="flex gap-3">
            <div className="w-20">
              <label className={labelCls}>Icon</label>
              <div className="relative">
                <select
                  value={form.imageEmoji}
                  onChange={e => setForm({ ...form, imageEmoji: e.target.value })}
                  className="w-full px-2 py-2.5 bg-pos-input border border-pos-border rounded-xl text-lg text-center focus:outline-none focus:border-pos-accent shadow-inner cursor-pointer"
                >
                  {EMOJI_PRESETS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Item Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="e.g. Garlic Bread" />
            </div>
          </div>

          {/* Image Upload Zone */}
          <div>
            <label className={labelCls}>Product Photo (optional)</label>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            {form.imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={form.imageUrl} alt="Preview" className="w-16 h-16 rounded-xl object-cover border-2 border-pos-border shadow-sm" />
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-pos-accent hover:underline cursor-pointer">Change Image</button>
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })}
                    className="text-xs font-bold text-rose-500 hover:underline cursor-pointer flex items-center gap-1">
                    <Trash className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-pos-border rounded-xl flex flex-col items-center gap-1 hover:border-pos-accent hover:bg-pos-card transition-colors cursor-pointer group">
                {uploading ? (
                  <span className="text-xs font-bold text-pos-text-muted animate-pulse">Compressing...</span>
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-pos-text-muted group-hover:text-pos-accent transition-colors" />
                    <span className="text-xs font-bold text-pos-text-muted group-hover:text-pos-accent">Click to upload photo</span>
                    <span className="text-[10px] text-pos-text-muted">JPG, PNG — auto-resized to 200×200</span>
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Price (₹) *</label>
              <input type="number" required min="0" value={form.price || ''}
                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className={inputCls} placeholder="150" />
            </div>
            <div>
              <label className={labelCls}>GST %</label>
              <input type="number" min="0" max="28" value={form.gstRate ?? 5}
                onChange={e => setForm({ ...form, gstRate: Number(e.target.value) })}
                className={inputCls} placeholder="5" />
            </div>
            <div>
              <label className={labelCls}>Prep (min)</label>
              <input type="number" min="0" value={form.prepTime || ''}
                onChange={e => setForm({ ...form, prepTime: Number(e.target.value) })}
                className={inputCls} placeholder="5" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Category *</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className={inputCls}>
              {nonAll.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.emoji} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-pos-border flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save Item
            </button>
          </div>
        </form>
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
  const [form, setForm] = useState<Partial<Category>>({ name: '', emoji: '🍽️', imageUrl: '', ...initial });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setForm({ ...form, imageUrl: dataUrl });
    } catch (err) {
      console.error('Image compression failed', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.name.trim()) return;
    onSave({ name: form.name.trim(), emoji: form.emoji, imageUrl: form.imageUrl });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-pos-border sticky top-0 bg-pos-sidebar z-10">
          <h3 className="text-xl font-black text-pos-text flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text cursor-pointer p-1 rounded-lg hover:bg-pos-card">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Live Preview */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-pos-border bg-pos-card">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <span className="text-2xl">{form.emoji}</span>
            )}
            <span className="font-black text-sm text-pos-text">{form.name || 'Category Preview'}</span>
          </div>

          <div className="flex gap-3">
            <div className="w-20">
              <label className={labelCls}>Emoji</label>
              <select value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })}
                className="w-full px-2 py-2.5 bg-pos-input border border-pos-border rounded-xl text-lg text-center focus:outline-none focus:border-pos-accent shadow-inner cursor-pointer">
                {EMOJI_PRESETS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
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
              <div className="flex items-center gap-3">
                <img src={form.imageUrl} alt="Preview" className="w-16 h-16 rounded-xl object-cover border-2 border-pos-border shadow-sm" />
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-pos-accent hover:underline cursor-pointer">Change Image</button>
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })}
                    className="text-xs font-bold text-rose-500 hover:underline cursor-pointer flex items-center gap-1">
                    <Trash className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-pos-border rounded-xl flex flex-col items-center gap-1 hover:border-pos-accent hover:bg-pos-card transition-colors cursor-pointer group">
                {uploading ? (
                  <span className="text-xs font-bold text-pos-text-muted animate-pulse">Compressing...</span>
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6 text-pos-text-muted group-hover:text-pos-accent transition-colors" />
                    <span className="text-xs font-bold text-pos-text-muted group-hover:text-pos-accent">Click to upload photo</span>
                    <span className="text-[10px] text-pos-text-muted">JPG, PNG — auto-resized to 200×200</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-pos-border flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2">
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
    addProduct, updateProduct, deleteProduct, toggleAvailability,
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
    <div className="h-full flex flex-col overflow-hidden bg-pos-bg">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-black text-pos-text">Menu Manager</h2>
            <p className="text-sm font-bold text-pos-text-muted mt-0.5">
              {products.length} items · {categories.length - 1} categories
            </p>
          </div>
          {activeTab === 'products' ? (
            <button onClick={() => setProductModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer text-sm">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          ) : (
            <button onClick={() => setCatModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer text-sm">
              <Plus className="h-4 w-4" /> Add Category
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-pos-card rounded-xl p-1 border border-pos-border w-fit mb-5">
          {([['products', 'Menu Items', UtensilsCrossed], ['categories', 'Categories', LayoutGrid]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id as Tab)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black transition-all cursor-pointer ${
                activeTab === id
                  ? 'bg-pos-accent text-white shadow-sm'
                  : 'text-pos-text-muted hover:text-pos-text'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Products Tab ─────────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
              <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-pos-card border border-pos-border rounded-xl text-sm font-bold text-pos-text focus:outline-none focus:border-pos-accent" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {sortedCategories.map(cat => (
                <button key={cat.id} onClick={() => setFilterCat(cat.name)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    filterCat === cat.name
                      ? 'bg-pos-accent text-white border-pos-accent'
                      : 'bg-pos-card border-pos-border text-pos-text-muted hover:border-pos-accent'
                  }`}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-pos-card rounded-2xl border border-pos-border overflow-hidden shadow-sm">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-pos-text-muted gap-3">
                <UtensilsCrossed className="h-12 w-12 opacity-20" />
                <p className="font-black text-lg">No items found</p>
                <p className="text-sm">Try a different search or category filter</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pos-sidebar border-b border-pos-border text-[11px] uppercase tracking-wider text-pos-text-muted">
                    <th className="py-3 px-4 font-black">Item</th>
                    <th className="py-3 px-4 font-black">Category</th>
                    <th className="py-3 px-4 font-black">Price</th>
                    <th className="py-3 px-4 font-black">GST</th>
                    <th className="py-3 px-4 font-black">Prep</th>
                    <th className="py-3 px-4 font-black text-center">Status</th>
                    <th className="py-3 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(prod => {
                    const catStyle = getCategoryStyle(prod.category);
                    return (
                      <tr key={prod.id} className="border-b border-pos-border/50 hover:bg-pos-card-hover transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-9 h-9 rounded-lg object-cover border border-pos-border shadow-sm" />
                            ) : (
                              <span className="text-xl">{prod.imageEmoji || '🍽️'}</span>
                            )}
                            <div>
                              <p className={`font-black text-sm text-pos-text ${!prod.isAvailable ? 'line-through opacity-50' : ''}`}>
                                {prod.name}
                              </p>
                              {prod.description && (
                                <p className="text-[10px] text-pos-text-muted truncate max-w-40">{prod.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {categories.find(c => c.name === prod.category)?.emoji} {prod.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-black text-emerald-600">₹{prod.price}</td>
                        <td className="py-3 px-4 text-xs font-bold text-pos-text-muted">{prod.gstRate ?? 5}%</td>
                        <td className="py-3 px-4 text-xs font-bold text-pos-text-muted">{prod.prepTime}m</td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => toggleAvailability(prod.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border ${
                              prod.isAvailable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-300'
                            }`}>
                            {prod.isAvailable ? <><Check className="h-3 w-3" /> In Stock</> : <><PowerOff className="h-3 w-3" /> 86'd</>}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setProductModal({ open: true, editing: prod })}
                              className="p-1.5 text-pos-text-muted hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm({ type: 'product', id: prod.id, name: prod.name })}
                              className="p-1.5 text-pos-text-muted hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Categories Tab ────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <p className="text-xs font-bold text-pos-text-muted mb-4">
            Categories appear in this order on the POS menu screen. Rename, recolour, or reorder them freely.
            Deleting a category moves its products to "Uncategorized".
          </p>

          <div className="space-y-2">
            {sortedCategories.map((cat, idx) => {
              const style = COLOR_MAP[cat.color || 'slate'] || COLOR_MAP['slate'];
              const productCount = products.filter(p => p.category === cat.name).length;
              const isAll = cat.name === 'All';

              return (
                <div key={cat.id}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${style.bg} ${style.border} transition-all`}>
                  {/* Drag handle / reorder */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => reorderCategory(cat.id, 'up')}
                      disabled={isAll || idx <= 1}
                      className="p-0.5 text-pos-text-muted hover:text-pos-text disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => reorderCategory(cat.id, 'down')}
                      disabled={isAll || idx === sortedCategories.length - 1}
                      className="p-0.5 text-pos-text-muted hover:text-pos-text disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Colour swatch */}
                  <div className={`w-3 h-10 rounded-full ${style.pill} shrink-0`} />

                  {/* Emoji + Name */}
                  <span className="text-2xl shrink-0">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-black text-base ${style.text}`}>{cat.name}</p>
                    <p className="text-[10px] text-pos-text-muted font-bold">
                      {isAll ? `${products.length} total items` : `${productCount} item${productCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>

                  {/* Sort order badge */}
                  <span className="text-[10px] font-black text-pos-text-muted bg-pos-card px-2 py-1 rounded-lg border border-pos-border">
                    #{cat.sortOrder}
                  </span>

                  {/* Action buttons */}
                  {!isAll && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCatModal({ open: true, editing: cat })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 hover:bg-white text-pos-text-muted hover:text-amber-500 rounded-xl text-xs font-black border border-pos-border/60 transition-all cursor-pointer">
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name })}
                        disabled={productCount > 0}
                        title={productCount > 0 ? `Move ${productCount} item(s) to another category first` : 'Delete category'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 hover:bg-rose-50 text-pos-text-muted hover:text-rose-500 rounded-xl text-xs font-black border border-pos-border/60 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Category CTA at bottom */}
          <button onClick={() => setCatModal({ open: true })}
            className="mt-4 w-full py-3 border-2 border-dashed border-pos-border rounded-2xl text-sm font-black text-pos-text-muted hover:text-pos-text hover:border-purple-400 hover:bg-purple-50/30 transition-all cursor-pointer flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Add New Category
          </button>
        </div>
      )}

      {/* ─── Product Modal ──────────────────────────────────────────────── */}
      {productModal.open && (
        <ProductForm
          initial={productModal.editing}
          categories={categories}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-sidebar rounded-2xl border border-pos-border shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-black text-pos-text">
                  Delete {deleteConfirm.type === 'product' ? 'Menu Item' : 'Category'}?
                </h3>
                <p className="text-sm text-pos-text-muted mt-1">
                  <span className="font-bold text-pos-text">"{deleteConfirm.name}"</span>
                  {deleteConfirm.type === 'category'
                    ? ' will be removed. Products in this category will be moved to "Uncategorized".'
                    : ' will be permanently removed from the menu.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl transition-colors cursor-pointer">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
