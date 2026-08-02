import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karvaan.pos',
  appName: 'Karvaan POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow mixed content so the app can connect to local HTTP servers (192.168.x.x)
    allowNavigation: ['*'],
  },
  android: {
    // Allow cleartext HTTP for local LAN connections
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
