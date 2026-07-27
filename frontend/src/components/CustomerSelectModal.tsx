import React, { useState, useMemo } from 'react';
import { User, Phone, Search, Plus, X, ChevronRight, Check, Star } from 'lucide-react';
import { useLedgerStore } from '../store/useLedgerStore';

interface Props {
  currentCustomer: { name: string; phone: string } | null;
  onSelect: (customer: { name: string; phone: string } | null) => void;
  onClose: () => void;
}

export const CustomerSelectModal: React.FC<Props> = ({ currentCustomer, onSelect, onClose }) => {
  const { entries } = useLedgerStore();
  const [tab, setTab] = useState<'NEW' | 'EXISTING'>('NEW');
  const [newForm, setNewForm] = useState({ name: currentCustomer?.name || '', phone: currentCustomer?.phone || '' });
  const [existingSearch, setExistingSearch] = useState('');

  // Deduplicated customer list from ledger
  const allCustomers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; visits: number; totalSpend: number }>();
    entries.forEach(e => {
      const existing = map.get(e.customerPhone);
      if (existing) {
        existing.visits++;
        existing.totalSpend += e.amount;
      } else {
        map.set(e.customerPhone, { name: e.customerName, phone: e.customerPhone, visits: 1, totalSpend: e.amount });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
  }, [entries]);

  // Live phone match on NEW tab
  const phoneMatch = useMemo(() => {
    if (!newForm.phone || newForm.phone.length < 3) return null;
    return allCustomers.find(c => c.phone.includes(newForm.phone));
  }, [newForm.phone, allCustomers]);

  // Filtered existing customers
  const filteredCustomers = useMemo(() => {
    if (!existingSearch) return allCustomers;
    return allCustomers.filter(c =>
      c.name.toLowerCase().includes(existingSearch.toLowerCase()) ||
      c.phone.includes(existingSearch)
    );
  }, [existingSearch, allCustomers]);

  const handleNewSave = () => {
    if (!newForm.name.trim() && !newForm.phone.trim()) return;
    onSelect({ name: newForm.name.trim() || 'Guest', phone: newForm.phone.trim() });
    onClose();
  };

  const handleSelectExisting = (c: { name: string; phone: string }) => {
    onSelect(c);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pos-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-black text-pos-text text-base">Guest Details</h3>
          </div>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text cursor-pointer p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pos-border">
          <button onClick={() => setTab('NEW')} className={`flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${tab === 'NEW' ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'text-pos-text-muted hover:text-pos-text'}`}>
            <Plus className="h-3.5 w-3.5" /> New Customer
          </button>
          <button onClick={() => setTab('EXISTING')} className={`flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${tab === 'EXISTING' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'text-pos-text-muted hover:text-pos-text'}`}>
            <Search className="h-3.5 w-3.5" /> Existing ({allCustomers.length})
          </button>
        </div>

        {/* NEW TAB */}
        {tab === 'NEW' && (
          <div className="p-5 space-y-4">
            {/* Phone first for search-as-you-type */}
            <div>
              <label className="text-[11px] font-black text-pos-text-muted uppercase tracking-wide mb-1.5 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
                <input
                  type="tel"
                  value={newForm.phone}
                  onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="9876543210"
                  className="w-full pl-9 pr-3 py-2.5 bg-pos-bg border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Live match found */}
              {phoneMatch && (
                <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1.5 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Existing customer found!
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-sm text-pos-text">{phoneMatch.name}</p>
                      <p className="text-[10px] text-pos-text-muted">{phoneMatch.visits} visits · ₹{phoneMatch.totalSpend.toFixed(0)} total</p>
                    </div>
                    <button
                      onClick={() => handleSelectExisting(phoneMatch)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl cursor-pointer transition-colors"
                    >
                      Select <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-black text-pos-text-muted uppercase tracking-wide mb-1.5 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
                <input
                  type="text"
                  value={newForm.name}
                  onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-9 pr-3 py-2.5 bg-pos-bg border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {currentCustomer && (
                <button onClick={() => { onSelect(null); onClose(); }} className="px-3 py-2 bg-red-50 dark:bg-red-950/20 text-red-500 text-xs font-black rounded-xl border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                  Remove Guest
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2 bg-pos-bg text-pos-text-muted text-xs font-bold rounded-xl border border-pos-border cursor-pointer hover:text-pos-text transition-colors">
                Cancel
              </button>
              <button onClick={handleNewSave} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl cursor-pointer transition-colors shadow-sm active:scale-95">
                Save Guest
              </button>
            </div>
          </div>
        )}

        {/* EXISTING TAB */}
        {tab === 'EXISTING' && (
          <div className="flex flex-col max-h-[420px]">
            <div className="p-4 border-b border-pos-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
                <input
                  type="text"
                  value={existingSearch}
                  onChange={e => setExistingSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-3 py-2 bg-pos-bg border border-pos-border rounded-xl text-sm font-bold text-pos-text focus:outline-none focus:border-blue-500 placeholder:text-pos-text-muted"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-pos-text-muted">
                  <User className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm font-bold">{allCustomers.length === 0 ? 'No past customers yet' : 'No match found'}</p>
                </div>
              ) : (
                filteredCustomers.map(c => (
                  <button
                    key={c.phone}
                    onClick={() => handleSelectExisting(c)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-pos-bg transition-colors cursor-pointer mb-1 border ${
                      currentCustomer?.phone === c.phone
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-black text-sm text-pos-text">{c.name}</p>
                        {c.visits >= 3 && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-[11px] text-pos-text-muted">{c.phone} · {c.visits} {c.visits === 1 ? 'visit' : 'visits'}</p>
                    </div>
                    {currentCustomer?.phone === c.phone ? (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-pos-text-muted shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
