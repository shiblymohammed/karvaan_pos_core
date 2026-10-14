import { useAuthStore } from '../store/useAuthStore';
import { getServerUrl } from './serverConfig';

export function authorizedFetch(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Sign in before accessing restaurant data');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${getServerUrl()}${endpoint}`, { ...options, headers });
}
