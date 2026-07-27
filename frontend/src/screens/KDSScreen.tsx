import React, { useState, useEffect } from 'react';
import { Flame, Clock, CheckCircle2, Bell, RefreshCw, AlertTriangle, Utensils, Volume2, Filter, Package, Bike } from 'lucide-react';
import { useKdsStore } from '../store/useKdsStore';

export const KDSScreen: React.FC = () => {
  const { tickets, updateTicketStatus, updateElapsedTimes } = useKdsStore();
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'URGENT'>('ALL');
  const [audioEnabled, setAudioEnabled] = useState(true);

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

  const handleStatusProgression = (ticketId: string, nextStatus: 'READY' | 'SERVED') => {
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

  // High-visibility KDS card container styles for long-distance restaurant kitchen viewing
  const getSlaCardStyle = (mins: number, status: string, orderType?: string) => {
    if (status === 'READY') return 'border-t-8 border-t-emerald-500 border-2 border-emerald-500 bg-pos-card shadow-glass ring-2 ring-emerald-500/30';
    if (orderType === 'PARCEL') return 'border-t-8 border-t-amber-500 border-2 border-amber-400 bg-pos-card shadow-glass ring-1 ring-amber-400/30';
    if (orderType === 'DELIVERY') return 'border-t-8 border-t-purple-500 border-2 border-purple-400 bg-pos-card shadow-glass ring-1 ring-purple-400/30';
    if (mins >= 15) return 'border-t-8 border-t-rose-600 border-2 border-rose-600 bg-pos-card shadow-glass ring-2 ring-rose-600/40 animate-pulse';
    if (mins >= 10) return 'border-t-8 border-t-amber-500 border-2 border-amber-500 bg-pos-card shadow-glass';
    return 'border-t-8 border-t-blue-500 border-2 border-pos-border bg-pos-card shadow-sm hover:shadow-glass';
  };

  const getSlaHeaderStyle = (mins: number, status: string, orderType?: string) => {
    if (status === 'READY') return 'bg-emerald-600 text-white';
    if (orderType === 'PARCEL') return 'bg-amber-500 text-white';
    if (orderType === 'DELIVERY') return 'bg-purple-600 text-white';
    if (mins >= 15) return 'bg-rose-600 text-white';
    if (mins >= 10) return 'bg-amber-500 text-slate-900';
    return 'bg-slate-800 dark:bg-slate-700 text-white';
  };

  const getSlaBadgeStyle = (mins: number, status: string) => {
    if (status === 'READY') return 'bg-white text-emerald-800 font-black shadow-md';
    if (mins >= 15) return 'bg-white text-rose-700 font-black shadow-md';
    if (mins >= 10) return 'bg-slate-900 text-amber-300 font-black shadow-md';
    return 'bg-white/20 text-white font-black';
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

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto bg-pos-bg space-y-6 text-pos-text transition-colors duration-300">
      {/* KDS Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-pos-sidebar p-5 rounded-2xl border border-pos-border shadow-glass transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 rounded-xl border border-teal-300 dark:border-teal-500/40">
            <Flame className="h-6 w-6 text-pos-accent animate-bounce" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-pos-text flex items-center gap-2">
              <span>Kitchen Display System (KDS)</span>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40`}
              >
                ● Live Local Cache
              </span>
            </h2>
            <p className="text-xs text-pos-text-muted mt-0.5">
              High-visibility live ticket routing designed for 10ft kitchen distance viewing.
            </p>
          </div>
        </div>

        {/* SLA Filter Bar & Audio Chime Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-pos-card p-1 rounded-xl border border-pos-border shadow-2xs">
            <span className="text-xs font-bold text-pos-text-muted px-2 flex items-center gap-1">
              <Filter className="h-3 w-3 text-pos-accent" />
              <span>SLA Filter:</span>
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
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                : 'bg-pos-card text-pos-text-muted border-pos-border'
            }`}
            title="Toggle Web Audio Bell Chime for kitchen staff"
          >
            <Volume2 className="h-4 w-4" />
            <span>{audioEnabled ? 'Chime ON' : 'Chime Muted'}</span>
          </button>
        </div>
      </div>

      {/* Tickets Grid - High-Distance Visibility Standard */}
      {filteredTickets.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center p-8 bg-pos-card rounded-2xl border border-pos-border shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-pos-bg border border-pos-border flex items-center justify-center mb-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-extrabold text-pos-text">No Tickets in this Filter!</h3>
          <p className="text-sm text-pos-text-muted mt-1 max-w-sm font-medium">
            {slaFilter === 'ALL'
              ? 'All orders complete & served! New Kitchen Order Tickets (KOT) will appear here instantly.'
              : `There are currently no tickets matching the "${slaFilter}" SLA filter criteria.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-2xl flex flex-col justify-between transition-all duration-200 overflow-hidden ${getSlaCardStyle(
                ticket.elapsedMinutes,
                ticket.status,
                ticket.orderType
              )}`}
            >
              {/* Massive High-Contrast Card Header Bar */}
              <div>
                <div className={`p-4 flex items-center justify-between gap-2 ${getSlaHeaderStyle(
                  ticket.elapsedMinutes,
                  ticket.status,
                  ticket.orderType
                )}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black px-3.5 py-1.5 rounded-xl bg-black/20 text-white tracking-tight shadow-sm">
                      {ticket.tableNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-black text-base tracking-wide uppercase">{ticket.orderNumber}</h4>
                        {ticket.orderType === 'PARCEL' && (
                          <span className="flex items-center gap-1 text-[10px] font-black bg-white/20 rounded-full px-2 py-0.5 uppercase tracking-wide">
                            <Package className="h-3 w-3" /> Parcel
                          </span>
                        )}
                        {ticket.orderType === 'DELIVERY' && (
                          <span className="flex items-center gap-1 text-[10px] font-black bg-white/20 rounded-full px-2 py-0.5 uppercase tracking-wide">
                            <Bike className="h-3 w-3" /> Delivery
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold opacity-90">
                        {ticket.customerName ? `👤 ${ticket.customerName}` : `Fired ${new Date(ticket.firedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-lg px-3 py-1 rounded-xl flex items-center gap-1.5 ${getSlaBadgeStyle(
                      ticket.elapsedMinutes,
                      ticket.status
                    )}`}
                  >
                    <Clock className="h-5 w-5 animate-pulse shrink-0" />
                    <span>{ticket.elapsedMinutes}m</span>
                  </span>
                </div>

                {/* Massive Readable Food Items List */}
                <div className="p-4 space-y-3.5 max-h-[340px] overflow-y-auto bg-pos-card">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between pb-3 border-b border-pos-border/40 last:border-none last:pb-0">
                      <div className="flex items-start gap-3 w-full">
                        <span className="text-base font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-white shadow-2xs shrink-0 mt-0.5">
                          {item.quantity}x
                        </span>
                        <div className="flex-1">
                          <span className="font-black text-pos-text text-base leading-snug block">{item.name}</span>
                          {item.notes && (
                            <div className="text-sm font-black uppercase tracking-wide text-amber-950 dark:text-amber-100 bg-amber-200 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-500/60 px-3 py-1.5 rounded-xl mt-2 flex items-center gap-2 shadow-sm">
                              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 animate-pulse" />
                              <span>⚠️ {item.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Massive Touchscreen Action Footer Buttons */}
              <div className="p-3 bg-pos-bg border-t border-pos-border">
                {ticket.status === 'COOKING' ? (
                  <button
                    onClick={() => handleStatusProgression(ticket.id, 'READY')}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-base uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-glow-accent transition-all active:scale-95 cursor-pointer"
                  >
                    <Bell className="h-5 w-5 animate-bounce" />
                    <span>🔔 Mark Ready & Chime</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusProgression(ticket.id, 'SERVED')}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-base uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span>✓ Mark Served to Table</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
