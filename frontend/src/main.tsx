import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// Automatically register PWA Service Worker for offline caching and zero-touch auto-updates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !(window as any).__TAURI__) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-activate the new release immediately without requiring app reinstallation
      updateSW(true);
    },
    onRegistered(registration) {
      if (registration) {
        // Poll for new releases every 15 minutes in the background
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);
      }
    },
  });
}

// Initialize TanStack Query client for data caching and offline synchronization
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
