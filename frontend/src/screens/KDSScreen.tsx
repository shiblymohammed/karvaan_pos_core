import React, { useState, useEffect } from 'react';
import { Flame, Clock, CheckCircle2, RefreshCw, AlertTriangle, Utensils, Volume2, Filter, Package, Bike, LayoutGrid, Columns, LayoutList, ChefHat } from 'lucide-react';
import { useKdsStore } from '../store/useKdsStore';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'GRID' | 'COMPACT' | 'KANBAN';

export const KDSScreen: React.FC = () => {
  const { tickets, updateTicketStatus, updateElapsedTimes } = useKdsStore();
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'URGENT'>('ALL');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');

  const playReadyChime = () => {
    if (!audioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio play restricted by browser autoplay policy.');
    }
  };

  useEffect(() => {
    updateElapsedTimes(); // initial call
    const timer = setInterval(() => {
      updateElapsedTimes();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleStatusProgression = (ticketId: string, nextStatus: 'COOKING' | 'READY' | 'SERVED') => {
    if (nextStatus === 'READY') {
      playReadyChime();
    }
    if (nextStatus === 'SERVED') {
      setTimeout(() => {
        updateTicketStatus(ticketId, 'SERVED');
      }, 1500);
    }
    updateTicketStatus(ticketId, nextStatus);
  };

  const getSlaCardStyle = (mins: number, status: string, orderType?: string) => {
    const base = "backdrop-blur-xl rounded-3xl border-2 transition-all duration-300 overflow-hidden flex flex-col justify-between";
    if (status === 'READY') return `${base} border-transparent bg-[#b5ef85]/90`;
    if (orderType === 'PARCEL') return `${base} border-amber-300/60 bg-amber-50/80`;
    if (orderType === 'DELIVERY') return `${base} border-purple-300/60 bg-purple-50/80`;
    if (mins >= 15) return `${base} border-rose-400 bg-rose-50/90`;
    if (mins >= 10) return `${base} border-amber-400/80 bg-amber-50/90`;
    return `${base} border-slate-200/80 bg-white/70 hover:bg-white`;
  };

  const getSlaHeaderStyle = (mins: number, status: string, orderType?: string) => {
    return 'border-b border-black/5 bg-transparent';
  };

  const getSlaBadgeStyle = (mins: number, status: string) => {
    if (status === 'READY') return 'bg-white/60 text-kv-dark font-black shadow-sm';
    if (mins >= 15) return 'bg-rose-500 text-white font-black shadow-sm animate-pulse';
    if (mins >= 10) return 'bg-amber-400 text-amber-950 font-black shadow-sm';
    return 'bg-slate-100/80 text-slate-700 font-black';
  };

  // Filter out SERVED tickets and apply SLA filters
  const filteredTickets = tickets.filter(t => t.status !== 'SERVED').filter(t => {
    if (slaFilter === 'ALL') return true;
    if (slaFilter === 'NORMAL') return t.elapsedMinutes < 10;
    if (slaFilter === 'WARNING') return t.elapsedMinutes >= 10 && t.elapsedMinutes < 15;
    if (slaFilter === 'URGENT') return t.elapsedMinutes >= 15;
    return true;
  });

  // Sort: READY first, then by elapsed time (oldest first)
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (a.status === 'READY' && b.status !== 'READY') return -1;
    if (b.status === 'READY' && a.status !== 'READY') return 1;
    return b.elapsedMinutes - a.elapsedMinutes;
  });

  const renderTicketCard = (ticket: any, isCompact: boolean) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      key={ticket.id}
      className={`${getSlaCardStyle(
        ticket.elapsedMinutes,
        ticket.status,
        ticket.orderType
      )}`}
    >
      {/* Card Header */}
      <div>
        <div className={`${isCompact ? 'p-3' : 'p-4'} flex items-center justify-between gap-2 ${getSlaHeaderStyle(
          ticket.elapsedMinutes,
          ticket.status,
          ticket.orderType
        )}`}>
          <div className="flex items-center gap-3">
            <span className={`${isCompact ? 'text-xl px-2.5 py-1' : 'text-3xl px-3.5 py-1.5'} font-black rounded-2xl bg-white/60 text-slate-800 tracking-tight shadow-sm border border-white/50`}>
              {ticket.tableNumber}
            </span>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className={`font-black uppercase text-slate-800 tracking-tight ${isCompact ? 'text-sm' : 'text-base'}`}>{ticket.orderNumber}</h4>
                {ticket.orderType === 'PARCEL' && (
                  <span className={`flex items-center gap-1 font-black bg-white/60 rounded-full uppercase tracking-wide text-slate-700 ${isCompact ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}>
                    <Package className={isCompact ? 'h-2 w-2' : 'h-3 w-3'} /> Parcel
                  </span>
                )}
                {ticket.orderType === 'DELIVERY' && (
                  <span className={`flex items-center gap-1 font-black bg-white/60 rounded-full uppercase tracking-wide text-slate-700 ${isCompact ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}>
                    <Bike className={isCompact ? 'h-2 w-2' : 'h-3 w-3'} /> Delivery
                  </span>
                )}
              </div>
              <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold text-slate-500`}>
                {ticket.customerName ? `👤 ${ticket.customerName}` : `Fired ${new Date(ticket.firedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          </div>

          <span
            className={`${isCompact ? 'text-sm px-2 py-1' : 'text-lg px-3 py-1.5'} rounded-2xl flex items-center gap-1.5 ${getSlaBadgeStyle(
              ticket.elapsedMinutes,
              ticket.status
            )}`}
          >
            <Clock className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 ${ticket.elapsedMinutes >= 15 ? 'animate-bounce' : ''}`} />
            <span>{ticket.elapsedMinutes}m</span>
          </span>
        </div>

        {/* Food Items List */}
        <div className={`${isCompact ? 'p-3 space-y-2' : 'p-4 space-y-3.5'} max-h-[300px] overflow-y-auto bg-transparent`}>
          {ticket.items.map((item: any, idx: number) => (
            <div key={idx} className={`flex items-start justify-between border-b border-kv-border last:border-none last:pb-0 ${isCompact ? 'pb-2' : 'pb-3'}`}>
              <div className="flex items-start gap-3 w-full">
                <span className={`${isCompact ? 'text-sm px-2 py-0.5' : 'text-base px-2.5 py-1'} font-black rounded-xl bg-white/60 text-slate-800 shadow-sm border border-white/50 shrink-0 mt-0.5`}>
                  {item.quantity}x
                </span>
                <div className="flex-1">
                  <span className={`font-bold text-slate-800 leading-snug block tracking-tight ${isCompact ? 'text-sm' : 'text-base'}`}>{item.name}</span>
                  {item.notes && (
                    <div className={`font-bold uppercase tracking-wide text-amber-950 bg-amber-100 border border-amber-200 rounded-xl flex items-center shadow-sm ${isCompact ? 'text-[10px] px-2 py-1 mt-1 gap-1' : 'text-sm px-3 py-1.5 mt-2 gap-2'}`}>
                      <AlertTriangle className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} text-amber-600 shrink-0`} />
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className={`p-3 bg-white/40 border-t border-black/5 ${isCompact ? 'flex gap-2' : ''}`}>
        {ticket.status === 'RECEIVED' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'COOKING')}
            className={`w-full py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-base uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer border border-amber-300/50 ${isCompact ? 'py-2 text-xs' : ''}`}
          >
            <Flame className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Start Cooking</span>
          </button>
        )}
        {ticket.status === 'COOKING' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'READY')}
            className={`w-full bg-[#b5ef85] hover:bg-[#a2db74] text-[#0d212b] font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer border border-[#b5ef85]/50 ${isCompact ? 'py-2 text-xs' : 'py-4 text-base'}`}
          >
            <ChefHat className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Mark Ready</span>
          </button>
        )}
        {ticket.status === 'READY' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'SERVED')}
            className={`w-full bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer ${isCompact ? 'py-2 text-xs' : 'py-4 text-base'}`}
          >
            <CheckCircle2 className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Mark Served</span>
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-pos-bg space-y-6 text-pos-text transition-colors duration-300">
      {/* KDS Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-pos-sidebar p-5 rounded-2xl border border-pos-border shadow-glass transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 text-teal-800 rounded-xl border border-teal-300">
            <Flame className="h-6 w-6 text-pos-accent" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-pos-text flex items-center gap-2">
              <span>Kitchen Display System (KDS)</span>
              <span
                className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300"
              >
                ● Live Local Cache
              </span>
            </h2>
            <p className="text-xs text-pos-text-muted mt-0.5">
              High-visibility live ticket routing for kitchen staff.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggles */}
          <div className="flex items-center gap-1 bg-pos-card p-1 rounded-xl border border-pos-border shadow-2xs">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'GRID' ? 'bg-pos-accent text-white shadow-sm' : 'text-pos-text-muted hover:text-pos-text hover:bg-pos-card-hover'}`}
              title="Grid View (Default)"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('COMPACT')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'COMPACT' ? 'bg-pos-accent text-white shadow-sm' : 'text-pos-text-muted hover:text-pos-text hover:bg-pos-card-hover'}`}
              title="Compact View"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'KANBAN' ? 'bg-pos-accent text-white shadow-sm' : 'text-pos-text-muted hover:text-pos-text hover:bg-pos-card-hover'}`}
              title="Kanban Board View"
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>

          {/* SLA Filter Bar */}
          <div className="flex items-center gap-1 bg-pos-card p-1 rounded-xl border border-pos-border shadow-2xs">
            <span className="text-xs font-bold text-pos-text-muted px-2 hidden sm:flex items-center gap-1">
              <Filter className="h-3 w-3 text-pos-accent" />
              <span>SLA:</span>
            </span>
            {(['ALL', 'NORMAL', 'WARNING', 'URGENT'] as const).map((flt) => (
              <button
                key={flt}
                onClick={() => setSlaFilter(flt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  slaFilter === flt
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm scale-[1.02]'
                    : 'text-pos-text-muted hover:text-pos-text hover:bg-pos-card-hover'
                }`}
              >
                {flt === 'ALL' ? `All (${tickets.length})` : flt}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playReadyChime();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all shadow-2xs active:scale-95 cursor-pointer ${
              audioEnabled
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-pos-card text-pos-text-muted border-pos-border'
            }`}
            title="Toggle Web Audio Bell Chime"
          >
            <Volume2 className="h-4 w-4" />
            <span className="hidden sm:inline">{audioEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Tickets Display Container */}
      {filteredTickets.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center p-8 bg-pos-card rounded-2xl border border-pos-border shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-pos-bg border border-pos-border flex items-center justify-center mb-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-extrabold text-pos-text">No Tickets!</h3>
          <p className="text-sm text-pos-text-muted mt-1 max-w-sm font-medium">
            {slaFilter === 'ALL'
              ? 'All orders complete & served! New Kitchen Order Tickets (KOT) will appear here instantly.'
              : `There are currently no tickets matching the "${slaFilter}" SLA filter criteria.`}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'KANBAN' ? (
            <motion.div
              key="kanban-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[60vh]"
            >
              {/* Kanban Column: Received */}
              <div className="bg-kv-creme/50 rounded-2xl p-4 border border-kv-border flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-kv-surface border border-kv-border rounded-lg"><Package className="h-5 w-5 text-kv-dark" /></div>
                  <h3 className="text-lg font-black text-kv-dark">Received ({sortedTickets.filter(t => t.status === 'RECEIVED').length})</h3>
                </div>
                <div className="flex flex-col gap-4 overflow-y-auto flex-1 p-1">
                  <AnimatePresence>
                    {sortedTickets.filter(t => t.status === 'RECEIVED').map(t => renderTicketCard(t, true))}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Kanban Column: Cooking */}
              <div className="bg-kv-creme/50 rounded-2xl p-4 border border-kv-border flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-kv-surface border border-kv-border text-amber-600 rounded-lg"><Flame className="h-5 w-5" /></div>
                  <h3 className="text-lg font-black text-kv-dark">Cooking ({sortedTickets.filter(t => t.status === 'COOKING').length})</h3>
                </div>
                <div className="flex flex-col gap-4 overflow-y-auto flex-1 p-1">
                  <AnimatePresence>
                    {sortedTickets.filter(t => t.status === 'COOKING').map(t => renderTicketCard(t, true))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Kanban Column: Ready */}
              <div className="bg-kv-creme/50 rounded-2xl p-4 border border-kv-border flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-kv-primary/10 border border-kv-primary/30 text-kv-primary rounded-lg"><ChefHat className="h-5 w-5" /></div>
                  <h3 className="text-lg font-black text-kv-dark">Ready for Pickup ({sortedTickets.filter(t => t.status === 'READY').length})</h3>
                </div>
                <div className="flex flex-col gap-4 overflow-y-auto flex-1 p-1">
                  <AnimatePresence>
                    {sortedTickets.filter(t => t.status === 'READY').map(t => renderTicketCard(t, true))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Grid and Compact Views */
            <motion.div
              key="grid-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`grid gap-5 ${viewMode === 'COMPACT' ? 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
            >
              <AnimatePresence>
                {sortedTickets.map((ticket) => renderTicketCard(ticket, viewMode === 'COMPACT'))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
