import React, { useState } from 'react';
import { useCartStore } from '../store/cartStore';
import { Users, Clock, ArrowRightLeft, Sparkles, Check, AlertCircle, Utensils, DollarSign, PieChart, Settings, User } from 'lucide-react';

import { useTableStore, DiningTable, Floor } from '../store/useTableStore';

export const TableMapScreen: React.FC<{ onNavigateToPOS: () => void }> = ({ onNavigateToPOS }) => {
  const { tables, floors, setTableStatus, transferTable } = useTableStore();
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const { setTable: setPosTable, heldOrders } = useCartStore();

  const handleSelectForBilling = (table: DiningTable) => {
    setPosTable(table.id, table.number);
    onNavigateToPOS();
  };

  const handleStatusChange = (tableId: string, newStatus: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BILLED') => {
    setTableStatus(tableId, newStatus);
    setSelectedTable((curr) => (curr?.id === tableId ? { ...curr, status: newStatus } : curr));
  };

  const handleTransferTable = () => {
    if (!selectedTable || !transferTarget) return;

    transferTable(selectedTable.id, transferTarget);
    
    setSelectedTable(null);
    setTransferTarget('');
    alert(`✅ Order successfully transferred from Table ${selectedTable.number} to Table ${transferTarget}!`);
  };

  // High-contrast, color-matched border accents for Light & Dark modes
  const statusBorderAccents = {
    AVAILABLE: 'border-t-4 border-t-emerald-500 hover:border-emerald-500',
    OCCUPIED: 'border-t-4 border-t-rose-500 hover:border-rose-500',
    RESERVED: 'border-t-4 border-t-amber-500 hover:border-amber-500',
    BILLED: 'border-t-4 border-t-blue-500 hover:border-blue-500',
  };

  const statusBadges = {
    AVAILABLE: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 font-extrabold',
    OCCUPIED: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/40 font-extrabold',
    RESERVED: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 font-extrabold',
    BILLED: 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-500/40 font-extrabold',
  };



  const totalSeatedRevenue = tables.reduce((sum, t) => sum + (t.currentBill || 0), 0);
  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILLED').length;
  const occupancyRate = Math.round((occupiedCount / tables.length) * 100);

  const filteredTables = tables.filter(t => {
    if (floorFilter !== 'ALL' && t.floorId !== floorFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const sortedFloors = [...floors].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-pos-bg space-y-6 text-pos-text transition-colors duration-300">
      {/* Top Header & Floor Revenue Summary */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-pos-sidebar p-5 rounded-2xl border border-pos-border shadow-glass transition-colors duration-300">
        <div>
          <h2 className="text-xl font-extrabold text-pos-text flex items-center gap-2">
            <span>🪑 Dining Room Floor Plan</span>
            <span className="text-xs px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-500/40 font-extrabold">
              Live Map
            </span>
          </h2>
          <p className="text-xs text-pos-text-muted mt-1">
            Click any table to pair with POS checkout folio or manage real-time seating status.
          </p>
        </div>

        {/* Floor Analytics Summary Pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-pos-card px-4 py-2 rounded-xl border border-pos-border shadow-2xs">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-pos-text-muted">Floor Revenue</div>
              <div className="text-sm font-black text-pos-text">₹{totalSeatedRevenue.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-pos-card px-4 py-2 rounded-xl border border-pos-border shadow-2xs">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-pos-text-muted">Occupancy</div>
              <div className="text-sm font-black text-pos-text">{occupancyRate}% Seated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Status Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-pos-card p-3 rounded-xl border border-pos-border shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-pos-text-muted mr-1">Filter Floor:</span>
          {['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm scale-[1.02]'
                  : 'bg-pos-bg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-pos-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 border border-pos-border'
              }`}
            >
              {st === 'ALL' ? 'All Tables' : st}
            </button>
          ))}
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap font-semibold">
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
          </span>
          <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Occupied
          </span>
          <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Billed
          </span>
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Reserved
          </span>
        </div>
      </div>

      {/* Table Layout Grid - 100% UX Friendly & Color Matched */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {filteredTables.map((table) => {
          const activeOrder = heldOrders.find(o => o.tableName === table.number);
          
          return (
          <div
            key={table.id}
            onClick={() => handleSelectForBilling(table)}
            className={`group relative bg-pos-card hover:bg-pos-card-hover p-5 rounded-2xl border border-pos-border cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[190px] shadow-sm hover:shadow-glass hover:-translate-y-1.5 ${
              statusBorderAccents[table.status]
            } ${selectedTable?.id === table.id ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-pos-bg' : ''}`}
          >
            {/* Top Row: Number & Capacity Badge */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-2xl font-black tracking-tight text-pos-text group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {table.number}
                </span>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl bg-pos-bg dark:bg-slate-800/50 text-pos-text-muted border border-pos-border shadow-inner group-hover:border-pos-accent/30 transition-colors">
                <Users className="h-3.5 w-3.5 text-pos-text-muted group-hover:text-pos-accent transition-colors" />
                <span>{table.capacity} Seats</span>
              </span>
            </div>

            {/* Middle: Bill & Timer info if occupied */}
            <div className="my-3 py-2 border-y border-pos-border/50">
              {table.status !== 'AVAILABLE' && table.currentBill ? (
                <div>
                  <div className="text-[10px] uppercase font-bold text-pos-text-muted">Current Folio:</div>
                  <div className={`text-xl font-black ${
                    table.status === 'OCCUPIED' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    ₹{table.currentBill}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-pos-text-muted font-bold mt-1">
                    <Clock className="h-3.5 w-3.5 text-pos-accent animate-pulse" />
                    <span>Seated {table.seatedTime}</span>
                  </div>
                  {activeOrder?.waiterName && (
                    <div className="flex items-center gap-1 text-[11px] text-pos-text-muted font-bold mt-0.5">
                      <User className="h-3.5 w-3.5" />
                      <span>{activeOrder.waiterName}</span>
                    </div>
                  )}
                </div>
              ) : table.status === 'RESERVED' ? (
                <div className="text-xs text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Reserved VIP Table</span>
                </div>
              ) : (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  <span>Ready for Guests</span>
                </div>
              )}
            </div>

            {/* Bottom Badge & One-Tap Action */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md ${statusBadges[table.status]}`}>
                  {table.status}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTable(table);
                  }}
                  className="p-1.5 rounded-lg bg-pos-bg hover:bg-pos-card border border-pos-border text-pos-text-muted hover:text-pos-text transition-colors shadow-2xs"
                  title="Manage Table Status"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectForBilling(table);
                }}
                className={`w-full py-2 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                  table.status === 'AVAILABLE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : table.status === 'OCCUPIED'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : table.status === 'BILLED'
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                <span>{table.status === 'AVAILABLE' ? 'Seat & Bill' : 'Open Folio'}</span>
                <span>→</span>
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {/* TABLE ACTION MODAL */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-pos-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-pos-text">Table {selectedTable.number}</span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${statusBadges[selectedTable.status]}`}>
                  {selectedTable.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="text-pos-text-muted hover:text-pos-text text-sm font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-pos-text-muted">Quick Table Actions & Seating Management:</p>
              
              {/* Status Toggles */}
              <div className="grid grid-cols-2 gap-2">
                {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(selectedTable.id, st)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all shadow-2xs cursor-pointer ${
                      selectedTable.status === st
                        ? st === 'AVAILABLE'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 scale-[1.02] shadow-sm'
                          : st === 'OCCUPIED'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 scale-[1.02] shadow-sm'
                          : st === 'BILLED'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300 scale-[1.02] shadow-sm'
                          : 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 scale-[1.02] shadow-sm'
                        : 'bg-pos-card border-pos-border text-pos-text-muted hover:text-pos-text hover:bg-pos-card-hover'
                    }`}
                  >
                    Set as {st}
                  </button>
                ))}
              </div>

              {/* Table Transfer */}
              {selectedTable.status !== 'AVAILABLE' && (
                <div className="pt-3 border-t border-pos-border space-y-2">
                  <label className="text-xs font-bold text-pos-text flex items-center gap-1.5">
                    <ArrowRightLeft className="h-4 w-4 text-pos-accent" />
                    <span>Transfer Order to Another Table:</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="flex-1 bg-pos-input border border-pos-border rounded-xl text-pos-text text-xs p-2.5 focus:outline-none focus:border-pos-accent font-medium shadow-inner"
                    >
                      <option value="">Select Target Table...</option>
                      {tables
                        .filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id)
                        .map((t) => (
                          <option key={t.id} value={t.number}>
                            Table {t.number} (Cap: {t.capacity})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleTransferTable}
                      disabled={!transferTarget}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      Transfer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Billing Button */}
            <div className="pt-2">
              <button
                onClick={() => handleSelectForBilling(selectedTable)}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl shadow-glow-accent transition-transform active:scale-95 cursor-pointer"
              >
                Open POS Billing for Table {selectedTable.number} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
