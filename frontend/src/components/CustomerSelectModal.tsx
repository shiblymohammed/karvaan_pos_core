import React, { useState, useMemo } from 'react';
import { User, Phone, Search, Plus, X, ChevronRight, Check, Star, Sparkles } from 'lucide-react';
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
    <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-white/70 backdrop-blur-xl w-full max-w-md rounded-[24px] border border-white/50 shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white/40 border-b border-white/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] flex items-center justify-center shadow-md">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg leading-tight">Guest Profile</h3>
              <p className="text-xs font-bold text-slate-500">Attach to current order</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/50 hover:bg-white flex items-center justify-center text-slate-400 hover:text-rose-500 cursor-pointer transition-all shadow-sm">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Custom Pill Tabs */}
        <div className="p-4 bg-white/20">
          <div className="flex bg-slate-200/50 p-1 rounded-xl shadow-inner border border-slate-200/50">
            <button 
              onClick={() => setTab('NEW')} 
              className={`flex-1 py-2 text-xs font-black flex items-center justify-center gap-2 rounded-lg transition-all cursor-pointer ${tab === 'NEW' ? 'bg-white text-slate-800 shadow-sm border border-slate-100 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <Plus className="h-3.5 w-3.5" /> Quick Add
            </button>
            <button 
              onClick={() => setTab('EXISTING')} 
              className={`flex-1 py-2 text-xs font-black flex items-center justify-center gap-2 rounded-lg transition-all cursor-pointer ${tab === 'EXISTING' ? 'bg-white text-slate-800 shadow-sm border border-slate-100 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
            >
              <Search className="h-3.5 w-3.5" /> History ({allCustomers.length})
            </button>
          </div>
        </div>

        {/* NEW TAB */}
        {tab === 'NEW' && (
          <div className="px-6 pb-6 space-y-4">
            {/* Phone first for search-as-you-type */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Phone Number</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  value={newForm.phone}
                  onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="9876543210"
                  className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-slate-800 text-sm font-black focus:outline-none focus:bg-white focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 transition-all shadow-sm"
                  autoFocus
                />
              </div>

              {/* Live match found */}
              {phoneMatch && (
                <div className="mt-3 p-3 bg-[#f2f8eb] border border-[#8cc63f]/30 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
                  <p className="text-[9px] font-black text-[#6a9a2a] uppercase mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Auto-Matched Profile
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-sm text-slate-800">{phoneMatch.name}</p>
                      <p className="text-[10px] font-bold text-slate-500">{phoneMatch.visits} visits • ₹{phoneMatch.totalSpend.toFixed(0)} total</p>
                    </div>
                    <button
                      onClick={() => handleSelectExisting(phoneMatch)}
                      className="flex items-center gap-1 px-3 py-2 bg-[#8cc63f] hover:bg-[#78ad33] text-white text-[11px] font-black rounded-xl cursor-pointer transition-colors shadow-sm active:scale-95"
                    >
                      Use Profile <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Full Name</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={newForm.name}
                  onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-slate-800 text-sm font-black focus:outline-none focus:bg-white focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {currentCustomer && (
                <button onClick={() => { onSelect(null); onClose(); }} className="px-4 py-3 bg-rose-50 text-rose-500 hover:text-rose-600 hover:bg-rose-100 text-xs font-black rounded-2xl border border-rose-100 cursor-pointer transition-colors active:scale-95 shadow-sm">
                  Remove
                </button>
              )}
              <button onClick={handleNewSave} className="flex-1 py-3 bg-[#0d212b] text-[#b5ef85] hover:bg-[#153443] text-xs font-black rounded-2xl cursor-pointer transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2">
                <Check className="h-4 w-4" /> Save & Attach
              </button>
            </div>
          </div>
        )}

        {/* EXISTING TAB */}
        {tab === 'EXISTING' && (
          <div className="flex flex-col max-h-[460px]">
            <div className="px-6 pb-2">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={existingSearch}
                  onChange={e => setExistingSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-slate-800 text-sm font-black focus:outline-none focus:bg-white focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 transition-all shadow-sm placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-4 mt-2 no-scrollbar">
              {filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 bg-white/30 rounded-2xl border border-white/40 mx-2">
                  <User className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-black text-slate-500">{allCustomers.length === 0 ? 'No past customers yet' : 'No matches found'}</p>
                </div>
              ) : (
                <div className="space-y-2 mx-2">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.phone}
                      onClick={() => handleSelectExisting(c)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border ${
                        currentCustomer?.phone === c.phone
                          ? 'border-[#8cc63f]/40 bg-[#f2f8eb] shadow-md scale-[1.01]'
                          : 'border-white/50 bg-white/50 hover:bg-white shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg shrink-0 shadow-sm ${currentCustomer?.phone === c.phone ? 'bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-black text-sm truncate ${currentCustomer?.phone === c.phone ? 'text-[#0d212b]' : 'text-slate-700'}`}>{c.name}</p>
                          {c.visits >= 3 && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500">{c.phone} • {c.visits} {c.visits === 1 ? 'visit' : 'visits'}</p>
                      </div>
                      {currentCustomer?.phone === c.phone ? (
                        <div className="w-8 h-8 rounded-full bg-[#8cc63f] flex items-center justify-center shadow-inner shrink-0">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
