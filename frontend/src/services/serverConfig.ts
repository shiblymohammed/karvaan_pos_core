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
const DEFAULT_URL = 'http://localhost:3001';

export type OperatingMode = 'NODE_SERVER' | 'ANDROID_MASTER' | 'WAITER_CLIENT';

export function getOperatingMode(): OperatingMode {
  const mode = localStorage.getItem(OP_MODE_KEY) as OperatingMode;
  return mode || 'NODE_SERVER';
}

export function setOperatingMode(mode: OperatingMode): void {
  localStorage.setItem(OP_MODE_KEY, mode);
}

export function getServerUrl(): string {
  // 1. Env variable (set at build time for VPS / production)
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  // 2. Runtime config set via Setup Screen
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim()) return stored.trim();

  // 3. Fallback: same machine
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
  const mode = getOperatingMode();
  if (mode === 'ANDROID_MASTER') return true;

  // Configured if either env var is set OR user has saved a URL via Setup Screen
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return !!(stored && stored.trim());
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
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch (e) {
    console.error('Probe failed:', e);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

