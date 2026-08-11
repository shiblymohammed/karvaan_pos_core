// vite.config.ts
import { defineConfig } from "file:///C:/Users/shibi/Documents/dev/karvaan_pos_basic/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/shibi/Documents/dev/karvaan_pos_basic/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/shibi/Documents/dev/karvaan_pos_basic/frontend/node_modules/vite-plugin-pwa/dist/index.js";
var IS_TAURI = process.env.TAURI_ENV_ARCH !== void 0;
var vite_config_default = defineConfig({
  // Tauri expects a fixed port and no browser auto-open
  clearScreen: false,
  plugins: [
    react(),
    // PWA is only for browser/mobile web — disable for Tauri native builds.
    // The service worker aggressively caches JS/CSS assets inside the WebView2 engine,
    // which causes the Tauri app to serve stale old code even after a fresh rebuild.
    ...!IS_TAURI ? [VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Karvaan POS Core Edition",
        short_name: "KarvaanPOS",
        description: "Zero-latency, real-time cloud and offline-first restaurant POS terminal.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "landscape",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })] : []
  ],
  server: {
    port: 5173,
    host: true,
    // Don't auto-open browser when running under Tauri
    open: !IS_TAURI,
    strictPort: true,
    // Tauri requires a fixed port
    hmr: IS_TAURI ? {
      // Use WebSocket for HMR in Tauri (no overlay which crashes the WebView)
      protocol: "ws",
      host: "localhost",
      port: 5183
    } : true
  },
  // Tauri needs access to environment variables from the backend
  envPrefix: ["VITE_", "TAURI_ENV_"]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaGliaVxcXFxEb2N1bWVudHNcXFxcZGV2XFxcXGthcnZhYW5fcG9zX2Jhc2ljXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaGliaVxcXFxEb2N1bWVudHNcXFxcZGV2XFxcXGthcnZhYW5fcG9zX2Jhc2ljXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9zaGliaS9Eb2N1bWVudHMvZGV2L2thcnZhYW5fcG9zX2Jhc2ljL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbi8vIERldGVjdCBpZiBydW5uaW5nIGluc2lkZSBUYXVyaSBidWlsZFxuY29uc3QgSVNfVEFVUkkgPSBwcm9jZXNzLmVudi5UQVVSSV9FTlZfQVJDSCAhPT0gdW5kZWZpbmVkO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAvLyBUYXVyaSBleHBlY3RzIGEgZml4ZWQgcG9ydCBhbmQgbm8gYnJvd3NlciBhdXRvLW9wZW5cbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxuXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIC8vIFBXQSBpcyBvbmx5IGZvciBicm93c2VyL21vYmlsZSB3ZWIgXHUyMDE0IGRpc2FibGUgZm9yIFRhdXJpIG5hdGl2ZSBidWlsZHMuXG4gICAgLy8gVGhlIHNlcnZpY2Ugd29ya2VyIGFnZ3Jlc3NpdmVseSBjYWNoZXMgSlMvQ1NTIGFzc2V0cyBpbnNpZGUgdGhlIFdlYlZpZXcyIGVuZ2luZSxcbiAgICAvLyB3aGljaCBjYXVzZXMgdGhlIFRhdXJpIGFwcCB0byBzZXJ2ZSBzdGFsZSBvbGQgY29kZSBldmVuIGFmdGVyIGEgZnJlc2ggcmVidWlsZC5cbiAgICAuLi4oIUlTX1RBVVJJID8gW1ZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnS2FydmFhbiBQT1MgQ29yZSBFZGl0aW9uJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0thcnZhYW5QT1MnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1plcm8tbGF0ZW5jeSwgcmVhbC10aW1lIGNsb3VkIGFuZCBvZmZsaW5lLWZpcnN0IHJlc3RhdXJhbnQgUE9TIHRlcm1pbmFsLicsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzBmMTcyYScsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMGYxNzJhJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ2xhbmRzY2FwZScsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSldIDogW10pLFxuICBdLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIGhvc3Q6IHRydWUsXG4gICAgLy8gRG9uJ3QgYXV0by1vcGVuIGJyb3dzZXIgd2hlbiBydW5uaW5nIHVuZGVyIFRhdXJpXG4gICAgb3BlbjogIUlTX1RBVVJJLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsIC8vIFRhdXJpIHJlcXVpcmVzIGEgZml4ZWQgcG9ydFxuICAgIGhtcjogSVNfVEFVUklcbiAgICAgID8ge1xuICAgICAgICAgIC8vIFVzZSBXZWJTb2NrZXQgZm9yIEhNUiBpbiBUYXVyaSAobm8gb3ZlcmxheSB3aGljaCBjcmFzaGVzIHRoZSBXZWJWaWV3KVxuICAgICAgICAgIHByb3RvY29sOiAnd3MnLFxuICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgIHBvcnQ6IDUxODMsXG4gICAgICAgIH1cbiAgICAgIDogdHJ1ZSxcbiAgfSxcbiAgLy8gVGF1cmkgbmVlZHMgYWNjZXNzIHRvIGVudmlyb25tZW50IHZhcmlhYmxlcyBmcm9tIHRoZSBiYWNrZW5kXG4gIGVudlByZWZpeDogWydWSVRFXycsICdUQVVSSV9FTlZfJ10sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVcsU0FBUyxvQkFBb0I7QUFDbFksT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUd4QixJQUFNLFdBQVcsUUFBUSxJQUFJLG1CQUFtQjtBQUVoRCxJQUFPLHNCQUFRLGFBQWE7QUFBQTtBQUFBLEVBRTFCLGFBQWE7QUFBQSxFQUViLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUlOLEdBQUksQ0FBQyxXQUFXLENBQUMsUUFBUTtBQUFBLE1BQ3ZCLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLHNCQUFzQjtBQUFBLE1BQ3JELFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUVOLE1BQU0sQ0FBQztBQUFBLElBQ1AsWUFBWTtBQUFBO0FBQUEsSUFDWixLQUFLLFdBQ0Q7QUFBQTtBQUFBLE1BRUUsVUFBVTtBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1IsSUFDQTtBQUFBLEVBQ047QUFBQTtBQUFBLEVBRUEsV0FBVyxDQUFDLFNBQVMsWUFBWTtBQUNuQyxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
