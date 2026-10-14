import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Utensils, LayoutGrid, Flame, Package, QrCode,
  Lock, Bike, MoreHorizontal, LayoutDashboard,
  MonitorSpeaker
} from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useModalOpen } from '../../hooks/useModalOpen';
import { SCREEN_PATHS, type ScreenType } from './screenPaths';
import { navItems } from './Sidebar';

interface MobileNavProps {
  onOpenMore: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenMore }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobileCartOpen } = useCartStore();
  const { currentUser, lockTerminal } = useAuthStore();
  const operatingMode = useSettingsStore(s => s.operatingMode) || 'FINE_DINING';
  const isModalOpen = useModalOpen();

  if (!currentUser) return null;

  const activeScreen = (Object.entries(SCREEN_PATHS) as [ScreenType, string][])
    .find(([, path]) => location.pathname === path)?.[0] ?? 'POS';

  const isWaiter = currentUser.role === 'WAITER';

  const mobilePrimaryItems = isWaiter
    ? navItems.filter(i => ['POS', 'TABLES', 'KDS'].includes(i.id))
    : navItems.filter(i => ['POS', 'TABLES', 'KDS', 'DASHBOARD'].includes(i.id));

  const handleNavClick = (screen: ScreenType) => {
    navigate(SCREEN_PATHS[screen]);
  };

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-30 pointer-events-none transition-transform duration-300 ease-out will-change-transform ${isMobileCartOpen || isModalOpen ? 'translate-y-[120%]' : 'translate-y-0'}`}>
      <nav className="flex items-center justify-around bg-[#151e32] py-1.5 px-2 rounded-[28px] border border-white/10 shadow-2xl pointer-events-auto">
        {currentUser.role === 'DELIVERY' ? (
          <div className="w-full text-center text-purple-400 font-bold text-sm py-2">Delivery Rider Mode</div>
        ) : currentUser.role === 'KITCHEN' ? (
          <div className="w-full text-center text-amber-400 font-bold text-sm py-2">Kitchen Monitor Mode</div>
        ) : (
          <>
            {mobilePrimaryItems.map(item => {
              const isActive = activeScreen === item.id;
              const Icon = item.icon;
              // Filter by operating mode
              if (operatingMode === 'QSR' && item.id === 'TABLES') return null;
              if (operatingMode === 'CLOUD_KITCHEN' && (item.id === 'TABLES' || item.id === 'POS')) return null;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all ${isActive ? 'text-[#8cc63f]' : 'text-slate-400 hover:text-white'}`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span className={`text-[9px] font-bold ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                </button>
              );
            })}

            {!isWaiter && (
              <button
                onClick={onOpenMore}
                className="flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all text-slate-400 hover:text-white"
              >
                <MoreHorizontal className="w-6 h-6 stroke-2" />
                <span className="text-[9px] font-bold">More</span>
              </button>
            )}
          </>
        )}
      </nav>
    </div>
  );
};
