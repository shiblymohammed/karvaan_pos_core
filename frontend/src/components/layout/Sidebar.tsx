import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Utensils, LayoutGrid, Flame, Package, QrCode,
  ShieldCheck, Lock, Bike,
  ChevronLeft, ChevronRight, LayoutDashboard, LogOut,
  MonitorSpeaker, Users, Settings
} from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { SCREEN_PATHS, type ScreenType } from './screenPaths';

const navItems = [
  { id: 'POS' as ScreenType, label: 'POS Billing', icon: Utensils, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'TABLES' as ScreenType, label: 'Floor Plan', icon: LayoutGrid, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'KDS' as ScreenType, label: 'Kitchen (KDS)', icon: Flame, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'QUEUE' as ScreenType, label: 'Order TV', icon: MonitorSpeaker, role: 'ALL', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'PARCEL' as ScreenType, label: 'Parcel', icon: Package, role: 'NON_WAITER', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-[0_4px_12px_rgba(245,158,11,0.4)]', border: 'border-amber-500/50' },
  { id: 'DELIVERY' as ScreenType, label: 'Delivery', icon: Bike, role: 'NON_WAITER', gradient: 'from-purple-400 to-indigo-500', shadow: 'shadow-[0_4px_12px_rgba(168,85,247,0.4)]', border: 'border-purple-500/50' },
  { id: 'QR' as ScreenType, label: 'QR Menu Preview', icon: QrCode, role: 'NON_WAITER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'DASHBOARD' as ScreenType, label: 'Dashboard', icon: LayoutDashboard, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'CUSTOMERS' as ScreenType, label: 'Customers', icon: Users, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
  { id: 'ADMIN' as ScreenType, label: 'Settings', icon: Settings, role: 'ADMIN_MANAGER', gradient: 'from-[#8cc63f] to-[#6a9a2a]', shadow: 'shadow-[0_4px_12px_rgba(140,198,63,0.4)]', border: 'border-[#8cc63f]/50' },
];

export { navItems };

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, selectedTableName, isMobileCartOpen } = useCartStore();
  const { currentUser, lockTerminal, logout } = useAuthStore();
  const operatingMode = useSettingsStore(s => s.operatingMode) || 'FINE_DINING';

  if (!currentUser) return null;

  // Determine active screen from URL
  const activeScreen = (Object.entries(SCREEN_PATHS) as [ScreenType, string][])
    .find(([, path]) => location.pathname === path)?.[0] ?? 'POS';

  const handleNavClick = (screen: ScreenType) => {
    navigate(SCREEN_PATHS[screen]);
  };

  return (
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
            {navItems.map((item) => {
              if (item.role === 'NON_WAITER' && currentUser.role === 'WAITER') return null;
              if (item.role === 'ADMIN_MANAGER' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') return null;
              if (operatingMode === 'QSR' && item.id === 'TABLES') return null;
              if (operatingMode === 'CLOUD_KITCHEN' && (item.id === 'TABLES' || item.id === 'POS' || item.id === 'QR')) return null;

              const isActive = activeScreen === item.id;

              return (
                <React.Fragment key={item.id}>
                  {item.id === 'DASHBOARD' && <div className="my-2 border-t border-white/5 mx-2 hidden md:block"></div>}
                  <div className="relative group/navitem w-full flex justify-center">
                    <button
                      onClick={() => handleNavClick(item.id)}
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

                    {/* Collapsed tooltip */}
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

        <div className="mt-auto"></div>

        {/* Bottom: User profile, Lock, Logout */}
        <div className="flex flex-col gap-2 pt-4 border-t border-white/5 w-full">
          {/* User Profile Badge */}
          <div className="relative group/navitem w-full flex justify-center mb-2">
            <div className={`relative flex items-center gap-3.5 rounded-xl transition-all duration-300 cursor-default select-none overflow-hidden ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'}`}>
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
  );
};
