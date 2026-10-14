import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore, resetSessionSettings } from '../store/useSettingsStore';
import { initSocketListeners, socket, startMasterSyncPolling, stopMasterSyncPolling } from '../services/socket';
import { isServerConfigured, getOperatingMode } from '../services/serverConfig';
import { startAndroidMasterServer, stopAndroidMasterServer } from '../services/localServer';
import { hydrateTenantStores } from '../store/tenantSession';
import { initializeCatalogConfig, suspendCatalogConfig } from '../store/catalogConfig';

export function useAppInit() {
  const [showSetup, setShowSetup] = useState(!isServerConfigured());
  const [readyTenant, setReadyTenant] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { currentUser, accessToken } = useAuthStore();

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
    setReadyTenant(null);
    if (currentUser?.restaurantId) {
      resetSessionSettings();
      void hydrateTenantStores(() => !cancelled).then(async () => {
        if (cancelled) return;
        const token = useAuthStore.getState().accessToken;
        socket.auth = { restaurantId: currentUser.restaurantId, token };
        await useSettingsStore.getState().fetchSettings();
        if (cancelled) return;
        initializeCatalogConfig();
        setReadyTenant(currentUser.restaurantId);
        if (getOperatingMode() !== 'ANDROID_MASTER') socket.connect();
      });
    }
    return () => { cancelled = true; socket.disconnect(); };
  }, [currentUser?.restaurantId, currentUser?.id, accessToken]);

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

  return { showSetup, setShowSetup, readyTenant, currentTime };
}
