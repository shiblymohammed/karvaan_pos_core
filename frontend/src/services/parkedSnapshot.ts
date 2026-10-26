import { contextIsCurrent, getActionContext, getPendingActions } from './offlineQueue';

const appliedRevisions = new Map<string, number>();
export async function applyParkedSnapshot(rows: any[], apply: (orders: any[]) => void, revision?: number) {
  try {
    const context = getActionContext();
    const pending = await getPendingActions(context);
    if (!contextIsCurrent(context)) return;
    const key = JSON.stringify(context);
    if (revision !== undefined && revision < (appliedRevisions.get(key) ?? -1)) return;
    const merged = new Map(rows.map(row => [row.id, row]));
    for (const action of pending) {
      if (action.error) continue;
      if (action.type === 'park_order' && action.payload?.order?.id) {
        const id = action.payload.order.id, existing = merged.get(id);
        if (!existing || (existing.revision || 0) <= action.payload.expectedRevision) merged.set(id, { ...action.payload.order, revision: action.payload.expectedRevision + 1 });
      }
      if (action.type === 'remove_parked_order') {
        const existing = merged.get(action.payload.id);
        if (existing && (existing.revision || 0) <= action.payload.expectedRevision) merged.delete(action.payload.id);
      }
    }
    if (revision !== undefined) appliedRevisions.set(key, revision);
    apply([...merged.values()]);
  } catch { /* Keep the existing local drafts if the queue cannot be read. */ }
}
