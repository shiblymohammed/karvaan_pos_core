import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Menu as MenuIcon, Users, Settings, LogOut, Keyboard, BookOpen, Package, CloudOff, LayoutGrid } from 'lucide-react';
import { getQueueCount, getPendingActions, clearAction } from '../services/offlineQueue';
import { socket, emitAction } from '../services/socket';
import { motion } from 'framer-motion';
import { toast } from '../store/useToastStore';

import { AdminMenuManager } from './Admin/AdminMenuManager';
import { AdminStaffManager } from './Admin/AdminStaffManager';
import { AdminSettingsManager } from './Admin/AdminSettingsManager';
import { AdminCustomerLedger } from './Admin/AdminCustomerLedger';
import { AdminInventoryScreen } from './Admin/AdminInventoryScreen';
import { AdminTableManager } from './Admin/AdminTableManager';
import { AdminPrinterSettings } from './Admin/AdminPrinterSettings';
import { AdminComboStudio } from './Admin/AdminComboStudio';
import { AdminOrderHistory } from './Admin/AdminOrderHistory';
import { Printer, Utensils, History } from 'lucide-react';

type AdminTab = 'MENU' | 'COMBOS' | 'STAFF' | 'QUICK_KEYS' | 'SETTINGS' | 'LEDGER' | 'INVENTORY' | 'TABLES' | 'PRINTER' | 'HISTORY';

export const AdminPortalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    return (localStorage.getItem('adminActiveTab') as AdminTab) || 'MENU';
  });
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => setOfflineCount(await getQueueCount());
    updateCount();
    window.addEventListener('offline-queue-updated', updateCount);
    return () => window.removeEventListener('offline-queue-updated', updateCount);
  }, []);

  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const handleForceSync = async () => {
    if (!socket.connected) {
      toast.error("Cannot sync: No connection to server.");
      return;
    }
    const pending = await getPendingActions();
    if (pending.length === 0) {
      toast.info("No pending actions to sync.");
      return;
    }
    for (const action of pending) {
      emitAction(action.type, action.payload);
      if (action.id) await clearAction(action.id);
    }
    toast.success(`Successfully synced ${pending.length} actions.`);
  };

  return (

    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] overflow-hidden text-slate-800">
      {/* Admin Sidebar */}
      <aside className="w-full lg:w-64 bg-white/70 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/60 shadow-lg flex flex-col p-3 lg:p-4 z-10 shrink-0">
        <div className="hidden lg:block mb-6 px-2">
          <h2 className="text-xl font-black text-slate-800">Admin Portal</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">Management & Analytics</p>
        </div>

        {/* Navigation - Horizontal on mobile, vertical on desktop */}
        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 scrollbar-none lg:flex-1 w-full">
          
          {[
            { id: 'MENU', label: 'Menu Manager', icon: MenuIcon },
            { id: 'COMBOS', label: 'Combo Studio', icon: Utensils },
            { id: 'TABLES', label: 'Tables & Floors', icon: LayoutGrid },
            { id: 'STAFF', label: 'Staff & Waiters', icon: Users },
            { id: 'INVENTORY', label: 'Inventory & Recipes', icon: Package },
            { id: 'LEDGER', label: 'Customer Ledger', icon: BookOpen },
            { id: 'HISTORY', label: 'Order History', icon: History },
            { id: 'PRINTER', label: 'Label & Printers', icon: Printer },
            { id: 'SETTINGS', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`relative shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3.5 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer active:scale-95 ${
                  isActive
                    ? 'text-[#0f172a]'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="adminPortalTab"
                    className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl shadow-md z-0"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`h-4 w-4 lg:h-5 lg:w-5 shrink-0 relative z-10 ${isActive ? 'text-[#0f172a]' : ''}`} />
                <span className="hidden lg:inline relative z-10">{label}</span>
                <span className="lg:hidden text-xs relative z-10">{label.split(' ')[0]}</span>
              </button>
            );
          })}

          {/* Offline Sync Warning - Inline on mobile, stacked on desktop */}
          {offlineCount > 0 && (
            <div className="shrink-0 lg:w-full lg:mt-4 p-2.5 lg:p-3 bg-rose-50 border border-rose-200 rounded-xl flex lg:flex-col items-center lg:items-start gap-3 lg:gap-0">
              <div className="flex items-center gap-2 lg:mb-2">
                <CloudOff className="h-4 w-4 text-rose-500" />
                <p className="text-xs font-black text-rose-600 hidden lg:block">Offline Sync Pending</p>
              </div>
              <p className="text-[10px] font-bold text-rose-500 lg:mb-2 whitespace-nowrap">
                {offlineCount} action{offlineCount !== 1 ? 's' : ''} waiting.
              </p>
              <button
                onClick={handleForceSync}
                className="py-1 lg:py-1.5 px-3 lg:w-full bg-rose-500 hover:bg-rose-600 text-white text-[10px] lg:text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Force Sync
              </button>
            </div>
          )}

          {/* Logout Button */}
          <div className="shrink-0 lg:w-full lg:pt-4 lg:mt-4 lg:border-t lg:border-pos-border ml-auto lg:ml-0 flex items-center">
            <button className="lg:w-full flex items-center justify-center lg:justify-start gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap">
              <LogOut className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
              <span className="hidden lg:inline">Logout Admin</span>
              <span className="lg:hidden">Logout</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-transparent flex flex-col">
        {activeTab === 'MENU' && <AdminMenuManager />}
        {activeTab === 'COMBOS' && <AdminComboStudio />}
        {activeTab === 'TABLES' && <AdminTableManager />}
        {activeTab === 'STAFF' && <AdminStaffManager />}
        {activeTab === 'SETTINGS' && <AdminSettingsManager />}
        { activeTab === 'LEDGER' && <AdminCustomerLedger />}
        { activeTab === 'INVENTORY' && <AdminInventoryScreen />}
        { activeTab === 'HISTORY' && <AdminOrderHistory />}
        { activeTab === 'PRINTER' && <AdminPrinterSettings />}
      </main>
    </div>
  );
};
