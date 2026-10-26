import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore, resetSessionSettings } from '../store/useSettingsStore';
import { initSocketListeners, socket, startMasterSyncPolling, stopMasterSyncPolling } from '../services/socket';
import { isServerConfigured, getOperatingMode } from '../services/serverConfig';
import { startAndroidMasterServer, stopAndroidMasterServer } from '../services/localServer';
import { hydrateTenantStores } from '../store/tenantSession';
import { initializeCatalogConfig, suspendCatalogConfig } from '../store/catalogConfig';
import { initializeInventorySync, suspendInventorySync } from '../store/useInventoryStore';
import { assertCurrentSession } from '../services/sessionGuard';

export function useAppInit() {
  const [showSetup, setShowSetup] = useState(!isServerConfigured());
  const [readyTenant, setReadyTenant] = useState<string | null>(null);
  const [readyUser, setReadyUser] = useState<string | null>(null);
  const [sessionChanged, setSessionChanged] = useState(false);
  const [databaseBlocked, setDatabaseBlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { currentUser, accessToken } = useAuthStore();
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (!['pos-auth-storage', 'karvaan_server_url', 'karvaan_op_mode', 'karvaan_terminal_id'].includes(event.key || '')) return;
      if (event.key === 'pos-auth-storage') {
        const scope = (raw: string | null) => { try { const auth = JSON.parse(raw || '{}').state; return JSON.stringify([auth?.currentUser?.id, auth?.currentUser?.restaurantId, auth?.accessToken, auth?.isLocked, auth?.sessionServerUrl]); } catch { return raw; } };
        if (scope(event.oldValue) === scope(event.newValue)) return;
      }
      socket.disconnect(); suspendCatalogConfig(); suspendInventorySync();
      setSessionChanged(true);
    };
    window.addEventListener('storage', changed);
    const blocked = () => { socket.disconnect(); setDatabaseBlocked(true); };
    window.addEventListener('offline-db-blocked', blocked);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('offline-db-blocked', blocked); };
  }, []);

  // Force dark theme globally
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.body.classList.add('dark');
    document.body.classList.remove('light');
  }, []);

  // Init WebSocket listeners once
  useEffect(() => {
    initSocketListeners();
  }, []);

  // Sync WebSocket connection when user's restaurant session changes
  useEffect(() => {
    let cancelled = false;
    socket.disconnect();
    suspendCatalogConfig();
    suspendInventorySync();
    setReadyTenant(null);
    setReadyUser(null);
    if (!sessionChanged && !databaseBlocked && currentUser?.restaurantId) {
      resetSessionSettings();
      void hydrateTenantStores(() => !cancelled).then(async () => {
        if (cancelled) return;
        try { assertCurrentSession(); } catch { return; }
        const token = useAuthStore.getState().accessToken;
        socket.auth = { restaurantId: currentUser.restaurantId, token };
        await useSettingsStore.getState().fetchSettings();
        if (cancelled) return;
        try { assertCurrentSession(); } catch { return; }
        initializeCatalogConfig();
        initializeInventorySync();
        setReadyTenant(currentUser.restaurantId);
        setReadyUser(currentUser.id);
        if (getOperatingMode() !== 'ANDROID_MASTER') socket.connect();
      });
    }
    return () => { cancelled = true; socket.disconnect(); };
  }, [currentUser?.restaurantId, currentUser?.id, accessToken, sessionChanged, databaseBlocked]);

  // Validate JWT on boot
  useEffect(() => {
    if (currentUser) {
      useAuthStore.getState().validateToken();
    }
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Start Android master server or waiter polling
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

  return { showSetup, setShowSetup, readyTenant: readyUser === currentUser?.id ? readyTenant : null, currentTime, sessionChanged, databaseBlocked };
}
