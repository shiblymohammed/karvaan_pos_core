import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  actions: {
    key: number;
    value: {
      id?: number;
      type: string;
      payload: any;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('karvaan_offline_db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('actions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
};

export const enqueueAction = async (type: string, payload: any) => {
  const db = await initDB();
  await db.add('actions', {
    type,
    payload,
    timestamp: Date.now(),
  });
  
  // Dispatch a custom event to update UI badge
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
};

export const getPendingActions = async () => {
  const db = await initDB();
  return db.getAllFromIndex('actions', 'by-timestamp');
};

export const clearAction = async (id: number) => {
  const db = await initDB();
  await db.delete('actions', id);
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
};

export const getQueueCount = async () => {
  const db = await initDB();
  return db.count('actions');
};
