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
}> = React.memo(({ table, waiterName, onSelect, onManage }) => {
  const cfg = STATUS_CONFIG[table.status];

  return (
    <button
      onClick={onSelect}
      className={`
        group relative w-full text-left rounded-2xl sm:rounded-[20px]
        bg-white border-2 transition-all duration-200
        active:scale-[0.97] cursor-pointer select-none touch-manipulation
        hover:shadow-lg hover:-translate-y-0.5
        ${cfg.border}
        ${table.status !== 'AVAILABLE' ? 'shadow-md' : 'shadow-sm'}
      `}
    >
      {/* Status accent bar */}
      <div className={`absolute top-0 left-3 right-3 h-1 rounded-b-full bg-gradient-to-r ${cfg.gradient}`} />

      <div className="p-3 sm:p-4">
        {/* Row 1: Table number + capacity */}
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <div className={`
              w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-white text-sm sm:text-base
              bg-gradient-to-br ${cfg.gradient} shadow-sm
            `}>
              {table.number}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`
              flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg
              ${cfg.bg} ${cfg.text}
            `}>
              <Users className="h-3 w-3" />
              {table.capacity}
            </span>

            <button
              onClick={onManage}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Manage Table"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Status-specific content */}
        <div className="min-h-[40px] sm:min-h-[48px] flex flex-col justify-center">
          {table.status === 'AVAILABLE' ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-emerald-600">Ready for guests</span>
            </div>
          ) : table.status === 'RESERVED' ? (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs sm:text-sm font-bold text-amber-600">Reserved</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className={`text-lg sm:text-xl font-black ${table.status === 'OCCUPIED' ? 'text-rose-600' : 'text-blue-600'}`}>
                ₹{(table.currentBill || 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {table.seatedTime && (
                  <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-semibold">
                    <Clock className="h-3 w-3" />
                    {table.seatedTime}
                  </span>
                )}
                {waiterName && (
                  <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-semibold">
                    <User className="h-3 w-3" />
                    {waiterName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Action strip */}
        <div className={`
          mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-100
          flex items-center justify-between
        `}>
          <span className={`
            text-[10px] sm:text-[11px] font-black uppercase tracking-wider
            px-2 py-0.5 rounded-md
            ${cfg.bg} ${cfg.text}
          `}>
            {cfg.label}
          </span>

          <span className={`
            flex items-center gap-1 text-[11px] sm:text-xs font-bold
            ${cfg.text} group-hover:gap-2 transition-all
          `}>
            {cfg.actionLabel}
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Occupied pulse ring effect */}
      {cfg.pulse && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-30" />
          <span className="absolute inset-0 rounded-full bg-rose-500" />
        </div>
      )}
    </button>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
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
    <div className="h-full overflow-y-auto bg-[#f5f3ee]">
      {/* ─── Sticky Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#f5f3ee]/95 backdrop-blur-md border-b border-slate-200/60">
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
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-black text-slate-700">₹{stats.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <PieChart className="h-3.5 w-3.5 text-teal-500" />
              <span className="text-xs font-black text-slate-700">{stats.rate}%</span>
              <span className="text-[10px] text-slate-400 font-medium">full</span>
            </div>
          </div>
        </div>

        {/* Mobile quick stats bar */}
        <div className="sm:hidden px-3 pb-2 flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-1 bg-white rounded-lg py-1.5 border border-slate-200 shadow-sm">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            <span className="text-[11px] font-black text-slate-700">₹{stats.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1 bg-white rounded-lg py-1.5 border border-slate-200 shadow-sm">
            <PieChart className="h-3 w-3 text-teal-500" />
            <span className="text-[11px] font-black text-slate-700">{stats.rate}% Seated</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-1 bg-white rounded-lg py-1.5 border border-slate-200 shadow-sm">
            <Armchair className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] font-black text-slate-700">{stats.available} open</span>
          </div>
        </div>

        {/* Floor tabs + Status filter */}
        <div className="px-3 sm:px-5 pb-2 sm:pb-3 flex flex-col gap-2">
          {/* Floor tabs — horizontal scroll */}
          {sortedFloors.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              <button
                onClick={() => setFloorFilter('ALL')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  floorFilter === 'ALL'
                    ? 'bg-[#8cc63f] text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-[#8cc63f]/50 hover:text-slate-700'
                }`}
              >
                All Floors
              </button>
              {sortedFloors.map((floor) => (
                <button
                  key={floor.id}
                  onClick={() => setFloorFilter(floor.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    floorFilter === floor.id
                      ? 'bg-[#8cc63f] text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-[#8cc63f]/50 hover:text-slate-700'
                  }`}
                >
                  {ZONE_ICON[floor.zone] || null}
                  {floor.name}
                </button>
              ))}
            </div>
          )}

          {/* Status filter pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setStatusFilter(pill.key)}
                className={`shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === pill.key
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {pill.key !== 'ALL' && (
                  <span className={`w-2 h-2 rounded-full bg-${pill.color}-500`} />
                )}
                {pill.label}
                <span className={`text-[10px] font-medium ${statusFilter === pill.key ? 'text-white/70' : 'text-slate-400'}`}>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
                  {floorTables.map((table) => {
                    const activeOrder = heldOrders.find((o) => o.tableName === table.number);
                    return (
                      <TableCard
                        key={table.id}
                        table={table}
                        waiterName={activeOrder?.waiterName}
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
                onClick={() => setSelectedTable(null)}
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
              {selectedTable.status !== 'AVAILABLE' && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-[#8cc63f]" />
                    Transfer Order
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs p-2.5 focus:outline-none focus:border-[#8cc63f] font-medium"
                    >
                      <option value="">Select target table...</option>
                      {tables
                        .filter((t) => t.status === 'AVAILABLE' && t.id !== selectedTable.id)
                        .map((t) => (
                          <option key={t.id} value={t.number}>
                            Table {t.number} ({t.capacity} seats)
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleTransferTable}
                      disabled={!transferTarget}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                      Transfer
                    </button>
                  </div>
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
