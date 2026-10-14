import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAppInit } from './hooks/useAppInit';
import { useAuthStore } from './store/useAuthStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useFullscreen } from './hooks/useFullscreen';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/ToastContainer';
import { PendingActionsBanner } from './components/PendingActionsBanner';
import { SetupScreen } from './screens/SetupScreen';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// Re-export ScreenType from shared path constants so nothing downstream breaks
export type { ScreenType } from './components/layout/screenPaths';

// Lazy-loaded screens
const POSScreen = React.lazy(() => import('./screens/POSScreen').then(m => ({ default: m.POSScreen })));
const TableMapScreen = React.lazy(() => import('./screens/TableMapScreen').then(m => ({ default: m.TableMapScreen })));
const KDSScreen = React.lazy(() => import('./screens/KDSScreen').then(m => ({ default: m.KDSScreen })));
const QueueScreen = React.lazy(() => import('./screens/QueueScreen').then(m => ({ default: m.QueueScreen })));
const AdminInventoryScreen = React.lazy(() => import('./screens/Admin/AdminInventoryScreen').then(m => ({ default: m.AdminInventoryScreen })));
const QROrderScreen = React.lazy(() => import('./screens/QROrderScreen').then(m => ({ default: m.QROrderScreen })));
const AdminPortalScreen = React.lazy(() => import('./screens/AdminPortalScreen').then(m => ({ default: m.AdminPortalScreen })));
const AdminDashboard = React.lazy(() => import('./screens/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const FullLoginScreen = React.lazy(() => import('./screens/FullLoginScreen').then(m => ({ default: m.FullLoginScreen })));
const AdminCustomerScreen = React.lazy(() => import('./screens/Admin/AdminCustomerScreen').then(m => ({ default: m.AdminCustomerScreen })));
const SuperAdminDashboard = React.lazy(() => import('./screens/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const OwnerDashboard = React.lazy(() => import('./screens/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })));
const LockScreen = React.lazy(() => import('./screens/LockScreen').then(m => ({ default: m.LockScreen })));
const ParcelBoardScreen = React.lazy(() => import('./screens/ParcelBoardScreen').then(m => ({ default: m.ParcelBoardScreen })));
const DeliveryDispatchScreen = React.lazy(() => import('./screens/DeliveryDispatchScreen').then(m => ({ default: m.DeliveryDispatchScreen })));

const DarkLoader = () => <div className="flex h-full bg-slate-900" />;
const FullLoader = () => (
  <div className="flex h-[100dvh] items-center justify-center bg-slate-900">
    <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-[#8cc63f] animate-spin" />
  </div>
);

export const App: React.FC = () => {
  const { showSetup, setShowSetup, readyTenant } = useAppInit();
  const { currentUser, isLocked } = useAuthStore();
  const operatingMode = useSettingsStore(s => s.operatingMode) || 'FINE_DINING';

  // Dynamic theme-color meta for fullscreen management
  const themeContext = showSetup ? 'setup' : (!currentUser || isLocked) ? 'login' : 'app';
  useFullscreen(themeContext);

  // ─── NOT LOGGED IN ────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <ToastContainer /><PendingActionsBanner />
        <Suspense fallback={<FullLoader />}>
          <FullLoginScreen />
        </Suspense>
        {showSetup && <SetupScreen onComplete={() => setShowSetup(false)} />}
        <PWAInstallPrompt />
      </div>
    );
  }

  // ─── LOGGED IN BUT SETUP OVERLAY OPEN ────────────────────────────────────
  if (showSetup) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0 z-0 flex h-full bg-slate-900 opacity-50" />
        <SetupScreen onComplete={() => setShowSetup(false)} />
      </div>
    );
  }

  // ─── LOCK SCREEN ─────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <Suspense fallback={<DarkLoader />}>
        <LockScreen />
      </Suspense>
    );
  }

  // ─── WAITING FOR TENANT DATA ──────────────────────────────────────────────
  if (currentUser.restaurantId && readyTenant !== currentUser.restaurantId) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-900 text-white">
        Loading restaurant data…
      </div>
    );
  }

  // ─── SUPER ADMIN ──────────────────────────────────────────────────────────
  if (currentUser.role === 'SUPER_ADMIN') {
    return (
      <Suspense fallback={<DarkLoader />}>
        <SuperAdminDashboard />
      </Suspense>
    );
  }

  // ─── OWNER ────────────────────────────────────────────────────────────────
  if (currentUser.role === 'OWNER') {
    return (
      <Suspense fallback={<DarkLoader />}>
        <OwnerDashboard />
      </Suspense>
    );
  }

  // ─── DEFAULT ROUTE based on role / operating mode ────────────────────────
  const defaultPath =
    currentUser.role === 'KITCHEN' ? '/app/kds' :
    currentUser.role === 'DELIVERY' ? '/app/delivery' :
    operatingMode === 'CLOUD_KITCHEN' ? '/app/delivery' :
    '/app/pos';

  // ─── MAIN AUTHENTICATED APP ───────────────────────────────────────────────
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/app/pos" element={<POSScreen />} />
        <Route path="/app/tables" element={<TableMapScreen />} />
        <Route path="/app/kds" element={<KDSScreen />} />
        <Route path="/app/queue" element={<QueueScreen />} />
        <Route path="/app/parcel" element={<ParcelBoardScreen />} />
        <Route path="/app/delivery" element={<DeliveryDispatchScreen />} />
        <Route path="/app/qr" element={<QROrderScreen />} />
        <Route path="/app/dashboard" element={<AdminDashboard />} />
        <Route path="/app/customers" element={<AdminCustomerScreen />} />
        <Route path="/app/inventory" element={<AdminInventoryScreen />} />
        <Route path="/app/admin" element={<AdminPortalScreen />} />
        {/* Catch-all → default screen */}
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Route>
    </Routes>
  );
};
