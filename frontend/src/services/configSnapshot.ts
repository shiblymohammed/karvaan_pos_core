import { getActionContext, getPendingActions, sameContext } from './offlineQueue';
import { toast } from '../store/useToastStore';

export function canEditConfig(revision: number) {
  if (revision >= 0) return true;
  toast.error('Load current server data before editing. Connect to the restaurant backend and reload this screen.');
  return false;
}

// A broadcast acknowledging an earlier edit must not replace a newer queued edit.
export async function applyConfigSnapshot(type: string, revision: number, currentRevision: () => number, apply: () => void) {
  try {
    const context = getActionContext();
    const pending = await getPendingActions(context);
    if (!sameContext(context, getActionContext()) || revision < currentRevision()) return false;
    if (pending.some(action => action.type === type && Number.isInteger(action.payload?.expectedRevision) && action.payload.expectedRevision >= revision)) return false;
    apply();
    return true;
  } catch { return false; }
}
