import React, { useState } from 'react';
import { Settings2, Plus, Trash2, Tag, Percent, MessageSquare, PackagePlus } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAddonStore } from '../../store/useAddonStore';

export const AdminSettingsManager: React.FC = () => {
  const { notes, discounts, addNote, deleteNote, addDiscount, deleteDiscount } = useSettingsStore();
  const { addons, addAddon, deleteAddon } = useAddonStore();

  const [newNote, setNewNote] = useState({ label: '', icon: '' });
  const [newDiscount, setNewDiscount] = useState({ label: '', amount: '', type: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT' });
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });

  const handleAddNote = () => {
    if (!newNote.label) return;
    addNote(newNote);
    setNewNote({ label: '', icon: '' });
  };

  const handleAddDiscount = () => {
    if (!newDiscount.label || !newDiscount.amount) return;
    addDiscount({
      label: newDiscount.label,
      amount: Number(newDiscount.amount),
      type: newDiscount.type
    });
    setNewDiscount({ label: '', amount: '', type: 'PERCENTAGE' });
  };

  const handleAddAddon = () => {
    if (!newAddon.name || !newAddon.price) return;
    addAddon({
      name: newAddon.name,
      price: Number(newAddon.price),
      isActive: true
    });
    setNewAddon({ name: '', price: '' });
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-pos-bg">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-pos-text">POS Settings & Quick-Keys</h2>
        <p className="text-sm font-bold text-pos-text-muted mt-1">Configure quick notes and predefined discount amounts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QUICK NOTES */}
        <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-black text-pos-text">Predefined Order Notes</h3>
          </div>
          
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Icon (e.g. 🔥)"
              value={newNote.icon}
              onChange={e => setNewNote({ ...newNote, icon: e.target.value })}
              className="w-20 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text text-center focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Note Label (e.g. Extra Spicy)"
              value={newNote.label}
              onChange={e => setNewNote({ ...newNote, label: e.target.value })}
              className="flex-1 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleAddNote} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors shadow-glow-accent cursor-pointer">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {notes.map(note => (
              <div key={note.id} className="flex items-center gap-2 bg-pos-bg border border-pos-border rounded-lg px-3 py-1.5 shadow-2xs">
                <span className="text-sm">{note.icon}</span>
                <span className="text-sm font-bold text-pos-text">{note.label}</span>
                <button onClick={() => deleteNote(note.id)} className="ml-2 text-pos-text-muted hover:text-rose-500 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* PREDEFINED DISCOUNTS */}
        <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-black text-pos-text">Predefined Discounts</h3>
          </div>
          
          <div className="flex gap-2 mb-6">
            <select
              value={newDiscount.type}
              onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value as 'PERCENTAGE' | 'FLAT' })}
              className="w-28 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text text-xs font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="PERCENTAGE">% Off</option>
              <option value="FLAT">Flat ₹</option>
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={newDiscount.amount}
              onChange={e => setNewDiscount({ ...newDiscount, amount: e.target.value })}
              className="w-24 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Label (e.g. VIP)"
              value={newDiscount.label}
              onChange={e => setNewDiscount({ ...newDiscount, label: e.target.value })}
              className="flex-1 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleAddDiscount} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors shadow-glow-accent cursor-pointer">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {discounts.map(discount => (
              <div key={discount.id} className="flex items-center justify-between bg-pos-bg border border-pos-border rounded-lg px-4 py-2 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-black text-xs">
                    {discount.type === 'PERCENTAGE' ? '%' : '₹'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-pos-text">{discount.label}</h4>
                    <p className="text-xs font-bold text-pos-text-muted">{discount.type === 'PERCENTAGE' ? `${discount.amount}%` : `₹${discount.amount}`} Off</p>
                  </div>
                </div>
                <button onClick={() => deleteDiscount(discount.id)} className="text-pos-text-muted hover:text-rose-500 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* PAID ADD-ONS */}
        <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PackagePlus className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-black text-pos-text">Paid Add-ons</h3>
          </div>
          
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Name (e.g. Extra Mayo)"
              value={newAddon.name}
              onChange={e => setNewAddon({ ...newAddon, name: e.target.value })}
              className="flex-1 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              placeholder="₹ Price"
              value={newAddon.price}
              onChange={e => setNewAddon({ ...newAddon, price: e.target.value })}
              className="w-24 bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleAddAddon} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors shadow-glow-accent cursor-pointer">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {addons.map(addon => (
              <div key={addon.id} className="flex items-center justify-between bg-pos-bg border border-pos-border rounded-lg px-4 py-2 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-pos-text">{addon.name}</h4>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+₹{addon.price}</p>
                  </div>
                </div>
                <button onClick={() => deleteAddon(addon.id)} className="text-pos-text-muted hover:text-rose-500 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
