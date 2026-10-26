import { getOperatingMode } from './serverConfig';
import { authorizedFetch } from './authFetch';

/**
 * apiClient is an abstraction over standard fetch.
 * - NODE_SERVER: sends normal fetch request.
 * - WAITER_CLIENT: sends fetch request to the Android Master's IP.
 * - ANDROID_MASTER: intercepts the request and updates local Zustand stores directly, 
 *                   bypassing HTTP entirely.
 */
export const apiClient = {
  get: async (endpoint: string) => {
    return _request('GET', endpoint);
  },
  post: async (endpoint: string, body: any) => {
    return _request('POST', endpoint, body);
  },
  put: async (endpoint: string, body: any) => {
    return _request('PUT', endpoint, body);
  },
  delete: async (endpoint: string) => {
    return _request('DELETE', endpoint);
  }
};

async function _request(method: string, endpoint: string, body?: any) {
  const mode = getOperatingMode();

  if (mode === 'ANDROID_MASTER') {
    throw new Error('Tablet server mode is unavailable. Connect to the restaurant backend.');
  }

  // Use fetch for NODE_SERVER or WAITER_CLIENT
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await authorizedFetch(endpoint, options);
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`;
    try { const body = await response.json(); if (typeof body.message === 'string') message = body.message; else if (Array.isArray(body.message)) message = body.message.join('. '); } catch {}
    throw new Error(message);
  }
  return response.json();
}

