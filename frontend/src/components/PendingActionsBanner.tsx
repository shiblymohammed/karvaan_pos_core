import React, { useEffect, useState } from 'react';
import { clearAction, getPendingActions, markActionError, PendingAction } from '../services/offlineQueue';
import { flushPendingActions } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';

export function PendingActionsBanner() {
  const userId = useAuthStore(s => s.currentUser?.id);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void getPendingActions().then(data => { if (!cancelled) setActions(data); }).catch(() => {}); };
    refresh();
    window.addEventListener('offline-queue-updated', refresh);
    return () => { cancelled = true; window.removeEventListener('offline-queue-updated', refresh); };
  }, [userId]);
  if (!actions.length) return null;
  const failed = actions.some(action => action.error);
  return <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] max-w-[90vw] rounded-xl bg-amber-100 border border-amber-400 text-amber-950 px-4 py-2 shadow-lg text-sm">
    <button onClick={() => setOpen(!open)}>{actions.length} action(s) awaiting confirmation{failed ? ' — review required' : ''}</button>
    {open && <div className="max-h-[60vh] overflow-y-auto space-y-3 mt-3">
      {actions.map(action => <div key={action.id} className="border-t border-amber-300 pt-2">
        <strong>{action.payload?.billNumber || action.type}</strong>
        <p>{action.error || 'Saved on this device; awaiting the restaurant server.'}</p>
        <div className="flex gap-4 mt-1">
          <button onClick={async () => { await markActionError(action.id!, ''); await flushPendingActions(); }}>Retry</button>
          <button onClick={async () => {
            if (window.confirm(`Remove pending ${action.payload?.billNumber || action.type}? Check the server history first: an interrupted acknowledgment can mean it was already saved.`)) await clearAction(action.id!);
          }}>Remove after review</button>
        </div>
      </div>)}
    </div>}
  </div>;
}
