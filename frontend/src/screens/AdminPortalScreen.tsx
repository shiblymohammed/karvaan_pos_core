import React, { useState } from 'react';
import { LayoutDashboard, Menu as MenuIcon, Users, Settings, LogOut, Keyboard, BookOpen, Package } from 'lucide-react';
import { AdminDashboard } from './Admin/AdminDashboard';
import { AdminMenuManager } from './Admin/AdminMenuManager';
import { AdminStaffManager } from './Admin/AdminStaffManager';
import { AdminSettingsManager } from './Admin/AdminSettingsManager';
import { AdminCustomerLedger } from './Admin/AdminCustomerLedger';
import { AdminInventoryScreen } from './Admin/AdminInventoryScreen';

type AdminTab = 'DASHBOARD' | 'MENU' | 'STAFF' | 'SETTINGS' | 'LEDGER' | 'INVENTORY';

export const AdminPortalScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');

  return (
    <div className="flex h-[calc(100vh-64px)] bg-pos-bg overflow-hidden transition-colors duration-250 text-pos-text">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-pos-sidebar border-r border-pos-border shadow-glass flex flex-col p-4 z-10 transition-colors duration-250">
        <div className="mb-8 px-2">
          <h2 className="text-xl font-black text-pos-text">Admin Portal</h2>
          <p className="text-xs font-bold text-pos-text-muted mt-1">Management & Analytics</p>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            Executive Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab('MENU')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'MENU'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <MenuIcon className="h-5 w-5 shrink-0" />
            Menu Manager
          </button>

          <button
            onClick={() => setActiveTab('STAFF')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'STAFF'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Users className="h-5 w-5 shrink-0" />
            Staff & Waiters
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'SETTINGS'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
            System & Quick-Keys
          </button>
          <button
            onClick={() => setActiveTab('INVENTORY')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'INVENTORY'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <Package className="h-5 w-5 shrink-0" />
            Inventory & Recipes
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'LEDGER'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-glow-accent scale-[1.02]'
                : 'text-pos-text-muted hover:bg-pos-card hover:text-emerald-500'
            }`}
          >
            <BookOpen className="h-5 w-5 shrink-0" />
            Customer Ledger
          </button>
        </nav>

        <div className="pt-4 border-t border-pos-border">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer">
            <LogOut className="h-5 w-5 shrink-0" />
            Logout Admin
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-pos-bg">
        {activeTab === 'DASHBOARD' && <AdminDashboard />}
        {activeTab === 'MENU' && <AdminMenuManager />}
        {activeTab === 'STAFF' && <AdminStaffManager />}
        {activeTab === 'SETTINGS' && <AdminSettingsManager />}
        {activeTab === 'LEDGER' && <AdminCustomerLedger />}
        {activeTab === 'INVENTORY' && <AdminInventoryScreen />}
      </main>
    </div>
  );
};
