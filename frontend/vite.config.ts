import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Detect if running inside Tauri build
const IS_TAURI = process.env.TAURI_ENV_ARCH !== undefined;

export default defineConfig({
  // Tauri expects a fixed port and no browser auto-open
  clearScreen: false,

  plugins: [
    react(),
    // PWA is only for browser/mobile web — disable for Tauri native builds.
    // The service worker aggressively caches JS/CSS assets inside the WebView2 engine,
    // which causes the Tauri app to serve stale old code even after a fresh rebuild.
    ...(!IS_TAURI ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Karvaan POS Core Edition',
        short_name: 'KarvaanPOS',
        description: 'Zero-latency, real-time cloud and offline-first restaurant POS terminal.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    })] : []),
  ],
  server: {
    port: 5173,
    host: true,
    // Don't auto-open browser when running under Tauri
    open: !IS_TAURI,
    strictPort: true, // Tauri requires a fixed port
    hmr: IS_TAURI
      ? {
          // Use WebSocket for HMR in Tauri (no overlay which crashes the WebView)
          protocol: 'ws',
          host: 'localhost',
          port: 5183,
        }
      : true,
  },
  // Tauri needs access to environment variables from the backend
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
