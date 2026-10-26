import { useAuthStore } from '../store/useAuthStore';
import { getServerUrl } from './serverConfig';

export function assertCurrentSession() {
  const live = useAuthStore.getState();
  const saved = JSON.parse(localStorage.getItem('pos-auth-storage') || '{}').state;
  if (live.currentUser?.id !== saved?.currentUser?.id || live.currentUser?.restaurantId !== saved?.currentUser?.restaurantId || live.accessToken !== saved?.accessToken || live.isLocked !== saved?.isLocked) throw new Error('The account changed in another tab. Reload this tab before continuing; your earlier drafts are preserved.');
  if (live.sessionServerUrl && live.sessionServerUrl !== getServerUrl().replace(/\/$/, '')) throw new Error('The backend connection changed. Reload and sign in to the selected backend before continuing.');
  return live;
}
