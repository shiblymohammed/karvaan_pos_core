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
  lastAttemptMessage?: string;
  recoveryReason?: string;
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

export function actionResources(type: string, payload: any): string[] {
  const resources: string[] = [];
  const orderNumber = payload?.orderNumber || payload?.order?.orderNumber;
  if (orderNumber) resources.push(`order:${orderNumber}`);
  if (payload?.billNumber) resources.push(`bill:${payload.billNumber}`);
  if (payload?.tableId || payload?.order?.tableId) resources.push(`table:${payload.tableId || payload.order.tableId}`);
  if (['park_order', 'remove_parked_order'].includes(type)) resources.push(`park:${payload?.id || payload?.order?.id}`);
  if (['create_delivery', 'update_delivery', 'collect_delivery_payment'].includes(type)) resources.push(`delivery:${payload?.id}`);
  if (type === 'ledger_payment') resources.push(`ledger:${payload?.entryId}`);
  if (type === 'remit_rider_cash') resources.push(`rider:${payload?.riderId}`);
  if (type === 'sync_menu') resources.push('menu');
  if (type === 'apply_inventory_changes') for (const row of payload?.changes || []) resources.push(`stock:${row.id}`);
  if (type === 'receive_inventory_purchase') resources.push(`stock:${payload?.id}`);
  if (type === 'update_kds_status' && !orderNumber) resources.push(`kitchen:${payload?.orderId}`);
  return resources.length ? resources : [`type:${type}`];
}

export async function replaceActionPayload(id: number, payload: any) {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (!action || !sameContext(action, getActionContext())) throw new Error('This pending action belongs to another session');
  await db.put('actions', { ...action, payload, error: undefined });
  changed();
}
const changed = () => window.dispatchEvent(new CustomEvent('offline-queue-updated'));
export const enqueueAction = async (type: string, payload: any, context = getActionContext()) => {
  const db = await initDB();
  if (type === 'settle_bill' || type === 'remit_rider_cash') {
    const existing = (await getPendingActions(context)).find(a => a.type === type && (type === 'settle_bill' ? a.payload.billNumber === payload.billNumber : a.payload.riderId === payload.riderId));
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
  const db = await initDB();
  const actions = await db.getAllFromIndex('actions', 'by-timestamp');
  let migrated = false;
  for (const action of actions) {
    if (sameContext(action, context) && action.type === 'sync_inventory' && !action.recoveryReason) {
      await db.put('actions', { ...action, recoveryReason: 'Older stock snapshots cannot establish a purchase quantity. Compare with server stock before reconciling.' });
      migrated = true;
    }
  }
  if (migrated) changed();
  return actions.filter(action => sameContext(action, context) && action.type !== 'sync_inventory' && !action.recoveryReason);
};
export const getRecoveryActions = async (context = getActionContext()) => {
  await getPendingActions(context);
  const actions = await (await initDB()).getAllFromIndex('actions', 'by-timestamp');
  return actions.filter(action => sameContext(action, context) && Boolean(action.recoveryReason));
};
export const clearAction = async (id: number) => { await (await initDB()).delete('actions', id); changed(); };
export const markActionError = async (id: number, error: string) => {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (action) await db.put('actions', { ...action, error });
  changed();
};
export const markActionAttempt = async (id: number, message: string) => {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (action && sameContext(action, getActionContext())) await db.put('actions', { ...action, lastAttemptMessage: message });
  changed();
};
export const getQueueCount = async () => {
  try { return (await getPendingActions()).length; } catch { return 0; }
};
