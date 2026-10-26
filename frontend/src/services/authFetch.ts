import { getServerUrl } from './serverConfig';
import { assertCurrentSession } from './sessionGuard';

export async function authorizedFetch(endpoint: string, options: RequestInit = {}) {
  const session = assertCurrentSession();
  const token = session.accessToken, server = getServerUrl();
  if (!token) throw new Error('Sign in before accessing restaurant data');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${server}${endpoint}`, { ...options, headers });
  const current = assertCurrentSession();
  if (current.accessToken !== token || current.currentUser?.id !== session.currentUser?.id || getServerUrl() !== server) throw new Error('The session changed while the server was responding. Reload this tab before continuing.');
  return response;
}
