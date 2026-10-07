import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { POSScreen } from './screens/POSScreen';
import { TableMapScreen } from './screens/TableMapScreen';
import { KDSScreen } from './screens/KDSScreen';
import { QueueScreen } from './screens/QueueScreen';
import { AdminInventoryScreen } from './screens/Admin/AdminInventoryScreen';
import { QROrderScreen } from './screens/QROrderScreen';
import { useFullscreen } from './hooks/useFullscreen';
import { useModalOpen } from './hooks/useModalOpen';
import { AdminPortalScreen } from './screens/AdminPortalScreen';
import { AdminDashboard } from './screens/Admin/AdminDashboard';
import { FullLoginScreen } from './screens/FullLoginScreen';
import { AdminCustomerScreen } from './screens/Admin/AdminCustomerScreen';
import { SuperAdminDashboard } from './screens/SuperAdminDashboard';
import { OwnerDashboard } from './screens/OwnerDashboard';
import { LockScreen } from './screens/LockScreen';
import { ParcelBoardScreen } from './screens/ParcelBoardScreen';
import { DeliveryDispatchScreen } from './screens/DeliveryDispatchScreen';
import { useCartStore } from './store/cartStore';
import { useAuthStore } from './store/useAuthStore';
import { useSettingsStore } from './store/useSettingsStore';
import { 
  Utensils, LayoutGrid, Flame, Package, QrCode, 
  Wifi, WifiOff, ShieldCheck, Clock, Sparkles, Settings, Lock, Bike,
  ChevronLeft, ChevronRight, ChevronDown, LayoutDashboard, LogOut,
  MoreHorizontal, X, MonitorSpeaker, Users
} from 'lucide-react';
import { initSocketListeners } from './services/socket';
import { socket } from './services/socket';
import { isServerConfigured, getOperatingMode } from './services/serverConfig';
import { startAndroidMasterServer, stopAndroidMasterServer } from './services/localServer';
import { startMasterSyncPolling, stopMasterSyncPolling } from './services/socket';
import { SetupScreen } from './screens/SetupScreen';
import { ToastContainer } from './components/ToastContainer';

export type ScreenType = 'POS' | 'TABLES' | 'KDS' | 'INVENTORY' | 'QR' | 'ADMIN' | 'PARCEL' | 'DELIVERY' | 'DASHBOARD' | 'SETTINGS' | 'QUEUE' | 'CUSTOMERS';

const navItems = [
  { id: 'POS', label: 'POS Billing', icon: Utensils, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'TABLES', label: 'Floor Plan', icon: LayoutGrid, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'KDS', label: 'Kitchen (KDS)', icon: Flame, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'QUEUE', label: 'Order TV', icon: MonitorSpeaker, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'PARCEL', label: 'Parcel', icon: Package, role: 'NON_WAITER', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-[0_4px_12px_rgba(245,158,11,0.4)]', border: 'border-amber-500/50' },
  { id: 'DELIVERY', label: 'Delivery', icon: Bike, role: 'NON_WAITER', gradient: 'from-purple-400 to-indigo-500', shadow: 'shadow-[0_4px_12px_rgba(168,85,247,0.4)]', border: 'border-purple-500/50' },
  { id: 'QR', label: 'QR Orders', icon: QrCode, role: 'NON_WAITER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'CUSTOMERS', label: 'Customers', icon: Users, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'INVENTORY', label: 'Inventory', icon: Package, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'ADMIN', label: 'Settings', icon: Settings, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
];

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenType>(() => {
    return (localStorage.getItem('karvaanActiveScreen') as ScreenType) || 'POS';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileNavMoreOpen, setIsMobileNavMoreOpen] = useState(false);
  
  const { isOffline, toggleOffline, items, selectedTableName, isMobileCartOpen } = useCartStore();
  const { currentUser, isLocked, lockTerminal, logout } = useAuthStore();
  const operatingMode = useSettingsStore(s => s.operatingMode) || 'FINE_DINING';
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSetup, setShowSetup] = useState(!isServerConfigured());
  const isModalOpen = useModalOpen();

  // Dynamic theme-color: green for main app, dark for login/lock/setup
  const themeContext = showSetup ? 'setup' : (!currentUser || isLocked) ? 'login' : 'app';
  const { requestFullscreen } = useFullscreen(themeContext);

  // Set Default Screen on Boot based on Operating Mode
  useEffect(() => {
    if (!localStorage.getItem('karvaanActiveScreen')) {
      if (operatingMode === 'CLOUD_KITCHEN') {
        setActiveScreen('DELIVERY');
      } else {
        setActiveScreen('POS');
      }
    }
  }, [operatingMode]);

  useEffect(() => {
    localStorage.setItem('karvaanActiveScreen', activeScreen);
  }, [activeScreen]);

  const handleNavClick = (screen: ScreenType) => {
    setActiveScreen(screen);
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  }, []);

  useEffect(() => {
    useSettingsStore.getState().fetchSettings();
    initSocketListeners();
  }, []);

  // Sync WebSocket connection with user's restaurant session
  useEffect(() => {
    if (currentUser?.restaurantId) {
      socket.io.opts.query = { restaurantId: currentUser.restaurantId };
      socket.connect();
    } else {
      socket.disconnect();
    }
  }, [currentUser?.restaurantId]);

  // Validate the JWT token on app boot
  useEffect(() => {
    if (currentUser) {
      useAuthStore.getState().validateToken();
    }
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


  if (!currentUser) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <ToastContainer />
        <FullLoginScreen />
        {showSetup && <SetupScreen onComplete={() => setShowSetup(false)} />}
      </div>
    );
  }

  // If user is logged in but showSetup is true (e.g. they forced setup mode), 
  // we still overlay it on the main app
  if (currentUser && showSetup) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* We render a skeleton of the app in the background so it looks like it's over the app */}
          <div className="flex h-full bg-slate-900 opacity-50"></div>
        </div>
        <SetupScreen onComplete={() => setShowSetup(false)} />
      </div>
    );
  }

  if (currentUser && isLocked) {
    return <LockScreen />;
  }

  if (currentUser.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard />;
  }

  if (currentUser.role === 'OWNER') {
    return <OwnerDashboard />;
  }

  if (currentUser.role === 'KITCHEN' && activeScreen !== 'KDS') {
    setActiveScreen('KDS');
  }
  if (currentUser.role === 'DELIVERY' && activeScreen !== 'DELIVERY') {
    setActiveScreen('DELIVERY');
  }

  // Mobile Bottom Nav Logic
  const isWaiter = currentUser.role === 'WAITER';
  const mobilePrimaryItems = isWaiter 
    ? navItems.filter(i => ['POS', 'TABLES', 'KDS'].includes(i.id))
    : navItems.filter(i => ['POS', 'TABLES', 'KDS', 'DASHBOARD'].includes(i.id));

  const mobileMoreItems = isWaiter 
    ? [] 
    : navItems.filter(i => 
        !['POS', 'TABLES', 'KDS', 'DASHBOARD'].includes(i.id) && 
        (i.role === 'ALL' || i.role === 'NON_WAITER' || (i.role === 'ADMIN_MANAGER' && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')))
      );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-carbon-lines text-kv-dark font-sans selection:bg-kv-primary selection:text-white overflow-hidden transition-colors duration-300 p-0 md:py-4 md:pr-4 gap-0 md:gap-4 relative">
      <ToastContainer />
      
      {/* Sidebar Navigation (Desktop/Tablet) */}
      <aside className={`${isMobileCartOpen ? 'w-0 md:w-0 -translate-x-full opacity-0 overflow-hidden' : isSidebarOpen ? 'w-20 md:w-[220px] translate-x-0 opacity-100' : 'w-16 md:w-[64px] translate-x-0 opacity-100'} hidden md:flex bg-transparent flex-col shrink-0 transition-all duration-300 z-30 relative`}>
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
                // Role-based filtering
                if (item.role === 'NON_WAITER' && currentUser.role === 'WAITER') return null;
                if (item.role === 'ADMIN_MANAGER' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') return null;
                
                // Pipeline (Operating Mode) filtering
                if (operatingMode === 'QSR' && item.id === 'TABLES') return null; // Hide Tables in QSR
                if (operatingMode === 'CLOUD_KITCHEN' && (item.id === 'TABLES' || item.id === 'POS' || item.id === 'QR')) return null; // Hide POS, QR, Tables in Cloud Kitchen
                
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
          {activeScreen === 'QUEUE' && <QueueScreen />}
          {activeScreen === 'INVENTORY' && <AdminInventoryScreen />}
          {activeScreen === 'CUSTOMERS' && <AdminCustomerScreen />}
          {activeScreen === 'QR' && <QROrderScreen />}
          {activeScreen === 'ADMIN' && <AdminPortalScreen />}
          {activeScreen === 'DASHBOARD' && <AdminDashboard />}
          {activeScreen === 'PARCEL' && <ParcelBoardScreen />}
          {activeScreen === 'DELIVERY' && <DeliveryDispatchScreen />}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 p-3 z-30 pointer-events-none transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${isMobileCartOpen || isModalOpen ? 'translate-y-[120%] opacity-0' : 'translate-y-0 opacity-100'}`}>
        <nav className="flex items-center justify-around bg-[#0d212b]/80 backdrop-blur-2xl pb-safe pt-2 pb-2 px-2 rounded-[28px] border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto">
        {currentUser.role === 'DELIVERY' ? (
          <div className="w-full text-center text-purple-400 font-bold text-sm py-2">Delivery Rider Mode</div>
        ) : currentUser.role === 'KITCHEN' ? (
          <div className="w-full text-center text-amber-400 font-bold text-sm py-2">Kitchen Monitor Mode</div>
        ) : (
          <>
            {mobilePrimaryItems.map(item => {
              const isActive = activeScreen === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as ScreenType)}
                  className={`flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all ${isActive ? 'text-[#8cc63f]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span className={`text-[9px] font-bold ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                </button>
              );
            })}
            
            {/* MORE BUTTON */}
            {!isWaiter && (
              <button
                onClick={() => setIsMobileNavMoreOpen(true)}
                className={`flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all ${isMobileNavMoreOpen ? 'text-[#8cc63f]' : 'text-slate-400 hover:text-white'}`}
              >
                <MoreHorizontal className="w-6 h-6 stroke-2" />
                <span className="text-[9px] font-bold">More</span>
              </button>
            )}
          </>
        )}
        </nav>
      </div>

      {/* MOBILE "MORE" DRAWER */}
      {isMobileNavMoreOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
            onClick={() => setIsMobileNavMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-gradient-to-b from-[#1a2b38]/95 to-[#0d212b]/95 backdrop-blur-3xl rounded-t-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full md:hidden border-t border-white/10">
            <div className="w-full flex justify-center pt-3 pb-2" onClick={() => setIsMobileNavMoreOpen(false)}>
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>
            
            <div className="p-4 grid grid-cols-4 gap-4">
              {mobileMoreItems.map(item => {
                const isActive = activeScreen === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleNavClick(item.id as ScreenType);
                      setIsMobileNavMoreOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-2 group"
                  >
                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center transition-all active:scale-95 ${isActive ? `bg-gradient-to-br ${item.gradient} shadow-lg text-white` : 'bg-white/10 hover:bg-white/20 border border-white/5 text-slate-300'}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
              
              <button
                onClick={() => {
                  lockTerminal();
                  setIsMobileNavMoreOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-2 p-2"
              >
                <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/5 text-amber-400 transition-all active:scale-95">
                  <Lock className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">Lock</span>
              </button>

              <button
                onClick={() => {
                  logout();
                  setIsMobileNavMoreOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-2 p-2"
              >
                <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/5 text-rose-500 transition-all active:scale-95">
                  <LogOut className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">Logout</span>
              </button>
            </div>
            <div className="h-safe-bottom bg-transparent" />
          </div>
        </>
      )}

    </div>
  );
};
