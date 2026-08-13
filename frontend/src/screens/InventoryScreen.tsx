import React, { useState } from 'react';
import { Package, AlertTriangle, Plus, ArrowDownLeft, ArrowUpRight, History, RefreshCcw, CheckCircle } from 'lucide-react';

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
  { id: 'inv-2', name: 'Whole Milk (Full Cream)', category: 'Dairy', currentStock: 8.0, unit: 'liters', minThreshold: 10.0, costPrice: 65 }, // Low stock!
  { id: 'inv-3', name: 'Mozzarella Cheese Block', category: 'Dairy', currentStock: 11.2, unit: 'kg', minThreshold: 4.0, costPrice: 480 },
  { id: 'inv-4', name: 'Chicken Breast (Fresh)', category: 'Meat', currentStock: 22.0, unit: 'kg', minThreshold: 8.0, costPrice: 280 },
  { id: 'inv-5', name: 'Paneer Cubes', category: 'Dairy', currentStock: 4.2, unit: 'kg', minThreshold: 5.0, costPrice: 350 }, // Low stock!
];

const INITIAL_LOGS = [
  { id: 'l1', item: 'Whole Milk (Full Cream)', type: 'OUT', qty: '-2.0 liters', time: '10m ago', notes: 'Automated POS recipe deduction' },
  { id: 'l2', item: 'Coffee Beans (Arabica)', type: 'IN', qty: '+5.0 kg', time: '2h ago', notes: 'Supplier delivery invoice #8841' },
  { id: 'l3', item: 'Mozzarella Cheese Block', type: 'OUT', qty: '-1.5 kg', time: '3h ago', notes: 'Automated POS recipe deduction' },
];

export const InventoryScreen: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>(INITIAL_INVENTORY);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjType, setAdjType] = useState<'IN' | 'OUT'>('IN');

  const handleStockAdjustment = () => {
    if (!selectedItem || !adjQty) return;
    const delta = adjType === 'IN' ? adjQty : -adjQty;

    setItems((prev) =>
      prev.map((i) => (i.id === selectedItem.id ? { ...i, currentStock: Math.max(0, i.currentStock + delta) } : i))
    );

    setLogs((prev) => [
      {
        id: `l-${Date.now()}`,
        item: selectedItem.name,
        type: adjType,
        qty: `${delta > 0 ? '+' : ''}${delta} ${selectedItem.unit}`,
        time: 'Just now',
        notes: 'Manual inventory adjustment via POS Terminal',
      },
      ...prev,
    ]);

    setSelectedItem(null);
    setAdjQty(0);
    setShowAddModal(false);
  };

  const handleQuickRestockAll = () => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.currentStock <= i.minThreshold) {
          const restockAmt = i.minThreshold * 2;
          return { ...i, currentStock: i.currentStock + restockAmt };
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
        notes: 'Automated emergency purchase restock command',
      },
      ...prev,
    ]);
    alert('✅ All low stock items have been topped up above safety thresholds!');
  };

  const lowStockItems = items.filter((i) => i.currentStock <= i.minThreshold);

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-pos-bg space-y-6 text-pos-text transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-pos-sidebar p-5 rounded-2xl border border-pos-border shadow-glass transition-colors duration-300">
        <div>
          <h2 className="text-xl font-extrabold text-pos-text flex items-center gap-2">
            <Package className="h-6 w-6 text-pos-accent" />
            <span>Recipe & Ingredient Inventory Management</span>
          </h2>
          <p className="text-xs text-pos-text-muted mt-0.5">
            Automated depletion tracking linked to POS checkout and manual stock restock logging.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {lowStockItems.length > 0 && (
            <button
              onClick={handleQuickRestockAll}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 rounded-xl font-bold transition-all text-xs shadow-2xs active:scale-95"
              title="Quickly restock all low stock ingredients"
            >
              <RefreshCcw className="h-4 w-4" />
              <span>Restock Low Items ({lowStockItems.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedItem(items[0]);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pos-accent to-teal-600 text-white font-extrabold rounded-xl transition-transform active:scale-95 text-sm shadow-glow-accent"
          >
            <Plus className="h-4 w-4" />
            <span>Log Stock In / Out</span>
          </button>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 ? (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 rounded-xl text-rose-600 shrink-0">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-rose-800">Low Stock Threshold Warning!</h3>
              <p className="text-xs text-rose-700 mt-0.5 font-medium">
                {lowStockItems.map((i) => i.name).join(', ')} dropped below minimum safety stock levels.
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 bg-rose-600 text-white rounded-lg whitespace-nowrap shadow-2xs self-start sm:self-center">
            Action Required ({lowStockItems.length})
          </span>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-emerald-800">All Ingredients Optimal</h3>
              <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                Every recipe item is stocked safely above minimum threshold requirements.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-600 text-white rounded-lg whitespace-nowrap">
            100% Healthy
          </span>
        </div>
      )}

      {/* Main Grid: Inventory Table & Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inventory Items Table (8 Cols) */}
        <div className="lg:col-span-8 bg-pos-sidebar rounded-2xl border border-pos-border shadow-glass overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-pos-border bg-pos-card font-extrabold text-sm text-pos-text flex items-center justify-between">
            <span>Active Ingredient Stock Levels</span>
            <span className="text-xs font-bold text-pos-text-muted">{items.length} Tracked SKUs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-pos-card text-[11px] uppercase text-pos-text-muted font-extrabold border-b border-pos-border">
                <tr>
                  <th className="p-4">Ingredient Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Current Stock</th>
                  <th className="p-4">Min Safety Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-border/50">
                {items.map((item) => {
                  const isLow = item.currentStock <= item.minThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-pos-card-hover transition-colors">
                      <td className="p-4 font-extrabold text-pos-text">{item.name}</td>
                      <td className="p-4 text-pos-text-muted text-xs font-semibold">{item.category}</td>
                      <td className="p-4 font-black text-base">
                        <span className={isLow ? 'text-rose-600 font-black' : 'text-emerald-600'}>
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="p-4 text-pos-text-muted text-xs font-semibold">
                        {item.minThreshold} {item.unit}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border shadow-2xs ${
                            isLow
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {isLow ? '⚠️ Low Stock' : '✅ Optimal'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowAddModal(true);
                          }}
                          className="text-xs px-3 py-1.5 bg-pos-bg hover:bg-pos-card text-pos-text font-extrabold rounded-lg border border-pos-border transition-colors shadow-2xs active:scale-95"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Stock Audit Log (4 Cols) */}
        <div className="lg:col-span-4 bg-pos-sidebar rounded-2xl border border-pos-border shadow-glass flex flex-col justify-between overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-pos-border bg-pos-card font-extrabold text-sm text-pos-text flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-pos-accent" />
              <span>Stock Audit Trail</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-pos-text-muted">Live Feed</span>
          </div>
          <div className="flex-1 p-4 space-y-2.5 overflow-y-auto max-h-[420px]">
            {logs.map((log) => (
              <div key={log.id} className="bg-pos-card p-3 rounded-xl border border-pos-border space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-pos-text truncate mr-2">{log.item}</span>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${
                      log.type === 'IN'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {log.type === 'IN' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {log.qty}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-pos-text-muted">{log.notes}</p>
                <p className="text-[10px] font-semibold text-pos-text-muted/70">{log.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADJUSTMENT MODAL */}
      {showAddModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-sidebar w-full max-w-sm rounded-2xl border border-pos-border p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-pos-text">Adjust Stock for: {selectedItem.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setAdjType('IN')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                  adjType === 'IN' ? 'bg-emerald-600 border-emerald-500 text-white scale-[1.02]' : 'bg-pos-card border-pos-border text-pos-text-muted hover:text-pos-text'
                }`}
              >
                + Stock In (Purchase)
              </button>
              <button
                onClick={() => setAdjType('OUT')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                  adjType === 'OUT' ? 'bg-rose-600 border-rose-500 text-white scale-[1.02]' : 'bg-pos-card border-pos-border text-pos-text-muted hover:text-pos-text'
                }`}
              >
                - Stock Out (Wastage)
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-pos-text-muted">Quantity Change ({selectedItem.unit}):</label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={adjQty || ''}
                onChange={(e) => setAdjQty(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-3 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm focus:outline-none focus:border-pos-accent font-bold shadow-inner"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-pos-bg text-pos-text-muted hover:text-pos-text rounded-xl text-sm font-bold border border-pos-border"
              >
                Cancel
              </button>
              <button
                onClick={handleStockAdjustment}
                className="px-4 py-2 bg-gradient-to-r from-pos-accent to-teal-600 text-white font-extrabold rounded-xl text-sm shadow-sm transition-transform active:scale-95"
              >
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
