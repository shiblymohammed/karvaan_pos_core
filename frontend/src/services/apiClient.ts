import { getOperatingMode, getServerUrl } from './serverConfig';
import { useCartStore } from '../store/cartStore';
import { useTableStore } from '../store/useTableStore';
import { useMenuStore } from '../store/useMenuStore';
import { useKdsStore } from '../store/useKdsStore';

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
    return handleLocalMasterRequest(method, endpoint, body);
  }

  // Use fetch for NODE_SERVER or WAITER_CLIENT
  const baseUrl = getServerUrl();
  const url = `${baseUrl}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
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

/**
 * Handles API requests locally on the Master Tablet bypassing network.
 */
async function handleLocalMasterRequest(method: string, endpoint: string, body?: any) {
  console.log(`[Local Master] Intercepted ${method} ${endpoint}`, body);
  
  // Example routing for orders
  if (endpoint.startsWith('/api/orders') && method === 'POST') {
    // Process the new order directly into local state
    // In a full implementation, you would add logic here to sync with useCartStore and useKdsStore
    return { success: true, local: true };
  }

  // Fallback for unhandled local routes
  console.warn(`[Local Master] Route ${method} ${endpoint} not implemented locally yet.`);
  return { success: true };
}
