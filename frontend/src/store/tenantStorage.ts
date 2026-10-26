import { StateStorage } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';
import { getServerUrl, getTerminalId } from '../services/serverConfig';

function cacheKey(name: string) {
  const auth = useAuthStore.getState();
  const server = (auth.sessionServerUrl || getServerUrl()).replace(/\/$/, '');
  const restaurant = auth.currentUser?.restaurantId || 'default';
  const account = `:${auth.currentUser?.id || 'signed-out'}:${getTerminalId()}`;
  return `${name}:v2:${encodeURIComponent(server)}:${restaurant}${account}`;
}

const cartBackupId = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
const cartBackupKey = () => `${cacheKey('pos-cart-storage')}:draft:${cartBackupId}`;

// Old unscoped keys remain intact for explicit draft recovery. Never guess their backend or cashier.
export const tenantStorage: StateStorage = {
  getItem: name => (name === 'pos-cart-storage' ? sessionStorage : localStorage).getItem(cacheKey(name)),
  setItem: (name, value) => {
    (name === 'pos-cart-storage' ? sessionStorage : localStorage).setItem(cacheKey(name), value);
    if (name === 'pos-cart-storage') localStorage.setItem(cartBackupKey(), JSON.stringify({ savedAt: Date.now(), value }));
  },
  removeItem: name => {
    (name === 'pos-cart-storage' ? sessionStorage : localStorage).removeItem(cacheKey(name));
    if (name === 'pos-cart-storage') localStorage.removeItem(cartBackupKey());
  },
};

export function getLegacyCartDraft() {
  const restaurant = useAuthStore.getState().currentUser?.restaurantId;
  return restaurant ? localStorage.getItem(`pos-cart-storage-${restaurant}`) : null;
}

export function getRecoverableCartDrafts() {
  const drafts: { key: string; value: string; legacy: boolean; savedAt: number }[] = [];
  const restaurant = useAuthStore.getState().currentUser?.restaurantId;
  const legacy = getLegacyCartDraft();
  if (legacy) drafts.push({ key: `pos-cart-storage-${restaurant}`, value: legacy, legacy: true, savedAt: 0 });
  const prefix = `${cacheKey('pos-cart-storage')}:draft:`;
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)!;
    if (!key.startsWith(prefix) || key === cartBackupKey()) continue;
    try { const saved = JSON.parse(localStorage.getItem(key)!); drafts.push({ key, ...saved, legacy: false }); } catch {}
  }
  return drafts.filter(draft => {
    try { return JSON.parse(draft.value).state?.items?.length > 0 && !localStorage.getItem(`${draft.key}:reviewed`); } catch { return false; }
  }).sort((a, b) => b.savedAt - a.savedAt);
}
