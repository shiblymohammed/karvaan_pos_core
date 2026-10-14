import { getOperatingMode, getServerUrl } from './serverConfig';
import { useAuthStore } from '../store/useAuthStore';

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
  const baseUrl = getServerUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  };

  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

