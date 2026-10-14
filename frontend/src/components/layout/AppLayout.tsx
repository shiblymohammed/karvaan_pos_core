import React, { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { ToastContainer } from '../ToastContainer';
import { PendingActionsBanner } from '../PendingActionsBanner';
import { PWAInstallPrompt } from '../PWAInstallPrompt';

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full bg-kv-creme text-slate-400">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#8cc63f] animate-spin"></div>
      <span className="font-bold text-sm tracking-wide">Loading...</span>
    </div>
  </div>
);

/** The main authenticated app shell: sidebar + content area + mobile nav. */
export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileNavMoreOpen, setIsMobileNavMoreOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-carbon-lines text-kv-dark font-sans selection:bg-kv-primary selection:text-white overflow-hidden transition-colors duration-300 p-0 md:py-4 md:pr-4 gap-0 md:gap-4 relative">
      <ToastContainer />
      <PendingActionsBanner />
      <PWAInstallPrompt />

      {/* Desktop Sidebar */}
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-kv-creme relative md:rounded-[24px] shadow-2xl border-0 md:border md:border-white/10 overflow-hidden h-full z-10">
        <div className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full">
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav onOpenMore={() => setIsMobileNavMoreOpen(true)} />

      {/* Mobile More Drawer */}
      <MobileMoreDrawer
        isOpen={isMobileNavMoreOpen}
        onClose={() => setIsMobileNavMoreOpen(false)}
      />
    </div>
  );
};
