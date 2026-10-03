import React, { useState, useMemo } from 'react';
import { Package, AlertTriangle, Plus, Minus, ArrowDownLeft, ArrowUpRight, History, RefreshCcw, CheckCircle2, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  costPrice: number;
}

const INITIAL_INVENTORY: StockItem[] = [
  { id: 'inv-1', name: 'Coffee Beans (Arabica)', category: 'Dry Pantry', currentStock: 14.5, unit: 'kg', minThreshold: 3.0, costPrice: 1200 },
  { id: 'inv-2', name: 'Whole Milk (Full Cream)', category: 'Dairy', currentStock: 8.0, unit: 'liters', minThreshold: 10.0, costPrice: 65 },
  { id: 'inv-3', name: 'Mozzarella Cheese Block', category: 'Dairy', currentStock: 11.2, unit: 'kg', minThreshold: 4.0, costPrice: 480 },
  { id: 'inv-4', name: 'Chicken Breast (Fresh)', category: 'Meat', currentStock: 22.0, unit: 'kg', minThreshold: 8.0, costPrice: 280 },
  { id: 'inv-5', name: 'Paneer Cubes', category: 'Dairy', currentStock: 4.2, unit: 'kg', minThreshold: 5.0, costPrice: 350 },
  { id: 'inv-6', name: 'Almonds', category: 'Dry Pantry', currentStock: 1.5, unit: 'kg', minThreshold: 2.0, costPrice: 850 },
  { id: 'inv-7', name: 'Tomatoes', category: 'Produce', currentStock: 5.0, unit: 'kg', minThreshold: 8.0, costPrice: 40 },
];

const INITIAL_LOGS = [
  { id: 'l1', item: 'Whole Milk (Full Cream)', type: 'OUT', qty: '-2.0 liters', time: '10m ago', notes: 'Automated POS recipe deduction' },
  { id: 'l2', item: 'Coffee Beans (Arabica)', type: 'IN', qty: '+5.0 kg', time: '2h ago', notes: 'Supplier delivery invoice #8841' },
  { id: 'l3', item: 'Mozzarella Cheese Block', type: 'OUT', qty: '-1.5 kg', time: '3h ago', notes: 'Automated POS recipe deduction' },
];

const categoryEmoji: Record<string, string> = {
  'Dry Pantry': '🌾',
  'Dairy': '🥛',
  'Meat': '🥩',
  'Produce': '🥦',
  'Spices': '🌶️',
};

export const InventoryScreen: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>(INITIAL_INVENTORY);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  
  // Modals & State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category)))];

  const filteredItems = useMemo(() => {
    if (activeCategory === 'All') return items;
    return items.filter(i => i.category === activeCategory);
  }, [items, activeCategory]);

  const lowStockItems = items.filter((i) => i.currentStock <= i.minThreshold);

  const performAdjustment = (item: StockItem, type: 'IN' | 'OUT', amount: number, note: string) => {
    if (amount <= 0) return;
    const delta = type === 'IN' ? amount : -amount;
    
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, currentStock: Math.max(0, i.currentStock + delta) } : i))
    );
    
    setLogs((prev) => [
      {
        id: `l-${Date.now()}-${Math.random()}`,
        item: item.name,
        type,
        qty: `${delta > 0 ? '+' : ''}${delta} ${item.unit}`,
        time: 'Just now',
        notes: note,
      },
      ...prev,
    ]);
  };

  const handleModalSubmit = () => {
    if (!selectedItem || !adjQty) return;
    performAdjustment(selectedItem, adjType, adjQty, 'Manual POS terminal entry');
    setSelectedItem(null);
    setAdjQty(0);
    setShowAddModal(false);
  };

  const handleQuickAction = (item: StockItem, type: 'IN' | 'OUT') => {
    // Quick adjust by 1 unit
    performAdjustment(item, type, 1, 'Quick action button');
  };

  const handleQuickRestockAll = () => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.currentStock <= i.minThreshold) {
          return { ...i, currentStock: i.currentStock + i.minThreshold * 2 };
        }
        return i;
      })
    );
    setLogs((prev) => [
      {
        id: `l-restock-${Date.now()}`,
        item: 'All Low Stock Ingredients',
        type: 'IN',
        qty: '+ Auto Top-up',
        time: 'Just now',
        notes: 'Emergency auto-restock triggered',
      },
      ...prev,
    ]);
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] transition-colors duration-300">
      <style>{`
        @keyframes wave {
          0% { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
      `}</style>
      
      {/* ─── Compact Header ──────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-2 flex-shrink-0 z-10 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-[14px] flex items-center justify-center border border-indigo-200/60 shadow-sm shrink-0">
              <Package className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">
                Stock Inventory
              </h1>
              <p className="text-xs font-bold text-slate-500">
                Track ingredients & prevent stockouts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowLogsModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white backdrop-blur-md border border-slate-200/80 rounded-[16px] text-slate-700 font-black text-xs shadow-sm transition-all active:scale-95"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>
            <button
              onClick={() => { setSelectedItem(items[0]); setShowAddModal(true); }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] rounded-[16px] font-black text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Log Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Scrolling Content Area ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24 sm:pb-6 relative space-y-6 hide-scrollbar">
        
        {/* KPI / Alert Row */}
        <AnimatePresence mode="wait">
          {lowStockItems.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-2 p-4 rounded-[24px] bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-rose-400 to-rose-600" />
              
              <div className="flex items-center gap-4 pl-2">
                <div className="w-12 h-12 rounded-[20px] bg-rose-50 border border-rose-200 shadow-sm flex items-center justify-center text-rose-600 shrink-0 relative">
                  <div className="absolute inset-0 bg-rose-400/20 rounded-[20px] animate-ping" />
                  <AlertTriangle className="h-6 w-6 relative z-10" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-800 tracking-tight">Critical Stock Alert</h3>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    <span className="text-rose-700 font-black px-1.5 py-0.5 bg-rose-100/80 rounded-md border border-rose-200/50 mr-1.5 shadow-sm">{lowStockItems.length}</span>
                    {lowStockItems.length === 1 ? 'item requires' : 'items require'} immediate attention
                  </p>
                </div>
              </div>

              <button
                onClick={handleQuickRestockAll}
                className="px-5 py-3 bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black text-sm rounded-[16px] shadow-[0_4px_12px_rgba(244,63,94,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap border border-rose-400/50"
              >
                <RefreshCcw className="h-4 w-4" />
                Quick Restock All
              </button>
            </motion.div>
          ) : (
             <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mt-2 p-4 rounded-[24px] bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,1)] flex items-center gap-4 relative overflow-hidden"
             >
                <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                <div className="w-12 h-12 rounded-[20px] bg-emerald-50 border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-600 shrink-0 ml-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-800 tracking-tight">All Systems Go</h3>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    All inventory levels are optimal. No immediate restocks needed.
                  </p>
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Categories Horizontal Scroll */}
        <div className="flex items-center overflow-x-auto hide-scrollbar pb-6 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 relative">
          <div className="flex items-center bg-white/20 backdrop-blur-xl p-1.5 rounded-[24px] shadow-[inset_0_1px_1px_rgba(255,255,255,1)] border border-white/60 gap-1 min-w-max">
            <div className="pl-3 pr-2 flex items-center justify-center shrink-0 border-r border-white/30 mr-1">
              <Filter className="h-4 w-4 text-slate-500" />
            </div>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`relative px-5 py-2.5 rounded-[16px] text-xs font-black whitespace-nowrap transition-colors z-10 flex items-center gap-2 ${
                  activeCategory === cat
                    ? 'text-slate-800'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {activeCategory === cat && (
                  <motion.div
                    layoutId="activeCategoryInventory"
                    className="absolute inset-0 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/50 rounded-[16px] -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {cat !== 'All' && <span className="opacity-90 text-sm leading-none drop-shadow-sm">{categoryEmoji[cat]}</span>}
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Masonry-like modern Grid for items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
          <AnimatePresence>
            {filteredItems.map((item) => {
              const isLow = item.currentStock <= item.minThreshold;
              const ratio = item.currentStock / (item.minThreshold || 1);
              const isCritical = ratio <= 1;
              const isWarning = ratio > 1 && ratio <= 1.5;
              
              // Colors for styling
              const accentColor = isCritical ? 'rose' : isWarning ? 'amber' : 'emerald';
              const accentColorHex = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';
              
              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative overflow-hidden bg-white/10 backdrop-blur-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.8)] ring-1 ring-white/50 rounded-[32px] p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group flex flex-col min-h-[220px]"
                >
                  {/* Water Fill Progress Background */}
                  <div 
                    className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-in-out z-0 overflow-hidden pointer-events-none rounded-[32px]"
                    style={{ height: `${Math.min(100, (item.currentStock / (item.minThreshold * 3)) * 100)}%` }}
                  >
                    <div 
                      className="absolute inset-0 backdrop-blur-md" 
                      style={{ backgroundColor: accentColorHex, opacity: 0.2 }}
                    />
                    <div 
                      className="absolute left-0 w-[200%] -top-[23px] h-[24px] pointer-events-none animate-[wave_3s_linear_infinite]"
                      style={{ color: accentColorHex, opacity: 0.35 }}
                    >
                      <svg className="w-full h-full" viewBox="0 0 2400 120" preserveAspectRatio="none" fill="currentColor">
                        <path d="M0,60 C150,120 300,0 600,60 C900,120 1050,0 1200,60 L1200,120 L0,120 Z" />
                        <path transform="translate(1200,0)" d="M0,60 C150,120 300,0 600,60 C900,120 1050,0 1200,60 L1200,120 L0,120 Z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Content Layer (on top of water) */}
                  <div className="relative z-10 flex flex-col h-full">
                    
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-[16px] bg-white/20 backdrop-blur-xl border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] flex items-center justify-center text-xl">
                          {categoryEmoji[item.category] || '📦'}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 bg-white/20 backdrop-blur-xl border border-white/40 px-2.5 py-1 rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                          {item.category}
                        </span>
                      </div>
                      
                      {isCritical ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/80 backdrop-blur-md border border-rose-400 text-white text-[10px] font-black shadow-sm">
                          <AlertTriangle className="h-3 w-3" /> LOW
                        </span>
                      ) : isWarning ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/80 backdrop-blur-md border border-amber-400 text-white text-[10px] font-black shadow-sm">
                          WARN
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/80 backdrop-blur-md border border-emerald-400 text-white text-[10px] font-black shadow-sm">
                          OK
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-black text-slate-800 text-base leading-tight mb-auto mt-2 mix-blend-multiply pr-4">{item.name}</h3>

                    {/* Bottom Row */}
                    <div className="flex items-end justify-between mt-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-0.5 mix-blend-multiply">In Stock</p>
                        <div className="flex items-baseline gap-1 mix-blend-multiply">
                          <span className="text-4xl font-black tracking-tighter leading-none text-slate-900">
                            {item.currentStock.toFixed(1)}
                          </span>
                          <span className="text-sm font-bold text-slate-700">{item.unit}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-600 mt-1 mix-blend-multiply">Min: {item.minThreshold.toFixed(1)} {item.unit}</p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuickAction(item, 'IN')}
                          className="w-12 h-12 rounded-[20px] bg-white/20 hover:bg-white/40 backdrop-blur-xl border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] flex flex-col items-center justify-center text-slate-800 transition-all active:scale-95 group/btn"
                        >
                          <Plus className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[8px] font-black uppercase mt-0.5">Quick</span>
                        </button>
                        <button
                          onClick={() => { setSelectedItem(item); setAdjType('OUT'); setShowAddModal(true); }}
                          className="w-12 h-12 rounded-[20px] bg-slate-800/60 hover:bg-slate-800/80 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center text-[#b5ef85] transition-all active:scale-95 group/btn"
                        >
                          <ArrowUpRight className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                          <span className="text-[8px] font-black uppercase mt-0.5">Adj</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────── */}
      
      {/* 1. Add/Adjust Modal */}
      <AnimatePresence>
        {showAddModal && selectedItem && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] border border-white/80 p-6 space-y-6 shadow-[0_32px_80px_rgba(0,0,0,0.15)] z-10"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-lg">Detailed Entry</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Selected Item Info Box */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-[24px] flex items-center gap-4">
                <div className="w-12 h-12 rounded-[16px] bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-sm shrink-0">
                  {categoryEmoji[selectedItem.category] || '📦'}
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800 mb-0.5">{selectedItem.name}</p>
                  <p className="text-xs font-bold text-slate-600">Current: <span className="text-slate-800 font-black">{selectedItem.currentStock} {selectedItem.unit}</span></p>
                </div>
              </div>

              {/* IN/OUT Toggle */}
              <div className="flex bg-slate-100 p-1.5 rounded-[20px] border border-slate-200/50">
                {(['IN', 'OUT'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAdjType(t)}
                    className={`flex-1 py-2.5 rounded-[16px] text-xs font-black transition-all ${
                      adjType === t
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t === 'IN' ? 'Stock In (+)' : 'Stock Out (-)'}
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Amount to adjust ({selectedItem.unit})</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={adjQty === 0 ? '' : adjQty}
                    onChange={(e) => setAdjQty(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 shadow-sm rounded-[20px] text-slate-800 text-base focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 font-black transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none">
                    {selectedItem.unit}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={handleModalSubmit}
                disabled={!adjQty}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-[#b5ef85] font-black rounded-[20px] text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Save Adjustment
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Audit Logs Modal */}
      <AnimatePresence>
        {showLogsModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogsModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.15)] border border-white/80 flex flex-col max-h-[85vh] z-10 overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center text-slate-700">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">Audit Trail</h3>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Logs
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowLogsModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 no-scrollbar bg-slate-50/50">
                {logs.length === 0 ? (
                  <p className="text-center text-sm font-bold text-slate-500 py-10">No recent activity.</p>
                ) : (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative bg-white rounded-[24px] p-4 pb-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group overflow-hidden flex flex-col gap-3"
                    >
                      {/* Modern left indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-2 ${log.type === 'IN' ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' : 'bg-gradient-to-b from-rose-400 to-rose-600'} transition-all group-hover:w-3`} />
                      
                      <div className="pl-3 flex items-start justify-between">
                        <div className="flex flex-col gap-1 pr-2">
                          <h4 className="font-black text-slate-800 text-base leading-tight">{log.item}</h4>
                          <p className="text-xs font-bold text-slate-500 leading-snug">{log.notes}</p>
                        </div>
                        
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[16px] border shrink-0 ${
                          log.type === 'IN' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-[inset_0_1px_1px_rgba(255,255,255,1)]' 
                            : 'bg-rose-50 border-rose-200 text-rose-700 shadow-[inset_0_1px_1px_rgba(255,255,255,1)]'
                        }`}>
                          {log.type === 'IN' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          <span className="font-black text-sm">{log.qty}</span>
                        </div>
                      </div>
                      
                      <div className="pl-3 flex items-center justify-between mt-1 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {log.time}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${log.type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {log.type === 'IN' ? 'STOCK IN' : 'STOCK OUT'}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
