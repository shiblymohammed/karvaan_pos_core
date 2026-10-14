import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { getServerUrl } from './serverConfig';

export interface ActionContext { restaurantId: string; userId: string; serverUrl: string; }
export interface PendingAction extends ActionContext {
  id?: number;
  actionId: string;
  type: string;
  payload: any;
  timestamp: number;
  error?: string;
}
interface OfflineDB extends DBSchema {
  actions: { key: number; value: PendingAction; indexes: { 'by-timestamp': number } };
}
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;
export const initDB = () => dbPromise ||= openDB<OfflineDB>('karvaan_offline_db', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      store.createIndex('by-timestamp', 'timestamp');
    }
    // Legacy actions have no reliable owner. Keep them for recovery, but never replay them under another login.
  },
});
export function getActionContext(): ActionContext {
  const user = JSON.parse(localStorage.getItem('pos-auth-storage') || '{}').state?.currentUser;
  if (!user?.restaurantId || !user.id) throw new Error('Sign in to a restaurant before saving an action');
  return { restaurantId: user.restaurantId, userId: user.id, serverUrl: getServerUrl().replace(/\/$/, '') };
}
export function sameContext(a: ActionContext, b: ActionContext) {
  return a.restaurantId === b.restaurantId && a.userId === b.userId && a.serverUrl === b.serverUrl;
}
const changed = () => window.dispatchEvent(new CustomEvent('offline-queue-updated'));
export const enqueueAction = async (type: string, payload: any, context = getActionContext()) => {
  const db = await initDB();
  if (type === 'settle_bill') {
    const existing = (await getPendingActions(context)).find(a => a.type === type && a.payload.billNumber === payload.billNumber);
    if (existing) {
      if (existing.error) await db.put('actions', { ...existing, payload, error: undefined });
      return existing.id!;
    }
  }
  const actionId = `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')}`;
  const id = await db.add('actions', { ...context, actionId, type, payload, timestamp: Date.now() });
  changed();
  return id;
};
export const getPendingActions = async (context = getActionContext()) => {
  const actions = await (await initDB()).getAllFromIndex('actions', 'by-timestamp');
  return actions.filter(action => sameContext(action, context));
};
export const clearAction = async (id: number) => { await (await initDB()).delete('actions', id); changed(); };
export const markActionError = async (id: number, error: string) => {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (action) await db.put('actions', { ...action, error });
  changed();
};
export const getQueueCount = async () => {
  try { return (await getPendingActions()).length; } catch { return 0; }
};
