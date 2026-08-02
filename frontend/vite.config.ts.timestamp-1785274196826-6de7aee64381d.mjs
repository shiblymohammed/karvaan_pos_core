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
    VitePWA({
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
    })
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaGliaVxcXFxEb2N1bWVudHNcXFxcZGV2XFxcXGthcnZhYW5fcG9zX2Jhc2ljXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzaGliaVxcXFxEb2N1bWVudHNcXFxcZGV2XFxcXGthcnZhYW5fcG9zX2Jhc2ljXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9zaGliaS9Eb2N1bWVudHMvZGV2L2thcnZhYW5fcG9zX2Jhc2ljL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbi8vIERldGVjdCBpZiBydW5uaW5nIGluc2lkZSBUYXVyaSBidWlsZFxuY29uc3QgSVNfVEFVUkkgPSBwcm9jZXNzLmVudi5UQVVSSV9FTlZfQVJDSCAhPT0gdW5kZWZpbmVkO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAvLyBUYXVyaSBleHBlY3RzIGEgZml4ZWQgcG9ydCBhbmQgbm8gYnJvd3NlciBhdXRvLW9wZW5cbiAgY2xlYXJTY3JlZW46IGZhbHNlLFxuXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnS2FydmFhbiBQT1MgQ29yZSBFZGl0aW9uJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0thcnZhYW5QT1MnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1plcm8tbGF0ZW5jeSwgcmVhbC10aW1lIGNsb3VkIGFuZCBvZmZsaW5lLWZpcnN0IHJlc3RhdXJhbnQgUE9TIHRlcm1pbmFsLicsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzBmMTcyYScsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMGYxNzJhJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBvcmllbnRhdGlvbjogJ2xhbmRzY2FwZScsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZSxcbiAgICAvLyBEb24ndCBhdXRvLW9wZW4gYnJvd3NlciB3aGVuIHJ1bm5pbmcgdW5kZXIgVGF1cmlcbiAgICBvcGVuOiAhSVNfVEFVUkksXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSwgLy8gVGF1cmkgcmVxdWlyZXMgYSBmaXhlZCBwb3J0XG4gICAgaG1yOiBJU19UQVVSSVxuICAgICAgPyB7XG4gICAgICAgICAgLy8gVXNlIFdlYlNvY2tldCBmb3IgSE1SIGluIFRhdXJpIChubyBvdmVybGF5IHdoaWNoIGNyYXNoZXMgdGhlIFdlYlZpZXcpXG4gICAgICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgICAgcG9ydDogNTE4MyxcbiAgICAgICAgfVxuICAgICAgOiB0cnVlLFxuICB9LFxuICAvLyBUYXVyaSBuZWVkcyBhY2Nlc3MgdG8gZW52aXJvbm1lbnQgdmFyaWFibGVzIGZyb20gdGhlIGJhY2tlbmRcbiAgZW52UHJlZml4OiBbJ1ZJVEVfJywgJ1RBVVJJX0VOVl8nXSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxVyxTQUFTLG9CQUFvQjtBQUNsWSxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBR3hCLElBQU0sV0FBVyxRQUFRLElBQUksbUJBQW1CO0FBRWhELElBQU8sc0JBQVEsYUFBYTtBQUFBO0FBQUEsRUFFMUIsYUFBYTtBQUFBLEVBRWIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsc0JBQXNCO0FBQUEsTUFDckQsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2IsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1I7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBRU4sTUFBTSxDQUFDO0FBQUEsSUFDUCxZQUFZO0FBQUE7QUFBQSxJQUNaLEtBQUssV0FDRDtBQUFBO0FBQUEsTUFFRSxVQUFVO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUixJQUNBO0FBQUEsRUFDTjtBQUFBO0FBQUEsRUFFQSxXQUFXLENBQUMsU0FBUyxZQUFZO0FBQ25DLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
