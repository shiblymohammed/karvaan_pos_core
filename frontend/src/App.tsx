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
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/useAuthStore';
import { 
  Utensils, LayoutGrid, Flame, Package, QrCode, 
  Wifi, WifiOff, ShieldCheck, Sun, Moon, Clock, Sparkles, Settings, Lock, Bike
} from 'lucide-react';
import { initSocketListeners } from './services/socket';

export type ScreenType = 'POS' | 'TABLES' | 'KDS' | 'INVENTORY' | 'QR' | 'ADMIN' | 'PARCEL' | 'DELIVERY';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('POS');
  const { isOffline, toggleOffline, items, selectedTableName } = useCartStore();
  const { theme, toggleTheme } = useThemeStore();
  const { currentUser, isLocked, lockTerminal, logout } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Enforce DOM class on mount and theme change to guarantee 100% reliable theme toggling
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');
    }
  }, [theme]);

  // Initialize WebSocket listeners for cross-device sync (run once on mount)
  useEffect(() => {
    initSocketListeners();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!currentUser) {
    return <FullLoginScreen />;
  }

  if (currentUser && isLocked) {
    return <LockScreen />;
  }

  // Ensure active screen is allowed for the user. If they are Kitchen and on POS, force to KDS.
  if (currentUser.role === 'KITCHEN' && activeScreen !== 'KDS') {
    setActiveScreen('KDS');
  }
  if (currentUser.role === 'DELIVERY' && activeScreen !== 'DELIVERY') {
    setActiveScreen('DELIVERY');
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text flex flex-col font-sans selection:bg-pos-accent selection:text-white transition-colors duration-250">
      {/* Top Navigation Bar */}
      <header className="h-16 bg-pos-sidebar border-b border-pos-border px-4 flex items-center justify-between shadow-glass z-20 transition-colors duration-250">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pos-accent to-teal-600 flex items-center justify-center font-black text-white text-lg shadow-glow-accent shrink-0">
            K
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-pos-text flex items-center gap-2">
              <span>Karvaan POS Core</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                v1.0 Pro
              </span>
            </h1>
            <p className="text-[11px] text-pos-text-muted hidden sm:block font-medium">
              3-in-1 Platform • Fast Checkout • Offline-First
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-pos-card p-1 rounded-xl border border-pos-border shadow-sm">
          {currentUser.role === 'DELIVERY' ? (
            <span className="text-xs font-black px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
              <Bike className="h-4 w-4 text-purple-400" /> Delivery Rider Portal
            </span>
          ) : currentUser.role === 'KITCHEN' ? (
            <span className="text-xs font-black px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
              <Flame className="h-4 w-4 text-amber-400" /> KDS Kitchen Monitor
            </span>
          ) : (
            <>
              <button
                onClick={() => setActiveScreen('POS')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'POS'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                    : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <Utensils className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">POS Billing</span>
                <span className="md:hidden">POS</span>
                {items.length > 0 && (
                  <span className="w-4.5 h-4.5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black shadow-sm">
                    {items.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveScreen('TABLES')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'TABLES'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                    : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Floor Plan</span>
                <span className="md:hidden">Tables</span>
                {selectedTableName && (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 rounded font-black">
                    {selectedTableName}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveScreen('KDS')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'KDS'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                    : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <Flame className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Kitchen (KDS)</span>
                <span className="md:hidden">KDS</span>
              </button>

              {currentUser.role !== 'WAITER' && (
                <>
                  <button
                    onClick={() => setActiveScreen('PARCEL')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeScreen === 'PARCEL'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                        : 'text-pos-text-muted hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400'
                    }`}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Parcel Board</span>
                    <span className="md:hidden">Parcel</span>
                  </button>

                  <button
                    onClick={() => setActiveScreen('DELIVERY')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeScreen === 'DELIVERY'
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm'
                        : 'text-pos-text-muted hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400'
                    }`}
                  >
                    <Bike className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Delivery</span>
                    <span className="md:hidden">Delivery</span>
                  </button>

                  <button
                    onClick={() => setActiveScreen('QR')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeScreen === 'QR'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                        : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">QR Ordering</span>
                    <span className="md:hidden">QR</span>
                  </button>
                </>
              )}

              {(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
                <>
                  <button
                    onClick={() => setActiveScreen('INVENTORY')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeScreen === 'INVENTORY'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                        : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Inventory</span>
                    <span className="md:hidden">Stock</span>
                  </button>

                  <button
                    onClick={() => setActiveScreen('ADMIN')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeScreen === 'ADMIN'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm'
                        : 'text-pos-text-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Admin</span>
                    <span className="md:hidden">Admin</span>
                  </button>
                </>
              )}
            </>
          )}
        </nav>

        {/* Right Action Bar: Clock, Theme Switcher & Status Pill */}
        <div className="flex items-center gap-2.5">
          {/* Live Clock */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-pos-card rounded-xl border border-pos-border text-xs font-mono font-bold text-pos-text shadow-sm" title="Live Terminal Time">
            <Clock className="h-3.5 w-3.5 text-pos-accent animate-pulse" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-pos-card hover:bg-pos-card-hover border border-pos-border text-pos-text transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-amber-400 animate-spin" style={{ animationDuration: '12s' }} />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-teal-600 animate-bounce" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          {/* Online / Offline Toggle */}
          <button
            onClick={toggleOffline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
              isOffline
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
            }`}
            title="Click to simulate network disconnection / connection"
          >
            {isOffline ? <WifiOff className="h-4 w-4 text-rose-500 shrink-0" /> : <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />}
            <span className="hidden xl:inline">{isOffline ? 'Offline (SQLite)' : 'Online (Cloud)'}</span>
          </button>

          <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 bg-pos-card rounded-xl border border-pos-border text-xs font-bold text-pos-text-muted shadow-sm">
            <ShieldCheck className="h-4 w-4 text-pos-accent" />
            <span>{currentUser.name}</span>
          </div>

          <button 
            onClick={lockTerminal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Lock Terminal"
          >
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Lock</span>
          </button>
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Full Logout"
          >
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Screen Content View */}
      <main className="flex-1 overflow-hidden transition-colors duration-250">
        {activeScreen === 'POS' && <POSScreen />}
        {activeScreen === 'TABLES' && <TableMapScreen onNavigateToPOS={() => setActiveScreen('POS')} />}
        {activeScreen === 'KDS' && <KDSScreen />}
        {activeScreen === 'INVENTORY' && <InventoryScreen />}
        {activeScreen === 'QR' && <QROrderScreen />}
        {activeScreen === 'ADMIN' && <AdminPortalScreen />}
        {activeScreen === 'PARCEL' && <ParcelBoardScreen />}
        {activeScreen === 'DELIVERY' && <DeliveryDispatchScreen />}
      </main>
    </div>
  );
};
