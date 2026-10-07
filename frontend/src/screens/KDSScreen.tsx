import React, { useState, useEffect } from 'react';
import { Flame, Clock, CheckCircle2, RefreshCw, AlertTriangle, Utensils, Volume2, Filter, Package, Bike, LayoutGrid, Columns, LayoutList, ChefHat } from 'lucide-react';
import { useKdsStore } from '../store/useKdsStore';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'GRID' | 'COMPACT' | 'KANBAN';
type SLAFilter = 'ALL' | 'NORMAL' | 'WARNING' | 'URGENT';

export const KDSScreen: React.FC = () => {
  const { tickets, updateTicketStatus, updateElapsedTimes } = useKdsStore();
  const [slaFilter, setSlaFilter] = useState<SLAFilter>('ALL');
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
        <div className={`${isCompact ? 'p-2 sm:p-3' : 'p-3 sm:p-4'} flex items-center justify-between gap-2 ${getSlaHeaderStyle(
          ticket.elapsedMinutes,
          ticket.status,
          ticket.orderType
        )}`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`${isCompact ? 'text-lg sm:text-xl px-2 sm:px-2.5 py-1' : 'text-2xl sm:text-3xl px-2.5 sm:px-3.5 py-1.5'} font-black rounded-2xl bg-white/60 text-slate-800 tracking-tight shadow-sm border border-white/50`}>
              {ticket.tableNumber}
            </span>
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h4 className={`font-black uppercase text-slate-800 tracking-tight ${isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>{ticket.orderNumber}</h4>
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
              <p className={`${isCompact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'} font-bold text-slate-500`}>
                {ticket.customerName && <span className="mr-2">👤 {ticket.customerName}</span>}
                <span>Fired {new Date(ticket.firedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          <span
            className={`${isCompact ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-1' : 'text-sm sm:text-lg px-2.5 sm:px-3 py-1 sm:py-1.5'} rounded-2xl flex items-center gap-1 sm:gap-1.5 ${getSlaBadgeStyle(
              ticket.elapsedMinutes,
              ticket.status
            )}`}
          >
            <Clock className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 ${ticket.elapsedMinutes >= 15 ? 'animate-bounce' : ''}`} />
            <span>{ticket.elapsedMinutes}m</span>
          </span>
        </div>

        {/* Food Items List */}
        <div className={`${isCompact ? 'p-2 sm:p-3 space-y-1.5 sm:space-y-2' : 'p-3 sm:p-4 space-y-2.5 sm:space-y-3.5'} max-h-[250px] sm:max-h-[300px] overflow-y-auto bg-transparent`}>
          {ticket.items.map((item: any, idx: number) => {
            const isAddon = item.category === 'ADD-ON';
            return (
              <div key={idx} className={`flex items-start justify-between border-b border-slate-200/50 last:border-none last:pb-0 ${isCompact ? 'pb-1.5 sm:pb-2' : 'pb-2 sm:pb-3'}`}>
                <div className={`flex items-start gap-2 sm:gap-3 w-full ${isAddon ? 'pl-4 sm:pl-6 opacity-80' : ''}`}>
                  <span className={`${isAddon ? 'text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 bg-amber-100/50 text-amber-800 border-amber-200/50' : (isCompact ? 'text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 bg-white/60 text-slate-800 border-white/50' : 'text-sm sm:text-base px-2 sm:px-2.5 py-1 bg-white/60 text-slate-800 border-white/50')} font-black rounded-xl shadow-sm border shrink-0 mt-0.5`}>
                    {item.quantity}x
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-bold leading-snug block tracking-tight truncate whitespace-normal ${isAddon ? 'text-amber-800 text-[11px] sm:text-xs' : (isCompact ? 'text-slate-800 text-xs sm:text-sm' : 'text-slate-800 text-sm sm:text-base')}`}>{item.name}</span>
                    {item.notes && (
                      <div className={`font-bold uppercase tracking-wide text-amber-950 bg-amber-100 border border-amber-200 rounded-xl flex items-center shadow-sm whitespace-normal break-words ${isCompact ? 'text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 mt-1 gap-1' : 'text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 mt-1 sm:mt-2 gap-1 sm:gap-2'}`}>
                        <AlertTriangle className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} text-amber-600 shrink-0`} />
                        <span className="flex-1">{item.notes}</span>
                      </div>
                    )}
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.subItems.map((sub: any, sIdx: number) => (
                          <span key={sIdx} className="text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                            <Utensils className="w-3 h-3 opacity-60" />
                            {sub.qty}x {sub.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className={`p-2 sm:p-3 bg-white/40 border-t border-black/5 ${isCompact ? 'flex gap-2' : ''}`}>
        {ticket.status === 'RECEIVED' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'COOKING')}
            className={`w-full py-4 sm:py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm sm:text-base uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer border border-amber-300/50 ${isCompact ? 'py-3 sm:py-2 text-xs' : ''}`}
          >
            <Flame className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Start Cooking</span>
          </button>
        )}
        {ticket.status === 'COOKING' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'READY')}
            className={`w-full bg-[#b5ef85] hover:bg-[#a2db74] text-[#0d212b] font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer border border-[#b5ef85]/50 ${isCompact ? 'py-3 sm:py-2 text-xs' : 'py-4 text-sm sm:text-base'}`}
          >
            <ChefHat className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Mark Ready</span>
          </button>
        )}
        {ticket.status === 'READY' && (
          <button
            onClick={() => handleStatusProgression(ticket.id, 'SERVED')}
            className={`w-full bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer ${isCompact ? 'py-3 sm:py-2 text-xs' : 'py-4 text-sm sm:text-base'}`}
          >
            <CheckCircle2 className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <span>Mark Served</span>
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="p-2 sm:p-3 xl:p-6 h-[calc(100vh-64px)] overflow-y-auto bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] space-y-3 sm:space-y-4 xl:space-y-6 text-slate-800 transition-colors duration-300 pb-24 sm:pb-28 xl:pb-6 relative">
      {/* KDS Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-xl p-3 sm:p-4 xl:p-5 rounded-3xl border border-white/60 shadow-lg transition-colors duration-300">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 xl:p-3 bg-teal-100 text-teal-800 rounded-xl border border-teal-300 shrink-0">
              <Flame className="h-5 w-5 xl:h-6 xl:w-6 text-pos-accent" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base xl:text-xl font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
                <span>KDS Live</span>
                <span className="text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                  ● Local Cache
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                High-visibility live ticket routing for kitchen staff.
              </p>
            </div>
          </div>
          
          {/* Audio toggle on mobile header right */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playReadyChime();
            }}
            className={`sm:hidden flex items-center justify-center p-2 rounded-xl text-xs font-extrabold border transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
              audioEnabled
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white/60 backdrop-blur-md text-slate-500 border-white/50 hover:bg-white/80'
            }`}
            title="Toggle Web Audio Bell Chime"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* View Toggles (Desktop only) */}
          <div className="hidden sm:flex items-center bg-white/60 backdrop-blur-md p-1 rounded-2xl border border-white/50 shadow-sm shrink-0">
            <button
              onClick={() => setViewMode('GRID')}
              className={`relative px-3 py-2 rounded-xl text-sm font-bold transition-all z-10 cursor-pointer ${viewMode === 'GRID' ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {viewMode === 'GRID' && (
                <motion.div layoutId="kdsViewTabDesktop" className="absolute inset-0 bg-[#8cc63f] rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('COMPACT')}
              className={`relative px-3 py-2 rounded-xl text-sm font-bold transition-all z-10 cursor-pointer ${viewMode === 'COMPACT' ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {viewMode === 'COMPACT' && (
                <motion.div layoutId="kdsViewTabDesktop" className="absolute inset-0 bg-[#8cc63f] rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`relative px-3 py-2 rounded-xl text-sm font-bold transition-all z-10 cursor-pointer ${viewMode === 'KANBAN' ? 'text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {viewMode === 'KANBAN' && (
                <motion.div layoutId="kdsViewTabDesktop" className="absolute inset-0 bg-[#8cc63f] rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
              <Columns className="h-4 w-4" />
            </button>
          </div>

          {/* SLA Filter Bar (Scrollable on mobile) */}
          <div className="flex-1 sm:flex-none flex items-center gap-1 bg-white/60 backdrop-blur-md p-1 rounded-2xl border border-white/50 shadow-sm overflow-x-auto no-scrollbar snap-x">
            <span className="text-xs font-bold text-slate-500 px-2 hidden lg:flex items-center gap-1 shrink-0">
              <Filter className="h-3 w-3 text-pos-accent" />
              <span>SLA:</span>
            </span>
            {(['ALL', 'NORMAL', 'WARNING', 'URGENT'] as const).map((flt) => (
              <button
                key={flt}
                onClick={() => setSlaFilter(flt)}
                className={`relative px-3 py-1.5 sm:px-2.5 xl:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer z-10 shrink-0 snap-center ${
                  slaFilter === flt
                    ? 'text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {slaFilter === flt && (
                  <motion.div 
                    layoutId="kdsSlaTab" 
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md -z-10" 
                    transition={{ type: "spring", stiffness: 500, damping: 30 }} 
                  />
                )}
                {flt === 'ALL' ? `All (${tickets.length})` : flt}
              </button>
            ))}
          </div>

          {/* Audio toggle on desktop */}
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playReadyChime();
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-extrabold border transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
              audioEnabled
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white/60 backdrop-blur-md text-slate-500 border-white/50 hover:bg-white/80'
            }`}
            title="Toggle Web Audio Bell Chime"
          >
            <Volume2 className="h-4 w-4" />
            <span>{audioEnabled ? 'Chime ON' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Tickets Display Container */}
      {filteredTickets.length === 0 ? (
        <div className="h-64 sm:h-80 flex flex-col items-center justify-center text-center p-6 sm:p-8 bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-lg">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-800">No Tickets!</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm font-medium">
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
              className="flex sm:grid sm:grid-cols-3 gap-4 sm:gap-6 h-full min-h-[60vh] overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-4"
            >
              {/* Kanban Column: Received */}
              <div className="min-w-[85vw] sm:min-w-0 snap-center bg-white/40 backdrop-blur-md rounded-3xl p-3 sm:p-4 border border-white/50 flex flex-col shadow-sm">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <div className="p-1.5 bg-white/70 border border-white/60 rounded-xl"><Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-800" /></div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800">Received ({sortedTickets.filter(t => t.status === 'RECEIVED').length})</h3>
                </div>
                <div className="flex flex-col gap-3 sm:gap-4 overflow-y-auto flex-1 p-1">
                  <AnimatePresence>
                    {sortedTickets.filter(t => t.status === 'RECEIVED').map(t => renderTicketCard(t, true))}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Kanban Column: Cooking */}
              <div className="min-w-[85vw] sm:min-w-0 snap-center bg-white/40 backdrop-blur-md rounded-3xl p-3 sm:p-4 border border-white/50 flex flex-col shadow-sm">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <div className="p-1.5 bg-white/70 border border-white/60 text-amber-600 rounded-xl"><Flame className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800">Cooking ({sortedTickets.filter(t => t.status === 'COOKING').length})</h3>
                </div>
                <div className="flex flex-col gap-3 sm:gap-4 overflow-y-auto flex-1 p-1">
                  <AnimatePresence>
                    {sortedTickets.filter(t => t.status === 'COOKING').map(t => renderTicketCard(t, true))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Kanban Column: Ready */}
              <div className="min-w-[85vw] sm:min-w-0 snap-center bg-white/40 backdrop-blur-md rounded-3xl p-3 sm:p-4 border border-white/50 flex flex-col shadow-sm">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <div className="p-1.5 bg-[#b5ef85]/40 border border-[#b5ef85] text-[#0d212b] rounded-xl"><ChefHat className="h-4 w-4 sm:h-5 sm:w-5" /></div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800">Ready for Pickup ({sortedTickets.filter(t => t.status === 'READY').length})</h3>
                </div>
                <div className="flex flex-col gap-3 sm:gap-4 overflow-y-auto flex-1 p-1">
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
              className={`grid gap-3 sm:gap-4 xl:gap-5 ${viewMode === 'COMPACT' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
            >
              <AnimatePresence>
                {sortedTickets.map((ticket) => renderTicketCard(ticket, viewMode === 'COMPACT'))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* MOBILE STICKY BOTTOM BAR FOR VIEW TOGGLES */}
      <div className="sm:hidden fixed bottom-20 left-4 right-4 z-40 flex flex-col gap-2">
        <div className="flex bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl shadow-xl border border-white/60 w-full animate-in slide-in-from-bottom-4">
          <button
            onClick={() => setViewMode('GRID')}
            className={`flex-1 relative py-3 text-[13px] rounded-xl font-bold transition-all z-10 text-center active:scale-95 flex items-center justify-center gap-2 ${viewMode === 'GRID' ? 'text-white' : 'text-slate-500'}`}
          >
            {viewMode === 'GRID' && (
              <motion.div layoutId="kdsViewTabMobile" className="absolute inset-0 bg-slate-800 rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            )}
            <LayoutGrid className="w-4 h-4" />
            <span>Grid</span>
          </button>
          
          <button
            onClick={() => setViewMode('COMPACT')}
            className={`flex-1 relative py-3 text-[13px] rounded-xl font-bold transition-all z-10 text-center active:scale-95 flex items-center justify-center gap-2 ${viewMode === 'COMPACT' ? 'text-white' : 'text-slate-500'}`}
          >
            {viewMode === 'COMPACT' && (
              <motion.div layoutId="kdsViewTabMobile" className="absolute inset-0 bg-slate-800 rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            )}
            <LayoutList className="w-4 h-4" />
            <span>List</span>
          </button>

          <button
            onClick={() => setViewMode('KANBAN')}
            className={`flex-1 relative py-3 text-[13px] rounded-xl font-bold transition-all z-10 text-center active:scale-95 flex items-center justify-center gap-2 ${viewMode === 'KANBAN' ? 'text-white' : 'text-slate-500'}`}
          >
            {viewMode === 'KANBAN' && (
              <motion.div layoutId="kdsViewTabMobile" className="absolute inset-0 bg-slate-800 rounded-xl shadow-md -z-10" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            )}
            <Columns className="w-4 h-4" />
            <span>Kanban</span>
          </button>
        </div>
      </div>
    </div>
  );
};
