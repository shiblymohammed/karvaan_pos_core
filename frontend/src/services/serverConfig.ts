/**
 * serverConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the configurable backend server URL for multi-terminal LAN operation.
 *
 * Priority order:
 *  1. VITE_BACKEND_URL env variable (for production builds with a fixed VPS URL)
 *  2. localStorage 'karvaan_server_url' (set via the in-app Setup Screen)
 *  3. 'http://localhost:3001' (default — single PC mode)
 *
 * This allows:
 *  - A waiter tablet to connect to the cashier PC at 192.168.1.100:3001
 *  - A VPS-hosted deployment to use a domain like https://api.karvaan.app
 *  - A single-PC dev/demo setup to work with zero configuration
 */

const STORAGE_KEY = 'karvaan_server_url';
const OP_MODE_KEY = 'karvaan_op_mode';
export const DEFAULT_URL = 'https://wq8ss.aiccloud.online';

function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return !!(cap && (cap.isNativePlatform?.() || cap.platform === 'android' || cap.platform === 'ios'));
}

export type OperatingMode = 'NODE_SERVER' | 'ANDROID_MASTER' | 'WAITER_CLIENT';

export function getOperatingMode(): OperatingMode {
  if (isCapacitorApp()) return 'NODE_SERVER';
  const mode = localStorage.getItem(OP_MODE_KEY) as OperatingMode;
  return mode || 'NODE_SERVER';
}

export function setOperatingMode(mode: OperatingMode): void {
  localStorage.setItem(OP_MODE_KEY, mode);
}

function getAutomaticServerUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return;
  const origin = window.location.origin;
  if (/^https?:\/\//.test(origin) && !origin.includes('localhost') && !origin.includes('127.0.0.1')) return origin;
}

export function getServerUrl(): string {
  // On native Android / Capacitor APK, always connect directly to the hosted cloud backend
  if (isCapacitorApp()) {
    return DEFAULT_URL;
  }

  // 1. Env variable (set at build time for VPS / production)
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/^http:\/\/wq8ss\.aiccloud\.online/, 'https://wq8ss.aiccloud.online');
  }

  // 2. Runtime config set via Setup Screen
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/^http:\/\/wq8ss\.aiccloud\.online/, 'https://wq8ss.aiccloud.online');
  }

  // 3. Cloud web deployment: if loaded via domain or IP in browser, default to same origin
  const automaticUrl = getAutomaticServerUrl();
  if (automaticUrl) return automaticUrl;

  // 4. Fallback: default cloud VPS server
  return DEFAULT_URL;
}

export function setServerUrl(url: string): void {
  // Normalize: strip trailing slash
  const clean = url.trim().replace(/\/$/, '');
  localStorage.setItem(STORAGE_KEY, clean);
}

export function clearServerUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isServerConfigured(): boolean {
  // On Capacitor APK, bypass the setup window and connect directly to the cloud VPS
  if (isCapacitorApp()) return true;

  const mode = getOperatingMode();
  if (mode === 'ANDROID_MASTER') return false;

  // Configured if either env var is set OR user has saved a URL via Setup Screen
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return !!(stored && stored.trim()) || !!getAutomaticServerUrl();
}

export async function probeServer(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    let cleanUrl = url.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    const res = await fetch(`${cleanUrl}/health`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    console.error('Probe failed:', e);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

const TERMINAL_ID_KEY = 'karvaan_terminal_id';

export function getTerminalId(): string {
  let tid = localStorage.getItem(TERMINAL_ID_KEY);
  if (!tid || !tid.trim()) {
    tid = `T${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem(TERMINAL_ID_KEY, tid);
  }
  return tid.trim();
}

export function setTerminalId(id: string): void {
  localStorage.setItem(TERMINAL_ID_KEY, id.trim());
}
