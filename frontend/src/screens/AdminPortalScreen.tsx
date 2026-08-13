import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Menu as MenuIcon, Users, Settings, LogOut, Keyboard, BookOpen, Package, CloudOff, LayoutGrid } from 'lucide-react';
import { getQueueCount, getPendingActions, clearAction } from '../services/offlineQueue';
import { socket, emitAction } from '../services/socket';


import { AdminMenuManager } from './Admin/AdminMenuManager';
import { AdminStaffManager } from './Admin/AdminStaffManager';
import { AdminSettingsManager } from './Admin/AdminSettingsManager';
import { AdminCustomerLedger } from './Admin/AdminCustomerLedger';
import { AdminInventoryScreen } from './Admin/AdminInventoryScreen';
import { AdminTableManager } from './Admin/AdminTableManager';

type AdminTab = 'MENU' | 'STAFF' | 'SETTINGS' | 'LEDGER' | 'INVENTORY' | 'TABLES';

export const AdminPortalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('MENU');
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => setOfflineCount(await getQueueCount());
    updateCount();
    window.addEventListener('offline-queue-updated', updateCount);
    return () => window.removeEventListener('offline-queue-updated', updateCount);
  }, []);

  const handleForceSync = async () => {
    if (!socket.connected) {
      alert("Cannot sync: No connection to server.");
      return;
    }
    const pending = await getPendingActions();
    if (pending.length === 0) {
      alert("No pending actions to sync.");
      return;
    }
    for (const action of pending) {
      emitAction(action.type, action.payload);
      if (action.id) await clearAction(action.id);
    }
    alert(`Successfully synced ${pending.length} actions.`);
  };

  return (

    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-pos-bg overflow-hidden transition-colors duration-250 text-pos-text">
      {/* Admin Sidebar */}
      <aside className="w-full lg:w-64 bg-pos-sidebar border-b lg:border-b-0 lg:border-r border-pos-border shadow-glass flex flex-col p-3 lg:p-4 z-10 transition-colors duration-250 shrink-0">
        <div className="hidden lg:block mb-8 px-2">
          <h2 className="text-xl font-black text-pos-text">Admin Portal</h2>
          <p className="text-xs font-bold text-pos-text-muted mt-1">Management & Analytics</p>
        </div>

        {/* Navigation - Horizontal on mobile, vertical on desktop */}
        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 scrollbar-none lg:flex-1 w-full">
          
          <button
            onClick={() => setActiveTab('MENU')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'MENU'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <MenuIcon className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            Menu Manager
          </button>

          <button
            onClick={() => setActiveTab('TABLES')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'TABLES'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <LayoutGrid className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            <span className="hidden lg:inline">Tables & Floors</span>
            <span className="lg:hidden">Tables</span>
          </button>

          <button
            onClick={() => setActiveTab('STAFF')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'STAFF'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Users className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            Staff & Waiters
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'SETTINGS'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Settings className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            System & Quick-Keys
          </button>
          <button
            onClick={() => setActiveTab('INVENTORY')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'INVENTORY'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Package className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            Inventory & Recipes
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-4 py-2.5 lg:py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'LEDGER'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <BookOpen className="h-4 w-4 lg:h-5 lg:w-5 shrink-0" />
            Customer Ledger
          </button>

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
      <main className="flex-1 overflow-hidden relative bg-pos-bg">
        {activeTab === 'MENU' && <AdminMenuManager />}
        {activeTab === 'TABLES' && <AdminTableManager />}
        {activeTab === 'STAFF' && <AdminStaffManager />}
        {activeTab === 'SETTINGS' && <AdminSettingsManager />}
        {activeTab === 'LEDGER' && <AdminCustomerLedger />}
        {activeTab === 'INVENTORY' && <AdminInventoryScreen />}
      </main>
    </div>
  );
};
