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
const DEFAULT_URL = 'http://localhost:3001';

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
  // Configured if either env var is set OR user has saved a URL via Setup Screen
  const envUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (envUrl && envUrl.trim()) return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return !!(stored && stored.trim());
}

/**
 * Probe the server URL to check if the backend is reachable.
 * Returns true if /health endpoint responds within 3 seconds.
 */
export async function probeServer(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
