import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { navItems } from './Sidebar';
import { SCREEN_PATHS, type ScreenType } from './screenPaths';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, lockTerminal, logout } = useAuthStore();
  const operatingMode = useSettingsStore(s => s.operatingMode) || 'FINE_DINING';

  if (!isOpen || !currentUser) return null;

  const activeScreen = (Object.entries(SCREEN_PATHS) as [ScreenType, string][])
    .find(([, path]) => location.pathname === path)?.[0] ?? 'POS';

  const mobileMoreItems = navItems.filter(item => {
    if (['POS', 'TABLES', 'KDS', 'DASHBOARD'].includes(item.id)) return false;
    if (item.role === 'NON_WAITER' && currentUser.role === 'WAITER') return false;
    if (item.role === 'ADMIN_MANAGER' && currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER') return false;
    if (operatingMode === 'CLOUD_KITCHEN' && (item.id === 'QR')) return false;
    return true;
  });

  const handleNavClick = (screen: ScreenType) => {
    navigate(SCREEN_PATHS[screen]);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-[#0f172a]/80 z-40 md:hidden transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[#151e32] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full md:hidden border-t border-white/5 will-change-transform">
        <div className="w-full flex justify-center pt-3 pb-2" onClick={onClose}>
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="p-4 grid grid-cols-4 gap-4">
          {mobileMoreItems.map(item => {
            const isActive = activeScreen === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
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
            onClick={() => { lockTerminal(); onClose(); }}
            className="flex flex-col items-center justify-center gap-2 p-2"
          >
            <div className="w-14 h-14 rounded-[20px] flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/5 text-amber-400 transition-all active:scale-95">
              <Lock className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 text-center leading-tight">Lock</span>
          </button>

          <button
            onClick={() => { logout(); onClose(); }}
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
  );
};
