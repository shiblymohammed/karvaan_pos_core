import React, { useEffect, useState, useRef } from 'react';
import { useKdsStore } from '../store/useKdsStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Utensils, MonitorSpeaker, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playAudioTone, playTtsAnnouncement } from '../utils/audioHelper';

// --- Promo Carousel Component ---
const PromoCarousel = ({ media, interval, bgColor, textOverlay, qrUrl }: { media: any[], interval: number, bgColor: string, textOverlay: string, qrUrl: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (media.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % media.length);
    }, Math.max(2, interval) * 1000);
    return () => clearInterval(timer);
  }, [media.length, interval]);

  // Clamp index in case media array shrinks
  const safeIndex = currentIndex >= media.length ? 0 : currentIndex;
  const currentItem = media[safeIndex];

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden transition-colors duration-1000" style={{ backgroundColor: bgColor || '#000000' }}>
      
      {/* Media Layer */}
      {currentItem && (
        <div key={currentItem.id} className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-1000">
          {currentItem.type === 'IMAGE' ? (
            <img src={currentItem.url} alt="Promo" className="w-full h-full object-contain drop-shadow-xl" />
          ) : (
            <video src={currentItem.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
          )}
        </div>
      )}

      {/* Overlays Layer */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-end p-8 sm:p-12">
        {qrUrl && (
          <div className="absolute bottom-8 right-8 bg-white p-2 rounded-2xl shadow-2xl flex flex-col items-center gap-1.5 border-4 border-white/80">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`} alt="QR Code" className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg" />
            <span className="text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-widest">Scan Me</span>
          </div>
        )}
        
        {textOverlay && (
          <div className="bg-black/60 backdrop-blur-xl px-8 py-5 rounded-[2rem] border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-4 sm:mb-8 max-w-4xl w-full">
            <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-center drop-shadow-lg leading-tight">
              {textOverlay}
            </h2>
          </div>
        )}
      </div>
    </div>
  );
};

export const QueueScreen: React.FC = () => {
  const { tickets, updateElapsedTimes } = useKdsStore();
  const { 
    orderTvEnabled,
    orderTvShowPopup, orderTvPlayAudio, orderTvAudioTone, orderTvCustomAudioData, setOrderTvAudio,
    orderTvTickerEnabled, orderTvTickerMessage, orderTvConfettiEnabled, orderTvTtsEnabled, orderTvTtsVoiceName,
    orderTvWaterColor, orderTvWaterFillEnabled, orderTvReadyBadgeEnabled, orderTvTimeWaitingEnabled,
    orderTvChaosAnimationEnabled, orderTvShowDelivery, orderTvLayoutMode, orderTvOrientation, orderTvPromoInterval, orderTvPromoMedia,
    orderTvSplitRatio, setOrderTvSplitRatio, orderTvPromoText, orderTvPromoQrUrl, orderTvPromoBgColor
  } = useSettingsStore();
  const [lastReadyTicket, setLastReadyTicket] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState<{show: boolean, ticket: any}>({show: false, ticket: null});
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Handle Resizing Split Layout
  useEffect(() => {
    if (!isDraggingDivider) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (orderTvOrientation === 'HORIZONTAL') {
        const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
        setOrderTvSplitRatio(Math.min(Math.max(newRatio, 20), 80));
      } else {
        const newRatio = ((e.clientY - rect.top) / rect.height) * 100;
        setOrderTvSplitRatio(Math.min(Math.max(newRatio, 20), 80));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none'; // prevent text selection while dragging

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDraggingDivider, orderTvOrientation, setOrderTvSplitRatio]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      await document.exitFullscreen().catch(console.error);
    }
  };

  useEffect(() => {
    updateElapsedTimes(); // initial call
    const timer = setInterval(() => {
      updateElapsedTimes();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter and split tickets
  const activeTickets = tickets.filter(t => t.status !== 'SERVED' && (orderTvShowDelivery || t.orderType !== 'DELIVERY'));
  
  const preparingTickets = activeTickets
    .filter(t => t.status === 'RECEIVED' || t.status === 'COOKING')
    .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes); // Oldest first

  const readyTickets = activeTickets
    .filter(t => t.status === 'READY')
    .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);

  const isSplit = orderTvLayoutMode === 'SPLIT_PROMO';

  // Simple logic to detect new "Ready" tickets to play a chime or flash
  useEffect(() => {
    if (!orderTvEnabled) return;

    if (readyTickets.length > 0) {
      const newestReady = readyTickets[0]; // The one that just became ready
      if (newestReady.id !== lastReadyTicket) {
        setLastReadyTicket(newestReady.id);
        
        // Trigger Audio
        if (orderTvPlayAudio) {
          playAudioTone(orderTvAudioTone, orderTvCustomAudioData);
        }

        // Trigger TTS
        if (orderTvTtsEnabled) {
          playTtsAnnouncement(`Order number ${newestReady.orderNumber} is ready for pickup`, orderTvTtsVoiceName);
        }

        // Trigger Confetti
        if (orderTvConfettiEnabled) {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#fcd34d', '#f59e0b'],
            zIndex: 9999
          });
        }

        // Trigger Popup
        if (orderTvShowPopup) {
          setShowPopup({ show: true, ticket: newestReady });
        }
      }
    }
  }, [readyTickets, lastReadyTicket]);

  // Auto-hide popup after 3 seconds
  useEffect(() => {
    if (showPopup.show) {
      const timer = setTimeout(() => {
        setShowPopup(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showPopup.show]);

  if (!orderTvEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-kv-creme text-kv-muted font-bold text-xl">
        <MonitorSpeaker className="h-16 w-16 mb-4 opacity-40 text-slate-400" />
        Order TV Screen is Disabled
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-[calc(100vh-64px)] bg-kv-creme overflow-hidden transition-colors duration-300 relative">
      
      {/* Global Animations for Queue Screen */}
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            animation: marquee 20s linear infinite;
          }
          @keyframes wave {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-150%) skewX(-20deg); }
            30%, 100% { transform: translateX(250%) skewX(-20deg); }
          }
          @keyframes ticket-jump {
            0%, 100% { transform: translateY(0); }
            10% { transform: translateY(-15px) scale(1.05); }
            20% { transform: translateY(5px); }
            30% { transform: translateY(0); }
          }
          @keyframes ticket-shake {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            5% { transform: translate(-3px, -2px) rotate(-1deg); }
            10% { transform: translate(2px, 3px) rotate(1.5deg); }
            15% { transform: translate(-2px, 1px) rotate(-1.5deg); }
            20% { transform: translate(3px, -2px) rotate(1deg); }
            25% { transform: translate(0, 0) rotate(0deg); }
          }
          @keyframes gradient-x {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .bg-pan {
            background-size: 200% 200%;
            animation: gradient-x 4s ease infinite;
          }
        `}
      </style>

      {/* Container Query Styles for adaptive ticket cards */}
      <style>
        {`
          .ticket-container {
            container-type: inline-size;
          }
          /* Default: 1 column */
          .ticket-grid {
            display: grid;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            gap: 0.5rem;
          }
          /* 2 columns when container >= 300px */
          @container (min-width: 300px) {
            .ticket-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.75rem;
            }
          }
          /* 3 columns when container >= 500px */
          @container (min-width: 500px) {
            .ticket-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 1rem;
            }
          }
          /* 4 columns when container >= 700px */
          @container (min-width: 700px) {
            .ticket-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 1rem;
            }
          }
          /* Ticket number font sizing based on container */
          .ticket-number {
            font-size: 1.25rem; /* 20px default */
          }
          @container (min-width: 300px) {
            .ticket-number {
              font-size: 1.5rem; /* 24px */
            }
          }
          @container (min-width: 500px) {
            .ticket-number {
              font-size: 1.875rem; /* 30px */
            }
          }
          @container (min-width: 700px) {
            .ticket-number {
              font-size: 2.25rem; /* 36px */
            }
          }
          /* Ready ticket number - slightly bigger */
          .ticket-number-ready {
            font-size: 1.5rem;
          }
          @container (min-width: 300px) {
            .ticket-number-ready {
              font-size: 1.875rem;
            }
          }
          @container (min-width: 500px) {
            .ticket-number-ready {
              font-size: 2.25rem;
            }
          }
          @container (min-width: 700px) {
            .ticket-number-ready {
              font-size: 3rem;
            }
          }
          /* Column header sizing */
          .column-header-title {
            font-size: 1rem;
          }
          @container (min-width: 400px) {
            .column-header-title {
              font-size: 1.5rem;
            }
          }
          .column-header-icon {
            width: 1rem;
            height: 1rem;
          }
          @container (min-width: 400px) {
            .column-header-icon {
              width: 1.5rem;
              height: 1.5rem;
            }
          }
          /* Main queue grid - adaptive to container */
          .queue-main-grid-container {
            container-type: inline-size;
          }
          .queue-main-grid {
            display: grid;
            grid-template-columns: 1fr;
          }
          @container (min-width: 500px) {
            .queue-main-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
        `}
      </style>

      {/* MAIN SPLIT LAYOUT */}
      <div className={`flex-1 flex overflow-hidden relative ${
        orderTvLayoutMode === 'SPLIT_PROMO' 
          ? (orderTvOrientation === 'VERTICAL' ? 'flex-col' : 'flex-row')
          : 'flex-col'
      }`}>
        
        {/* QUEUE PANE */}
        <div 
          className={`flex flex-col relative z-30 shadow-[4px_0_24px_rgba(0,0,0,0.1)] bg-kv-creme/90 backdrop-blur-md ${
            orderTvLayoutMode === 'SPLIT_PROMO' ? 'flex-none' : 'flex-1'
          }`}
          style={orderTvLayoutMode === 'SPLIT_PROMO' ? {
            [orderTvOrientation === 'VERTICAL' ? 'height' : 'width']: `${orderTvSplitRatio}%`
          } : {}}
        >
          {/* Header Moved Inside Queue Pane */}
          <div className={`flex items-center justify-between bg-kv-surface/90 backdrop-blur-sm border-b border-kv-border shadow-sm z-10 shrink-0 relative overflow-hidden ${isSplit ? 'px-2 py-1' : 'px-4 py-2'}`}>
            <button
              onClick={toggleFullscreen}
              className={`relative group flex items-center justify-center rounded-full border transition-all duration-200 cursor-pointer overflow-hidden bg-pos-input border-pos-border hover:bg-pos-card text-slate-500 shrink-0 ${isSplit ? 'w-6 h-6' : 'w-8 h-8'}`}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-[14px] h-[14px]" strokeWidth={2.5} /> : <Maximize className="w-[14px] h-[14px]" strokeWidth={2.5} />}
            </button>
            
            <div className={`flex items-center gap-2 absolute left-1/2 -translate-x-1/2 ${isSplit ? 'max-w-[60%]' : ''}`}>
              {!isSplit && (
                <div className="p-1.5 bg-kv-primary/10 text-kv-primary rounded-xl">
                  <MonitorSpeaker className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className={`font-black text-kv-dark tracking-tight leading-none truncate ${isSplit ? 'text-xs' : 'text-lg'}`}>Order Status</h1>
                {!isSplit && (
                  <p className="text-kv-muted font-bold mt-0.5 text-[10px] text-center uppercase tracking-wider">Please wait until your order number appears</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setOrderTvAudio(!orderTvPlayAudio, orderTvAudioTone, orderTvCustomAudioData)}
              className={`relative group flex items-center justify-center rounded-full border transition-all duration-200 cursor-pointer overflow-hidden shrink-0 ${isSplit ? 'w-6 h-6' : 'w-8 h-8'} ${
                orderTvPlayAudio 
                  ? 'bg-pos-card border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_2px_10px_rgba(16,185,129,0.1)]' 
                  : 'bg-pos-input border-pos-border hover:bg-pos-card text-slate-500'
              }`}
              title={orderTvPlayAudio ? 'Mute Audio' : 'Enable Audio'}
            >
              <div className={`transition-transform duration-300 ${orderTvPlayAudio ? 'text-emerald-500 scale-100' : 'text-slate-400 scale-90'}`}>
                {orderTvPlayAudio ? <Volume2 className="w-[14px] h-[14px]" strokeWidth={2.5} /> : <VolumeX className="w-[14px] h-[14px]" strokeWidth={2.5} />}
              </div>
            </button>
          </div>

          {/* Background Effects for Queue Pane */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-60">
            <style>
              {`
                @keyframes pan-bg {
                  from { background-position: 0 0; }
                  to { background-position: -2262px 2262px; }
                }
                .animate-pan-bg {
                  animation: pan-bg 120s linear infinite;
                }
              `}
            </style>
            <div 
              className="absolute inset-0 animate-pan-bg" 
              style={{ 
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0, rgba(0,0,0,0.025) 2px, transparent 2px, transparent 16px)',
                backgroundSize: '22.62px 22.62px'
              }}
            />
          </div>

          {/* Main Grid */}
          <div className={`flex-1 overflow-hidden relative z-10 ${
            isSplit 
              ? 'queue-main-grid-container'
              : 'grid grid-cols-1 md:grid-cols-2 gap-0'
          }`}>
           <div className={isSplit ? 'queue-main-grid h-full' : 'contents'}>
            
            {/* Preparing Column */}
        <div className={`flex flex-col h-full border-r border-kv-border bg-kv-creme/30 relative ${isSplit ? 'ticket-container' : ''}`}>
          <div className={`bg-kv-surface/50 backdrop-blur-md sticky top-0 z-10 border-b border-kv-border flex items-center justify-between ${isSplit ? 'px-2 py-1.5' : 'p-4'}`}>
            <h2 className={`font-black text-kv-dark flex items-center ${isSplit ? 'column-header-title gap-1 truncate' : 'text-2xl gap-3'}`}>
              <Utensils className={`text-amber-500 shrink-0 ${isSplit ? 'column-header-icon' : 'h-6 w-6'}`} />
              Preparing
            </h2>
            <span className={`font-bold text-kv-muted bg-white rounded-full border border-kv-border shrink-0 ${isSplit ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-3 py-1'}`}>{preparingTickets.length}</span>
          </div>
          
          <div className={`flex-1 overflow-y-auto custom-scrollbar bg-kv-surface/30 ${isSplit ? 'p-3' : 'p-4 md:p-6'}`}>
            <div className={`auto-rows-max ${isSplit ? 'ticket-grid' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'}`}>
              <AnimatePresence mode="popLayout">
                {preparingTickets.map((ticket) => (
                  <motion.div
                    layoutId={`ticket-${ticket.id}`}
                    key={ticket.id}
                    initial={{ opacity: 0, y: 30, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`relative bg-white shadow-md border border-kv-border/50 flex flex-col overflow-hidden w-full ${isSplit ? 'rounded-lg' : 'rounded-xl'}`}
                  >
                    {/* Side punch holes - only in full mode */}
                    {!isSplit && (
                      <>
                        <div className="absolute -left-3 top-1/2 w-6 h-6 bg-kv-surface/30 rounded-full -translate-y-1/2 border-r border-kv-border/50 z-10 hidden sm:block"></div>
                        <div className="absolute -right-3 top-1/2 w-6 h-6 bg-kv-surface/30 rounded-full -translate-y-1/2 border-l border-kv-border/50 z-10 hidden sm:block"></div>
                      </>
                    )}

                    {/* Water Fill Progress (Simulated 15min max) */}
                    {orderTvWaterFillEnabled && (
                      <div 
                        className="absolute bottom-0 left-0 w-full transition-all duration-1000 ease-in-out z-0"
                        style={{ height: `${Math.min(100, (ticket.elapsedMinutes / 15) * 100)}%` }}
                      >
                        <div 
                          className="absolute inset-0 backdrop-blur-sm" 
                          style={{ backgroundColor: orderTvWaterColor || '#fbbf24', opacity: 0.7 }}
                        />
                        <div 
                          className="absolute left-0 w-[200%] -top-[23px] h-[24px] pointer-events-none animate-[wave_3s_linear_infinite]"
                          style={{ color: orderTvWaterColor || '#fbbf24', opacity: 0.9 }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 2400 120" preserveAspectRatio="none" fill="currentColor">
                            <path d="M0,60 C150,120 300,0 600,60 C900,120 1050,0 1200,60 L1200,120 L0,120 Z" />
                            <path transform="translate(1200,0)" d="M0,60 C150,120 300,0 600,60 C900,120 1050,0 1200,60 L1200,120 L0,120 Z" />
                          </svg>
                        </div>
                      </div>
                    )}
                    
                    {/* Ticket Header */}
                    <div className={`bg-kv-creme/50 border-b-2 border-dashed border-kv-border/60 flex justify-between items-center font-black text-kv-muted uppercase tracking-wider relative z-10 ${isSplit ? 'px-2 py-1 text-[9px]' : 'px-3 py-2 text-[10px]'}`}>
                      <span>{ticket.orderType}</span>
                      <span>Wait: {ticket.elapsedMinutes}m</span>
                    </div>

                    {/* Ticket Body */}
                    <div className={`flex items-center justify-center overflow-hidden relative z-10 ${isSplit ? 'px-2 py-3' : 'px-2 py-4'}`}>
                      <span className={`font-black text-kv-dark tracking-tighter tabular-nums text-center break-words w-full leading-none px-1 ${isSplit ? 'ticket-number' : 'text-2xl sm:text-3xl xl:text-4xl'}`}>
                        {ticket.orderNumber}
                      </span>
                    </div>

                    {/* Ticket Footer */}
                    {ticket.customerName && (
                      <div className={`bg-kv-creme/30 border-t-2 border-dashed border-kv-border/60 text-center font-bold text-kv-muted truncate relative z-10 ${isSplit ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'}`}>
                        {ticket.customerName}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {preparingTickets.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-kv-muted opacity-50 py-12">
                <Utensils className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm font-bold">No orders preparing</p>
              </div>
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className={`flex flex-col h-full bg-kv-primary/5 relative ${isSplit ? 'ticket-container' : ''}`}>
          <div className={`bg-[#b5ef85]/20 backdrop-blur-md sticky top-0 z-10 border-b border-[#b5ef85]/40 shadow-sm flex items-center justify-between ${isSplit ? 'px-2 py-1.5' : 'p-4'}`}>
            <h2 className={`font-black text-[#2e5904] flex items-center ${isSplit ? 'column-header-title gap-1 truncate' : 'text-2xl gap-3'}`}>
              <ChefHat className={`text-[#4a8a0a] shrink-0 ${isSplit ? 'column-header-icon' : 'h-6 w-6'}`} />
              Ready
            </h2>
            <span className={`font-bold text-[#2e5904] bg-[#b5ef85]/40 rounded-full shrink-0 ${isSplit ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-3 py-1'}`}>{readyTickets.length}</span>
          </div>
          
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isSplit ? 'p-3' : 'p-4 md:p-6'}`}>
            <div className={`auto-rows-max ${isSplit ? 'ticket-grid' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'}`}>
              <AnimatePresence mode="popLayout">
                {readyTickets.map((ticket, index) => (
                  <motion.div
                    layoutId={`ticket-${ticket.id}`}
                    key={ticket.id}
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 250, damping: 25 }}
                    style={{ animationDelay: `${index * 0.2}s` }}
                    className={`relative shadow-md border-2 flex flex-col overflow-hidden w-full group ${isSplit ? 'rounded-lg' : 'rounded-xl'} ${
                      ticket.id === lastReadyTicket 
                        ? 'bg-[#b5ef85] border-[#a2db74] text-[#2e5904] ' + (orderTvChaosAnimationEnabled ? 'animate-[ticket-jump_1.5s_ease-in-out_infinite] z-20' : 'animate-[pulse_1.5s_ease-in-out_4]')
                        : 'bg-white border-[#b5ef85] text-kv-dark ' + (orderTvChaosAnimationEnabled ? 'animate-[ticket-shake_2s_ease-in-out_infinite]' : '')
                    }`}
                  >
                    {/* Shimmer Sweep Effect */}
                    <div className={`absolute inset-0 z-20 pointer-events-none overflow-hidden ${isSplit ? 'rounded-lg' : 'rounded-xl'}`}>
                      <div className="w-full h-[200%] bg-gradient-to-r from-transparent via-white/70 to-transparent absolute top-[-50%] left-0 animate-[shimmer_4s_infinite]" style={{ filter: 'blur(4px)' }} />
                    </div>

                    {/* Side punch holes - only in full mode */}
                    {!isSplit && (
                      <>
                        <div className={`absolute -left-3 top-1/2 w-6 h-6 rounded-full -translate-y-1/2 border-r-2 z-10 hidden sm:block ${ticket.id === lastReadyTicket ? 'bg-kv-primary/5 border-[#a2db74]' : 'bg-kv-primary/5 border-[#b5ef85]'}`}></div>
                        <div className={`absolute -right-3 top-1/2 w-6 h-6 rounded-full -translate-y-1/2 border-l-2 z-10 hidden sm:block ${ticket.id === lastReadyTicket ? 'bg-kv-primary/5 border-[#a2db74]' : 'bg-kv-primary/5 border-[#b5ef85]'}`}></div>
                      </>
                    )}
                    
                    {/* Ticket Header */}
                    <div className={`border-b-2 border-dashed flex justify-between items-center font-black uppercase tracking-wider ${isSplit ? 'px-2 py-1 text-[9px]' : 'px-3 py-2 text-[10px]'} ${ticket.id === lastReadyTicket ? 'bg-white/30 border-[#2e5904]/20' : 'bg-[#b5ef85]/20 border-[#b5ef85]'}`}>
                      <span>{ticket.orderType}</span>
                      <span className="flex items-center gap-1"><ChefHat className={isSplit ? 'w-2.5 h-2.5' : 'w-3 h-3'}/> READY</span>
                    </div>

                    {/* Ticket Body */}
                    <div className={`flex items-center justify-center overflow-hidden relative z-10 ${isSplit ? 'px-2 py-3' : 'px-2 py-4'}`}>
                      <span className={`font-black tracking-tighter tabular-nums text-center break-words w-full leading-none drop-shadow-sm px-1 ${isSplit ? 'ticket-number' : 'text-2xl sm:text-3xl xl:text-4xl'}`}>
                        {ticket.orderNumber}
                      </span>
                    </div>

                    {/* Stamped Ready Badge */}
                    {orderTvReadyBadgeEnabled && (
                      <div className={`absolute rotate-12 z-30 pointer-events-none animate-[bounce_0.5s_ease-out] ${isSplit ? 'top-1 right-1' : 'top-2 right-2'}`}>
                        <div className={`border-[#3a5a14] text-[#3a5a14] font-black rounded shadow-sm bg-white/80 uppercase tracking-widest ${isSplit ? 'border-2 text-[8px] px-1.5 py-0.5' : 'border-[3px] text-[10px] px-2 py-0.5'}`}>
                          Ready!
                        </div>
                      </div>
                    )}

                    {/* Ticket Footer */}
                    {(ticket.customerName || orderTvTimeWaitingEnabled) && (
                      <div className={`border-t-2 border-dashed flex justify-between items-center font-bold truncate z-10 relative ${isSplit ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'} ${ticket.id === lastReadyTicket ? 'bg-white/30 border-[#2e5904]/20' : 'bg-[#b5ef85]/20 border-[#b5ef85]'}`}>
                        <span className="truncate flex-1">{ticket.customerName}</span>
                        {orderTvTimeWaitingEnabled && ticket.readyAt && (
                          <span className={`text-[#3a5a14] whitespace-nowrap bg-white/50 rounded shadow-sm font-black flex items-center ${isSplit ? 'px-1 ml-1 text-[8px]' : 'px-1.5 ml-2'}`}>
                            Wait: {Math.floor((new Date().getTime() - new Date(ticket.readyAt).getTime()) / 60000)}m
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {readyTickets.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-[#3a5a14] opacity-50 py-12">
                <ChefHat className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm font-bold">No orders ready</p>
              </div>
            )}
          </div>

          </div> {/* close queue-main-grid wrapper */}

          {/* Focused Now Serving Popup (Only inside Ready Column) */}
          <AnimatePresence>
            {showPopup.show && showPopup.ticket && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-kv-creme/60 backdrop-blur-md"
              >
                <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-4 border-[#b5ef85] p-10 flex flex-col items-center justify-center max-w-2xl w-[90%] text-center overflow-hidden relative">
                  
                  {/* Spinning burst effect behind */}
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center"
                  >
                    <div className="w-[200%] h-[200%] bg-[repeating-conic-gradient(from_0deg,#b5ef85_0deg_15deg,transparent_15deg_30deg)] rounded-full"></div>
                  </motion.div>

                  <ChefHat className="h-16 w-16 text-[#4a8a0a] mb-4 animate-bounce" />
                  <h2 className="text-3xl font-black text-[#4a8a0a] uppercase tracking-widest mb-1 z-10">
                    Now Serving
                  </h2>
                  <p className="text-lg font-bold text-kv-muted mb-6 z-10">Please collect your order</p>
                  
                  <div className="bg-kv-surface rounded-2xl py-6 px-12 border-4 border-dashed border-[#b5ef85] z-10 w-full flex items-center justify-center">
                    <span className="text-7xl font-black text-kv-dark tracking-tighter tabular-nums drop-shadow-sm truncate">
                      {showPopup.ticket.orderNumber}
                    </span>
                  </div>
                  
                  {showPopup.ticket.customerName && (
                    <div className="mt-6 text-2xl font-bold text-kv-dark z-10 truncate w-full">
                      {showPopup.ticket.customerName}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>

        {/* DRAGGABLE DIVIDER */}
        {orderTvLayoutMode === 'SPLIT_PROMO' && (
          <div
            className={`absolute z-40 flex items-center justify-center transition-colors duration-200 ${
              orderTvOrientation === 'VERTICAL'
                ? 'w-full h-8 -mt-4 cursor-row-resize hover:bg-white/10'
                : 'h-full w-8 -ml-4 cursor-col-resize hover:bg-white/10'
            }`}
            style={{
              [orderTvOrientation === 'VERTICAL' ? 'top' : 'left']: `${orderTvSplitRatio}%`
            }}
            onMouseDown={() => setIsDraggingDivider(true)}
          >
            {/* Subtle Grip Icon */}
            <div className={`rounded-full bg-white/40 backdrop-blur-md shadow-sm border border-white/20 ${
              orderTvOrientation === 'VERTICAL' ? 'w-16 h-1.5' : 'w-1.5 h-16'
            }`} />
          </div>
        )}

        {/* PROMO PANE */}
        {orderTvLayoutMode === 'SPLIT_PROMO' && (
          <div className={`relative z-20 bg-black overflow-hidden flex-1 shadow-2xl`}>
            <PromoCarousel 
              media={orderTvPromoMedia} 
              interval={orderTvPromoInterval} 
              bgColor={orderTvPromoBgColor}
              textOverlay={orderTvPromoText}
              qrUrl={orderTvPromoQrUrl}
            />
          </div>
        )}
      </div>

      {/* TICKER */}
      {orderTvTickerEnabled && orderTvTickerMessage && (
        <div className="flex-none bg-white/80 backdrop-blur-xl border-t border-kv-border shadow-[0_-4px_25px_rgba(0,0,0,0.04)] relative z-50 flex items-center h-[52px]">
          {/* Scrolling Marquee Area */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            {/* Fade overlays for smooth scrolling edges */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#fefaf3]/95 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#fefaf3]/95 to-transparent z-10 pointer-events-none"></div>
            
            <div className="animate-marquee whitespace-nowrap inline-block text-kv-dark font-bold text-[15px] tracking-wide">
              {orderTvTickerMessage} <span className="text-emerald-500 mx-12 opacity-50">•</span> {orderTvTickerMessage} <span className="text-emerald-500 mx-12 opacity-50">•</span> {orderTvTickerMessage} <span className="text-emerald-500 mx-12 opacity-50">•</span> {orderTvTickerMessage} <span className="text-emerald-500 mx-12 opacity-50">•</span> {orderTvTickerMessage}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
