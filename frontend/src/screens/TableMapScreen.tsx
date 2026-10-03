import React, { useState, useMemo } from 'react';
import { useCartStore } from '../store/cartStore';
import {
  Users, Clock, ArrowRightLeft, Check, Utensils,
  DollarSign, PieChart, Settings, User, X,
  ChevronRight, Armchair, Sparkles, Coffee
} from 'lucide-react';
import { useTableStore, DiningTable, Floor } from '../store/useTableStore';

// ─── Status config maps ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  AVAILABLE: {
    color: 'emerald',
    bg: 'bg-emerald-50',
    bgDark: 'bg-emerald-500',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    ring: 'ring-emerald-400',
    gradient: 'from-emerald-400 to-teal-500',
    icon: '✓',
    label: 'Available',
    actionLabel: 'Seat & Bill',
    pulse: false,
  },
  OCCUPIED: {
    color: 'rose',
    bg: 'bg-rose-50',
    bgDark: 'bg-rose-500',
    text: 'text-rose-700',
    border: 'border-rose-200',
    ring: 'ring-rose-400',
    gradient: 'from-rose-400 to-pink-500',
    icon: '●',
    label: 'Occupied',
    actionLabel: 'Open Folio',
    pulse: true,
  },
  RESERVED: {
    color: 'amber',
    bg: 'bg-amber-50',
    bgDark: 'bg-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-400',
    gradient: 'from-amber-400 to-orange-500',
    icon: '★',
    label: 'Reserved',
    actionLabel: 'Open Folio',
    pulse: false,
  },
  BILLED: {
    color: 'blue',
    bg: 'bg-blue-50',
    bgDark: 'bg-blue-500',
    text: 'text-blue-700',
    border: 'border-blue-200',
    ring: 'ring-blue-400',
    gradient: 'from-blue-400 to-indigo-500',
    icon: '₹',
    label: 'Billed',
    actionLabel: 'View Bill',
    pulse: false,
  },
} as const;

// ─── Floor zone icons ─────────────────────────────────────────────────────────
const ZONE_ICON: Record<string, React.ReactNode> = {
  AC: <Sparkles className="h-3 w-3" />,
  NON_AC: <Coffee className="h-3 w-3" />,
  OUTDOOR: <span className="text-[10px]">🌿</span>,
  VIP: <span className="text-[10px]">👑</span>,
  PARTY_HALL: <span className="text-[10px]">🎉</span>,
};

// ─── Table Card Component ─────────────────────────────────────────────────────
const TableCard: React.FC<{
  table: DiningTable;
  waiterName?: string;
  onSelect: () => void;
  onManage: (e: React.MouseEvent) => void;
  tables: DiningTable[];
}> = React.memo(({ table, waiterName, onSelect, onManage, tables }) => {
  const cfg = STATUS_CONFIG[table.status];
  const isAvailable = table.status === 'AVAILABLE';

  return (
    <button
      onClick={onSelect}
      className={`
        relative w-full text-left rounded-[24px] sm:rounded-[32px] overflow-hidden
        transition-all duration-300 active:scale-95 cursor-pointer select-none touch-manipulation
        shadow-sm hover:shadow-2xl hover:-translate-y-1.5 group
        flex flex-col border
        ${isAvailable 
          ? 'bg-white/70 backdrop-blur-2xl border-white/80 text-slate-800' 
          : `bg-gradient-to-br ${cfg.gradient} border-white/20 text-white shadow-xl shadow-${cfg.color}-500/20`}
      `}
    >
      {/* Glossy Top Glare (3D effect) */}
      {!isAvailable && (
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent opacity-60 pointer-events-none" />
      )}

      <div className="relative z-10 p-3 sm:p-4 flex flex-col h-full justify-between min-h-[110px] sm:min-h-[130px] w-full">
        {/* Header: Table No, Capacity, Settings */}
        <div className="flex justify-between items-start w-full">
           <div className="flex items-center gap-1 sm:gap-1.5">
             <div className={`text-2xl sm:text-3xl font-black tracking-tight leading-none drop-shadow-sm ${isAvailable ? 'text-slate-800' : 'text-white'}`}>
               T{table.number}
             </div>
             {cfg.pulse && (
               <div className="relative w-2 h-2 sm:w-2.5 sm:h-2.5 mb-2 shrink-0">
                 <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
                 <span className="absolute inset-0 rounded-full bg-white shadow-sm" />
               </div>
             )}
           </div>
           
           <div className="flex items-center gap-1.5 shrink-0">
             <div className={`flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-1 rounded-full border ${isAvailable ? 'bg-white/80 border-slate-200 shadow-sm text-slate-600' : 'bg-black/10 border-white/20 text-white backdrop-blur-md'}`}>
               <Users className="h-3 w-3 shrink-0" />
               {table.capacity}
             </div>
             <button 
               onClick={(e) => { e.stopPropagation(); onManage(e); }}
               className={`p-1 rounded-full transition-colors flex-shrink-0 border ${
                 isAvailable ? 'bg-white hover:bg-slate-100 text-slate-400 shadow-sm border-transparent' : 'bg-black/10 border-white/20 hover:bg-white/30 text-white backdrop-blur-md'
               }`}
             >
               <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
             </button>
           </div>
        </div>
        
        {/* Middle: Data & Status */}
        <div className="flex flex-col justify-end mt-1 mb-auto">
          {isAvailable ? (
             <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shrink-0" />
               <span className="text-xs sm:text-sm font-black text-emerald-600 tracking-wide uppercase truncate">Open</span>
             </div>
          ) : table.status === 'RESERVED' ? (
             <div className="flex items-center gap-1.5">
               <Clock className="h-3.5 w-3.5 shrink-0" />
               <span className="text-xs sm:text-sm font-black tracking-wide uppercase truncate">Reserved</span>
             </div>
          ) : table.mergedInto ? (
             <div className="flex flex-col w-full">
               <div className="flex items-center gap-1.5 mb-1 text-amber-500">
                 <ArrowRightLeft className="h-4 w-4 shrink-0" />
                 <span className="text-sm font-black tracking-wide truncate">Merged</span>
               </div>
               <span className="text-[10px] font-bold text-white/80 bg-black/20 px-2 py-1 rounded-lg w-fit">
                 Part of T{tables.find(t => t.id === table.mergedInto)?.number || '??'}
               </span>
             </div>
          ) : (
             <div className="flex flex-col w-full">
               <span className="text-xl sm:text-2xl font-black leading-none mb-1 shadow-black/10 drop-shadow-sm truncate tracking-tight">
                 ₹{(table.currentBill || 0).toLocaleString()}
               </span>
               <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 w-full">
                 {table.seatedTime && (
                   <span className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg border ${isAvailable ? 'bg-white/50 border-slate-200/50 text-slate-500' : 'bg-black/10 backdrop-blur-md border-white/10 text-white'}`}>
                     <Clock className="h-2.5 w-2.5 shrink-0 opacity-80" />
                     <span className="text-[9px] sm:text-[10px] font-black">
                       {(() => {
                         if (table.seatedTime === 'Just now') return 'Just now';
                         try {
                           const seated = new Date(table.seatedTime).getTime();
                           if (isNaN(seated)) return table.seatedTime;
                           const diffMinutes = Math.floor((Date.now() - seated) / 60000);
                           if (diffMinutes < 1) return 'Just now';
                           if (diffMinutes < 60) return `${diffMinutes}m`;
                           const hours = Math.floor(diffMinutes / 60);
                           const mins = diffMinutes % 60;
                           return `${hours}h ${mins}m`;
                         } catch (e) {
                           return table.seatedTime;
                         }
                       })()}
                     </span>
                   </span>
                 )}
                 {waiterName && (
                   <span className={`flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg border max-w-full ${isAvailable ? 'bg-white/50 border-slate-200/50 text-slate-500' : 'bg-black/10 backdrop-blur-md border-white/10 text-white'}`}>
                     <User className="h-2.5 w-2.5 shrink-0 opacity-80" />
                     <span className="text-[9px] sm:text-[10px] font-black truncate max-w-[60px] sm:max-w-[80px]">{waiterName}</span>
                   </span>
                 )}
               </div>
                {table.mergedWith && table.mergedWith.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {table.mergedWith.map(mId => (
                      <span key={mId} className="text-[9px] font-black bg-amber-500/90 border border-amber-400 text-white px-1.5 py-0.5 rounded shadow-sm">
                        + Merged
                      </span>
                    ))}
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Action Strip */}
        <div className={`mt-2 pt-2 border-t flex flex-wrap items-center justify-between gap-1 w-full ${isAvailable ? 'border-slate-200/60 text-slate-500' : 'border-white/20 text-white/90'}`}>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate min-w-[40px]">
            {cfg.label}
          </span>
          <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black group-hover:translate-x-1 transition-transform shrink-0">
            <span className="truncate max-w-[70px] sm:max-w-none">{cfg.actionLabel}</span>
            <ChevronRight className="h-2.5 w-2.5 shrink-0" />
          </span>
        </div>
      </div>
    </button>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const TableMapScreen: React.FC<{ onNavigateToPOS: () => void }> = ({ onNavigateToPOS }) => {
  const { tables, floors, setTableStatus, transferTable, mergeTable, unmergeTable } = useTableStore();
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const { setTable: setPosTable, heldOrders, resumeOrder } = useCartStore();

  const [, setTick] = useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000); // 30s update for time relative formatting
    return () => clearInterval(interval);
  }, []);

  const handleSelectForBilling = (table: DiningTable) => {
    // If merged into another table, route to the primary table
    const targetTable = table.mergedInto ? tables.find(t => t.id === table.mergedInto) || table : table;
    const existingOrder = heldOrders.find((o) => o.tableId === targetTable.id);
    if (existingOrder) {
      resumeOrder(existingOrder.id);
    } else {
      setPosTable(targetTable.id, targetTable.number);
    }
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
  };

  const handleMergeTable = () => {
    if (!selectedTable || !mergeTarget) return;
    const targetTable = tables.find(t => t.number === mergeTarget);
    if (targetTable) {
      mergeTable(selectedTable.id, targetTable.id);
    }
    setMergeTarget('');
    setSelectedTable(null); // Close modal
  };

  const handleUnmergeTable = () => {
    if (!selectedTable) return;
    unmergeTable(selectedTable.id);
    setSelectedTable(null);
  };

  // ─── Computed data ────────────────────────────────────────────────────────
  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.sortOrder - b.sortOrder), [floors]);

  const stats = useMemo(() => {
    const totalRevenue = tables.reduce((sum, t) => sum + (t.currentBill || 0), 0);
    const occupied = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILLED').length;
    const available = tables.filter((t) => t.status === 'AVAILABLE').length;
    const reserved = tables.filter((t) => t.status === 'RESERVED').length;
    const rate = tables.length ? Math.round((occupied / tables.length) * 100) : 0;
    return { totalRevenue, occupied, available, reserved, rate, total: tables.length };
  }, [tables]);

  const filteredTables = useMemo(() =>
    tables.filter((t) => {
      if (floorFilter !== 'ALL' && t.floorId !== floorFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      return true;
    }),
    [tables, floorFilter, statusFilter]
  );

  // Group tables by floor for sectioned view
  const tablesByFloor = useMemo(() => {
    const map = new Map<string, DiningTable[]>();
    filteredTables.forEach((t) => {
      const group = map.get(t.floorId) || [];
      group.push(t);
      map.set(t.floorId, group);
    });
    return map;
  }, [filteredTables]);

  const floorMap = useMemo(() => {
    const map = new Map<string, Floor>();
    floors.forEach((f) => map.set(f.id, f));
    return map;
  }, [floors]);

  // ─── Filter pills ────────────────────────────────────────────────────────
  const filterPills = [
    { key: 'ALL', label: 'All', count: tables.length },
    { key: 'AVAILABLE', label: 'Open', count: stats.available, color: 'emerald' },
    { key: 'OCCUPIED', label: 'Busy', count: stats.occupied, color: 'rose' },
    { key: 'RESERVED', label: 'Reserved', count: stats.reserved, color: 'amber' },
    { key: 'BILLED', label: 'Billed', count: tables.filter(t => t.status === 'BILLED').length, color: 'blue' },
  ];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] pb-20 lg:pb-0">
      {/* ─── Sticky Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/60 backdrop-blur-2xl border-b border-white/50 shadow-sm">
        {/* Title row */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] flex items-center justify-center shadow-sm">
              <Armchair className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 leading-tight">Floor Plan</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Tap a table to open billing</p>
            </div>
          </div>

          {/* Quick stats — desktop */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/60 shadow-sm">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-black text-slate-800">₹{stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/60 shadow-sm">
              <PieChart className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-black text-slate-700">{stats.rate}%</span>
              <span className="text-[10px] text-slate-400 font-medium">full</span>
            </div>
          </div>
        </div>

        {/* Mobile quick stats bar */}
        <div className="sm:hidden px-3 pb-3 flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-white/70 backdrop-blur-md rounded-xl py-2 border border-white/50 shadow-sm">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-black text-slate-800">₹{stats.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-white/70 backdrop-blur-md rounded-xl py-2 border border-white/50 shadow-sm">
            <PieChart className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-xs font-black text-slate-800">{stats.rate}% Seated</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 bg-white/70 backdrop-blur-md rounded-xl py-2 border border-white/50 shadow-sm">
            <Armchair className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-black text-slate-800">{stats.available} open</span>
          </div>
        </div>

        {/* Floor tabs + Status filter */}
        <div className="px-3 sm:px-5 pb-3 flex flex-col gap-3">
          {/* Floor tabs — horizontal scroll */}
          {sortedFloors.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1">
              <button
                onClick={() => setFloorFilter('ALL')}
                className={`shrink-0 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  floorFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-md scale-105'
                    : 'bg-white/60 backdrop-blur-md text-slate-600 border border-white/50 hover:bg-white/90 hover:text-slate-800'
                }`}
              >
                All Floors
              </button>
              {sortedFloors.map((floor) => (
                <button
                  key={floor.id}
                  onClick={() => setFloorFilter(floor.id)}
                  className={`shrink-0 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                    floorFilter === floor.id
                      ? 'bg-slate-800 text-white shadow-md scale-105'
                      : 'bg-white/60 backdrop-blur-md text-slate-600 border border-white/50 hover:bg-white/90 hover:text-slate-800'
                  }`}
                >
                  {ZONE_ICON[floor.zone] || null}
                  {floor.name}
                </button>
              ))}
            </div>
          )}

          {/* Status filter pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1">
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setStatusFilter(pill.key)}
                className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  statusFilter === pill.key
                    ? 'bg-white border-white shadow-md text-slate-800'
                    : 'bg-white/40 border-white/30 text-slate-600 hover:bg-white/60'
                }`}
              >
                {pill.key !== 'ALL' && (
                  <span className={`w-2.5 h-2.5 rounded-full shadow-sm bg-${pill.color}-500`} />
                )}
                {pill.label}
                <span className={`text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-md ${statusFilter === pill.key ? 'bg-slate-100 text-slate-600' : 'bg-white/50 text-slate-500'}`}>
                  {pill.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Table Grid (sectioned by floor) ───────────────────────────── */}
      <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-24 sm:pb-8 space-y-5 sm:space-y-6">
        {sortedFloors
          .filter((f) => floorFilter === 'ALL' || f.id === floorFilter)
          .map((floor) => {
            const floorTables = tablesByFloor.get(floor.id);
            if (!floorTables || floorTables.length === 0) return null;

            return (
              <section key={floor.id}>
                {/* Floor section header */}
                {(floorFilter === 'ALL' || sortedFloors.length === 1) && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold
                      bg-white border border-slate-200 text-slate-600 shadow-sm
                    `}>
                      {ZONE_ICON[floor.zone] || <Armchair className="h-3 w-3" />}
                      {floor.name}
                    </div>
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400">
                      {floorTables.length} table{floorTables.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Table cards grid */}
                <div className="grid grid-cols-2 min-[400px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-4 lg:gap-5">
                  {floorTables.map((table) => {
                    const activeOrder = heldOrders.find((o) => o.tableName === table.number);
                    return (
                      <TableCard
                        key={table.id}
                        table={table}
                        waiterName={activeOrder?.waiterName}
                        tables={tables}
                        onSelect={() => handleSelectForBilling(table)}
                        onManage={(e) => {
                          e.stopPropagation();
                          setSelectedTable(table);
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}

        {/* Empty state */}
        {filteredTables.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Armchair className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">No tables match the current filter</p>
            <button
              onClick={() => { setStatusFilter('ALL'); setFloorFilter('ALL'); }}
              className="mt-3 text-xs font-bold text-[#8cc63f] hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ─── Table Management Modal ────────────────────────────────────── */}
      {selectedTable && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl border-t sm:border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg
                  bg-gradient-to-br ${STATUS_CONFIG[selectedTable.status].gradient}
                `}>
                  {selectedTable.number}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Table {selectedTable.number}</h3>
                  <span className={`
                    text-[11px] font-bold uppercase tracking-wider
                    ${STATUS_CONFIG[selectedTable.status].text}
                  `}>
                    {STATUS_CONFIG[selectedTable.status].label} · {selectedTable.capacity} seats
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTable(null);
                  setTransferTarget('');
                  setMergeTarget('');
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Status toggles */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Change Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILLED'] as const).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isActive = selectedTable.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(selectedTable.id, st)}
                        className={`
                          py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer
                          flex items-center gap-2
                          ${isActive
                            ? `${cfg.bg} ${cfg.border} ${cfg.text} shadow-sm scale-[1.02]`
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                          }
                        `}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${isActive ? cfg.bgDark : 'bg-slate-300'}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table Transfer */}
              {selectedTable.status !== 'AVAILABLE' && !selectedTable.mergedInto && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
                      Transfer Order To
                    </label>
                    {transferTarget && (
                      <button
                        onClick={handleTransferTable}
                        className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-[10px] rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        Transfer to T{transferTarget}
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  
                  {tables.filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id).length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {tables
                        .filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id)
                        .map((t) => {
                          const isSelected = transferTarget === t.number;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setTransferTarget(t.number)}
                              className={`
                                py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 flex flex-col items-center justify-center gap-0.5
                                ${isSelected 
                                  ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm scale-[1.02]' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                                }
                              `}
                            >
                              <span>T{t.number}</span>
                              <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                                {t.capacity} <Users className="inline h-2 w-2" />
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400">No available tables to transfer to.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Table Merging */}
              {(selectedTable.mergedInto || (selectedTable.mergedWith && selectedTable.mergedWith.length > 0)) ? (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {selectedTable.mergedInto ? 'Merged Table' : 'Primary Merged Table'}
                    </label>
                    <button
                      onClick={handleUnmergeTable}
                      className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-black text-[10px] rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      Unmerge {selectedTable.mergedInto ? 'from Primary' : 'All Secondary Tables'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-amber-500" />
                      Merge with Table
                    </label>
                    {mergeTarget && (
                      <button
                        onClick={handleMergeTable}
                        className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[10px] rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        Merge T{mergeTarget}
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  
                  {tables.filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id && !t.mergedInto).length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[100px] overflow-y-auto pr-1">
                      {tables
                        .filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id && !t.mergedInto)
                        .map((t) => {
                          const isSelected = mergeTarget === t.number;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setMergeTarget(t.number)}
                              className={`
                                py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-2 flex flex-col items-center justify-center gap-0.5
                                ${isSelected 
                                  ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-sm scale-[1.02]' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                                }
                              `}
                            >
                              <span>T{t.number}</span>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400">No available tables to merge.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Primary CTA */}
            <div className="p-4 sm:p-5 pt-0">
              <button
                onClick={() => handleSelectForBilling(selectedTable)}
                className="w-full py-3.5 bg-gradient-to-r from-[#8cc63f] to-[#6a9a2a] hover:from-[#7ab036] hover:to-[#5d8c24] text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <Utensils className="h-4 w-4" />
                Open POS for Table {selectedTable.number}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Safe area spacer for mobile bottom sheet */}
            <div className="h-safe-bottom sm:hidden" />
          </div>
        </div>
      )}
    </div>
  );
};
