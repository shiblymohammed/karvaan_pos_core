import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { getServerUrl } from './serverConfig';
import { assertCurrentSession } from './sessionGuard';

export interface ActionContext { restaurantId: string; userId: string; serverUrl: string; }
export interface PendingAction extends ActionContext {
  id?: number;
  actionId: string;
  type: string;
  payload: any;
  timestamp: number;
  error?: string;
  errorDetails?: { reason?: string; stockChallenge?: string; shortages?: { id: string; name: string; unit: string; available: number; required: number; shortfall: number }[] };
  lastAttemptMessage?: string;
  recoveryReason?: string;
}
interface OfflineDB extends DBSchema {
  actions: { key: number; value: PendingAction; indexes: { 'by-timestamp': number } };
  leases: { key: string; value: { key: string; owner: string; expires: number } };
}
let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;
export const initDB = () => dbPromise ||= openDB<OfflineDB>('karvaan_offline_db', 3, {
  blocked() { window.dispatchEvent(new CustomEvent('offline-db-blocked')); },
  blocking() { void dbPromise?.then(db => db.close()); window.dispatchEvent(new CustomEvent('offline-db-blocked')); },
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      store.createIndex('by-timestamp', 'timestamp');
    }
    if (oldVersion < 3) db.createObjectStore('leases', { keyPath: 'key' });
    // Legacy actions have no reliable owner. Keep them for recovery, but never replay them under another login.
  },
});
export function getActionContext(): ActionContext {
  const user = assertCurrentSession().currentUser;
  if (!user?.restaurantId || !user.id) throw new Error('Sign in to a restaurant before saving an action');
  return { restaurantId: user.restaurantId, userId: user.id, serverUrl: getServerUrl().replace(/\/$/, '') };
}
export function sameContext(a: ActionContext, b: ActionContext) {
  return a.restaurantId === b.restaurantId && a.userId === b.userId && a.serverUrl === b.serverUrl;
}
export function contextIsCurrent(context: ActionContext) {
  try { return sameContext(context, getActionContext()); } catch { return false; }
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
  if (type === 'sync_staff') resources.push('staff');
  if (type === 'sync_recipes') resources.push('recipes');
  if (type === 'update_settings') resources.push('settings');
  if (type === 'apply_inventory_changes') for (const row of payload?.changes || []) resources.push(`stock:${row.id}`);
  if (type === 'receive_inventory_purchase') resources.push(`stock:${payload?.id}`);
  if (type === 'record_inventory_waste') resources.push(`stock:${payload?.ingredientId}`);
  if (type === 'update_kds_status' && !orderNumber) resources.push(`kitchen:${payload?.orderId}`);
  return resources.length ? resources : [`type:${type}`];
}

export async function replaceActionPayload(id: number, payload: any) {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (!action || !sameContext(action, getActionContext())) throw new Error('This pending action belongs to another session');
  await db.put('actions', { ...action, payload, error: undefined, errorDetails: undefined });
  changed();
}
const queueChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('karvaan-offline-queue') : null;
if (queueChannel) queueChannel.onmessage = () => window.dispatchEvent(new CustomEvent('offline-queue-updated'));
const changed = () => { window.dispatchEvent(new CustomEvent('offline-queue-updated')); queueChannel?.postMessage('changed'); };

const leaseOwner = Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
export async function withQueueLease<T>(context: ActionContext, task: (ownsLease: () => Promise<boolean>) => Promise<T>, unavailable: T): Promise<T> {
  const db = await initDB();
  const key = JSON.stringify([context.serverUrl, context.restaurantId, context.userId]);
  const tx = db.transaction('leases', 'readwrite');
  const current = await tx.store.get(key);
  if (current && current.owner !== leaseOwner && current.expires > Date.now()) { await tx.done; return unavailable; }
  await tx.store.put({ key, owner: leaseOwner, expires: Date.now() + 120000 });
  await tx.done;
  const ownsLease = async () => {
    const tx = db.transaction('leases', 'readwrite');
    const lease = await tx.store.get(key);
    const owned = lease?.owner === leaseOwner && lease.expires > Date.now();
    if (owned) await tx.store.put({ ...lease!, expires: Date.now() + 120000 });
    await tx.done;
    return owned;
  };
  try { return await task(ownsLease); }
  finally {
    const tx = db.transaction('leases', 'readwrite');
    if ((await tx.store.get(key))?.owner === leaseOwner) await tx.store.delete(key);
    await tx.done;
  }
}
export const enqueueAction = async (type: string, payload: any, context = getActionContext()) => {
  const db = await initDB();
  if (!sameContext(context, getActionContext())) throw new Error('The signed-in session changed before this action was saved');
  const tx = db.transaction('actions', 'readwrite');
  if (['settle_bill', 'remit_rider_cash', 'create_delivery', 'sync_staff'].includes(type)) {
    const existing = (await tx.store.getAll()).find(a => sameContext(a, context) && a.type === type && (type === 'settle_bill' ? a.payload.billNumber === payload.billNumber : type === 'create_delivery' ? a.payload.orderNumber === payload.orderNumber : type === 'sync_staff' ? !!a.error && a.payload?.expectedRevision === payload.expectedRevision : a.payload.riderId === payload.riderId));
    if (existing) {
      if (existing.error) await tx.store.put({ ...existing, payload, error: undefined, errorDetails: undefined });
      await tx.done;
      changed();
      return existing.id!;
    }
  }
  const actionId = `${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')}`;
  const id = await tx.store.add({ ...context, actionId, type, payload, timestamp: Date.now() });
  await tx.done;
  changed();
  return id;
};
export const getPendingActions = async (context = getActionContext()) => {
  const db = await initDB();
  const actions = await db.getAllFromIndex('actions', 'by-timestamp');
  let migrated = false;
  for (const action of actions) {
    const legacyConfig = ['sync_staff', 'sync_recipes'].includes(action.type) && !Number.isInteger(action.payload?.expectedRevision);
    if (sameContext(action, context) && (['sync_inventory', 'sync_waste', 'sync_delivery_orders'].includes(action.type) || legacyConfig) && !action.recoveryReason) {
      await db.put('actions', { ...action, recoveryReason: action.type === 'sync_inventory' ? 'Older stock snapshots cannot establish a purchase quantity. Compare with server stock before reconciling.' : action.type === 'sync_waste' ? 'Older waste logs saved their stock adjustments separately. Compare logs and server stock before re-entering any waste.' : action.type === 'sync_delivery_orders' ? 'Older delivery snapshots cannot update the live board. Reload deliveries and review any missing changes.' : 'This older saved edit has no server version. Compare it with current server data before re-entering any missing changes.' });
      migrated = true;
    }
  }
  if (migrated) changed();
  return actions.filter(action => sameContext(action, context) && !['sync_inventory', 'sync_waste', 'sync_delivery_orders'].includes(action.type) && !(['sync_staff', 'sync_recipes'].includes(action.type) && !Number.isInteger(action.payload?.expectedRevision)) && !action.recoveryReason);
};
export const getRecoveryActions = async (context = getActionContext()) => {
  await getPendingActions(context);
  const actions = await (await initDB()).getAllFromIndex('actions', 'by-timestamp');
  return actions.filter(action => sameContext(action, context) && Boolean(action.recoveryReason));
};
export const clearAction = async (id: number) => {
  const db = await initDB(); const action = await db.get('actions', id);
  if (action && !sameContext(action, getActionContext())) throw new Error('This action belongs to another session');
  await db.delete('actions', id); changed();
};
export const markActionError = async (id: number, error: string, errorDetails?: PendingAction['errorDetails']) => {
  const db = await initDB();
  const action = await db.get('actions', id);
  if (action && sameContext(action, getActionContext())) await db.put('actions', { ...action, error, errorDetails });
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
