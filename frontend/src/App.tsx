import React, { useState, useEffect } from 'react';
import { POSScreen } from './screens/POSScreen';
import { TableMapScreen } from './screens/TableMapScreen';
import { KDSScreen } from './screens/KDSScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { QROrderScreen } from './screens/QROrderScreen';
import { AdminPortalScreen } from './screens/AdminPortalScreen';
import { FullLoginScreen } from './screens/FullLoginScreen';
import { LockScreen } from './screens/LockScreen';
import { ParcelBoardScreen } from './screens/ParcelBoardScreen';
import { DeliveryDispatchScreen } from './screens/DeliveryDispatchScreen';
import { useCartStore } from './store/cartStore';
import { useAuthStore } from './store/useAuthStore';
import { 
  Utensils, LayoutGrid, Flame, Package, QrCode, 
  Wifi, WifiOff, ShieldCheck, Clock, Sparkles, Settings, Lock, Bike,
  ChevronLeft, ChevronRight, ChevronDown, LayoutDashboard, LogOut
} from 'lucide-react';
import { initSocketListeners } from './services/socket';
import { socket } from './services/socket';
import { isServerConfigured, getOperatingMode } from './services/serverConfig';
import { startAndroidMasterServer, stopAndroidMasterServer } from './services/localServer';
import { startMasterSyncPolling, stopMasterSyncPolling } from './services/socket';
import { SetupScreen } from './screens/SetupScreen';

export type ScreenType = 'POS' | 'TABLES' | 'KDS' | 'INVENTORY' | 'QR' | 'ADMIN' | 'PARCEL' | 'DELIVERY' | 'DASHBOARD' | 'SETTINGS';

const navItems = [
  { id: 'POS', label: 'POS Billing', icon: Utensils, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'TABLES', label: 'Floor Plan', icon: LayoutGrid, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'KDS', label: 'Kitchen (KDS)', icon: Flame, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'PARCEL', label: 'Parcel', icon: Package, role: 'NON_WAITER', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-[0_4px_12px_rgba(245,158,11,0.4)]', border: 'border-amber-500/50' },
  { id: 'DELIVERY', label: 'Delivery', icon: Bike, role: 'NON_WAITER', gradient: 'from-purple-400 to-indigo-500', shadow: 'shadow-[0_4px_12px_rgba(168,85,247,0.4)]', border: 'border-purple-500/50' },
  { id: 'QR', label: 'QR Orders', icon: QrCode, role: 'NON_WAITER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'INVENTORY', label: 'Inventory', icon: Package, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'ADMIN', label: 'Settings', icon: Settings, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
];

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('POS');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const { isOffline, toggleOffline, items, selectedTableName } = useCartStore();
  const { currentUser, isLocked, lockTerminal, logout } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSetup, setShowSetup] = useState(!isServerConfigured());

  const handleNavClick = (screen: ScreenType) => {
    // @ts-ignore
    if (document.startViewTransition) {
      // @ts-ignore
      document.startViewTransition(() => setActiveScreen(screen));
    } else {
      setActiveScreen(screen);
    }
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  }, []);

  useEffect(() => {
    initSocketListeners();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showSetup) {
      const mode = getOperatingMode();
      if (mode === 'ANDROID_MASTER') {
        startAndroidMasterServer();
      } else if (mode === 'WAITER_CLIENT') {
        startMasterSyncPolling();
      }
    }
    return () => {
      stopAndroidMasterServer();
      stopMasterSyncPolling();
    };
  }, [showSetup]);

  if (showSetup) {
    return <SetupScreen onComplete={() => setShowSetup(false)} />;
  }

  if (!currentUser) {
    return <FullLoginScreen />;
  }

  if (currentUser && isLocked) {
    return <LockScreen />;
  }

  if (currentUser.role === 'KITCHEN' && activeScreen !== 'KDS') {
    setActiveScreen('KDS');
  }
  if (currentUser.role === 'DELIVERY' && activeScreen !== 'DELIVERY') {
    setActiveScreen('DELIVERY');
  }

  return (
    <div className="flex h-screen bg-carbon-lines text-kv-dark font-sans selection:bg-kv-primary selection:text-white overflow-hidden transition-colors duration-300 p-0 md:py-4 md:pr-4 gap-0 md:gap-4 relative">
      


      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-20 md:w-[220px]' : 'w-16 md:w-[64px]'} bg-transparent flex flex-col shrink-0 transition-all duration-300 z-30 relative`}>
        {/* Edge Collapse Trigger */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex items-center justify-center h-32 w-5 rounded-r-xl bg-[#0d212b] bg-carbon-lines text-slate-400 hover:bg-[#8cc63f] hover:text-[#0f172a] active:scale-95 transition-all absolute -right-5 top-1/2 -translate-y-1/2 z-50 cursor-pointer drop-shadow-2xl group/notch select-none touch-manipulation"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between md:px-5 shrink-0 border-b border-white/5 relative">
          <div className="flex items-center gap-2 overflow-hidden">
            <img 
              src="/logo/karvaan_logo_main.png" 
              alt="Karvaan POS" 
              className={`h-6 md:h-7 object-contain drop-shadow-sm transition-all duration-300 ${isSidebarOpen ? 'opacity-100 min-w-[120px]' : 'opacity-0 min-w-0 w-0 hidden md:block'}`}
            />
            <span className={`md:hidden text-[#8cc63f] font-black text-2xl tracking-tighter w-full text-center ${isSidebarOpen ? 'hidden' : 'block'}`}>K.</span>
            {!isSidebarOpen && <span className="hidden md:block text-[#8cc63f] font-black text-2xl tracking-tighter w-full text-center">K.</span>}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-visible py-4 px-1.5 md:px-2 flex flex-col gap-2 items-center md:items-stretch relative z-40 overscroll-none touch-pan-y scroll-smooth">
          {currentUser.role === 'DELIVERY' ? (
            <span className="text-xs font-black px-4 py-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 flex items-center gap-3">
              <Bike className="h-6 w-6 text-purple-400 shrink-0" /> <span className={`transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Delivery Rider</span>
            </span>
          ) : currentUser.role === 'KITCHEN' ? (
            <span className="text-xs font-black px-4 py-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 flex items-center gap-3">
              <Flame className="h-6 w-6 text-amber-400 shrink-0" /> <span className={`transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Kitchen Monitor</span>
            </span>
          ) : (
            <>
              {navItems.map((item, index) => {
                if (item.role === 'NON_WAITER' && currentUser.role === 'WAITER') return null;
                if (item.role === 'ADMIN_MANAGER' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') return null;
                
                const isActive = activeScreen === item.id;
                
                return (
                  <React.Fragment key={item.id}>
                    {item.id === 'DASHBOARD' && <div className="my-2 border-t border-white/5 mx-2 hidden md:block"></div>}
                    <div className="relative group/navitem w-full flex justify-center">
                      <button
                        onClick={() => handleNavClick(item.id as ScreenType)}
                        className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0 hover:scale-[1.15] hover:z-50'} ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                      {isActive && (
                        <div 
                          className={`absolute inset-0 z-0 rounded-xl bg-gradient-to-br ${item.gradient} ${item.shadow} border ${item.border}`}
                          style={{ viewTransitionName: 'sidebar-active-pill' }}
                        />
                      )}
                      {!isActive && (
                        <div className="absolute inset-0 z-0 rounded-xl bg-transparent group-hover/btn:bg-[#151e32] border border-transparent group-hover/btn:border-white/10 transition-colors duration-300" />
                      )}
                      
                      <item.icon className="h-6 w-6 shrink-0 relative z-10" />
                      <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>{item.label}</span>
                      
                      {item.id === 'POS' && items.length > 0 && (
                        <span className={`w-5 h-5 rounded-full relative z-10 text-[10px] items-center justify-center font-black shadow-sm ml-auto ${isActive ? 'bg-white text-[#78ad33]' : 'bg-[#8cc63f] text-white'} ${isSidebarOpen ? 'flex' : 'hidden md:hidden'} hidden md:flex`}>
                          {items.length}
                        </span>
                      )}
                      {item.id === 'TABLES' && selectedTableName && (
                        <span className={`text-[10px] px-1.5 py-0.5 relative z-10 rounded-md font-black ml-auto hidden md:flex ${isActive ? 'bg-white text-[#78ad33]' : 'bg-[#8cc63f]/20 text-[#8cc63f] border border-[#8cc63f]/30'} ${isSidebarOpen ? 'flex' : 'hidden md:hidden'}`}>
                          {selectedTableName}
                        </span>
                      )}
                    </button>

                    {/* Fluid Popup Tooltip (Only in Collapsed View) */}
                    {!isSidebarOpen && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 -translate-x-3 pointer-events-none group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-300 z-50 flex items-center drop-shadow-2xl">
                        <div className="w-1.5 h-1.5 bg-[#151e32] border-t border-l border-white/10 rotate-45 -mr-1 z-0 rounded-[1px]"></div>
                        <div className="bg-[#151e32] text-white text-[13.5px] font-bold px-3.5 py-2 rounded-xl shadow-2xl border border-white/10 whitespace-nowrap relative z-10">
                          {item.label}
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
                );
              })}
            </>
          )}

          {/* Bottom Actions Spacer */}
          <div className="mt-auto"></div>
          
          <div className="flex flex-col gap-2 pt-4 border-t border-white/5 w-full">
            {/* User Profile Badge */}
            <div className="relative group/navitem w-full flex justify-center mb-2">
              <div 
                className={`relative flex items-center gap-3.5 rounded-xl transition-all duration-300 cursor-default select-none overflow-hidden ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'}`}
              >
                <div className="h-9 w-9 rounded-full bg-[#151e32] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="h-5 w-5 text-[#8cc63f]" />
                </div>
                <div className={`flex-col items-start shrink-0 truncate transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 w-auto flex' : 'opacity-0 w-0 hidden'}`}>
                  <span className="text-sm font-bold text-white leading-tight block truncate">{currentUser.name}</span>
                  <span className="text-[10px] uppercase font-black text-[#8cc63f] tracking-wide block">{currentUser.role}</span>
                </div>
              </div>
              {!isSidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 -translate-x-3 pointer-events-none group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-300 z-50 flex flex-col items-start drop-shadow-2xl">
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-[#151e32] border-b border-l border-white/10 rotate-45 z-0 rounded-sm"></div>
                  <div className="bg-[#151e32] px-3.5 py-2 rounded-xl shadow-2xl border border-white/10 whitespace-nowrap relative z-10 flex flex-col">
                    <span className="text-sm font-bold text-white leading-tight">{currentUser.name}</span>
                    <span className="text-[10px] uppercase font-black text-[#8cc63f] tracking-wide">{currentUser.role}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Lock Button */}
            <div className="relative group/navitem w-full flex justify-center">
              <button
                onClick={() => lockTerminal()}
                className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0 hover:scale-[1.15] hover:z-50'} text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10`}
              >
                <Lock className="h-6 w-6 shrink-0 relative z-10" />
                <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Lock Terminal</span>
              </button>
              {!isSidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 -translate-x-3 pointer-events-none group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-300 z-50 flex items-center drop-shadow-2xl">
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-[#151e32] border-b border-l border-white/10 rotate-45 z-0 rounded-sm"></div>
                  <div className="bg-[#151e32] text-amber-400 text-[13.5px] font-bold px-3.5 py-2 rounded-xl shadow-2xl border border-white/10 whitespace-nowrap relative z-10">
                    Lock Terminal
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="relative group/navitem w-full flex justify-center">
              <button
                onClick={() => logout()}
                className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0 hover:scale-[1.15] hover:z-50'} text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10`}
              >
                <LogOut className="h-6 w-6 shrink-0 relative z-10" />
                <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Logout</span>
              </button>
              {!isSidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 -translate-x-3 pointer-events-none group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-300 z-50 flex items-center drop-shadow-2xl">
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-[#151e32] border-b border-l border-white/10 rotate-45 z-0 rounded-sm"></div>
                  <div className="bg-[#151e32] text-rose-400 text-[13.5px] font-bold px-3.5 py-2 rounded-xl shadow-2xl border border-white/10 whitespace-nowrap relative z-10">
                    Logout
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-kv-creme relative md:rounded-[24px] shadow-2xl border-0 md:border md:border-white/10 overflow-hidden h-full z-10">
        
        {/* Content routing */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full">
          {activeScreen === 'POS' && <POSScreen />}
          {activeScreen === 'TABLES' && <TableMapScreen onNavigateToPOS={() => setActiveScreen('POS')} />}
          {activeScreen === 'KDS' && <KDSScreen />}
          {activeScreen === 'INVENTORY' && <InventoryScreen />}
          {activeScreen === 'QR' && <QROrderScreen />}
          {activeScreen === 'ADMIN' && <AdminPortalScreen />}
          {activeScreen === 'PARCEL' && <ParcelBoardScreen />}
          {activeScreen === 'DELIVERY' && <DeliveryDispatchScreen />}
        </div>
      </main>
    </div>
  );
};
