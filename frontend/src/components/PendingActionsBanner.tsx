import React, { useEffect, useState } from 'react';
import { clearAction, getActionContext, getPendingActions, markActionError, PendingAction, replaceActionPayload, sameContext } from '../services/offlineQueue';
import { flushPendingActions } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/cartStore';
import { useNavigate } from 'react-router-dom';
import { toast } from '../store/useToastStore';
import { authorizedFetch } from '../services/authFetch';

export function PendingActionsBanner() {
  const navigate = useNavigate();
  const userId = useAuthStore(s => s.currentUser?.id);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [refund, setRefund] = useState<PendingAction | null>(null);
  const [pin, setPin] = useState('');
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void getPendingActions().then(data => { if (!cancelled) setActions(data); }).catch(() => {}); };
    refresh();
    window.addEventListener('offline-queue-updated', refresh);
    return () => { cancelled = true; window.removeEventListener('offline-queue-updated', refresh); };
  }, [userId]);
  const reviewBill = async (action: PendingAction) => {
    setBusy(action.id!);
    try {
      if (!sameContext(action, getActionContext())) throw new Error('Sign in with the original cashier to review this action.');
      const original = JSON.stringify(useCartStore.getState().items);
      const bill = action.payload;
      let latest: any = null;
      if (bill.orderNumber) {
        const response = await authorizedFetch(`/billing/active-order/${encodeURIComponent(bill.orderNumber)}${bill.tableId ? `?tableId=${encodeURIComponent(bill.tableId)}` : ''}`);
        latest = await response.json();
        if (!response.ok) throw new Error(latest.message || 'Latest order could not be loaded');
      }
      if (!sameContext(action, getActionContext()) || original !== JSON.stringify(useCartStore.getState().items)) throw new Error('The current session or cart changed. Open bill review again.');
      const cart = useCartStore.getState();
      if (cart.items.length) cart.holdCurrentOrder('Saved before bill review');
      let items = bill.items || [];
      if (latest) {
        const signature = (item: any) => `${item.productId || item.id}:${(item.addons || []).map((addon: any) => addon.id).sort().join(',')}`;
        const remaining = new Map<string, number>();
        for (const item of latest.items) remaining.set(signature(item), (remaining.get(signature(item)) || 0) + item.quantity);
        const extras: any[] = [];
        for (const item of [...items.filter((item: any) => item.status !== 'NEW'), ...items.filter((item: any) => item.status === 'NEW')]) {
          const key = signature(item), saved = remaining.get(key) || 0;
          remaining.set(key, Math.max(0, saved - item.quantity));
          if (item.status === 'NEW' && item.quantity > saved) extras.push({ ...item, quantity: item.quantity - saved });
        }
        items = [...latest.items, ...extras];
      }
      useCartStore.setState({ items, currentOrderNumber: latest?.orderNumber || bill.orderNumber, orderVersion: latest?.version || null, checkoutBillNumber: bill.billNumber, orderType: bill.orderType, selectedTableId: bill.tableId || null, selectedTableName: bill.table || null, discount: bill.discount || 0, customer: bill.customerPhone ? { name: bill.customerName, phone: bill.customerPhone } : null });
      navigate('/app/pos'); setOpen(false);
      toast.info('Latest kitchen items loaded. Review and confirm this bill to retry its original invoice.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Bill could not be loaded'); }
    finally { setBusy(null); }
  };
  const renewRefund = async () => {
    if (!refund || busy !== null) return;
    setBusy(refund.id!);
    try {
      if (!sameContext(refund, getActionContext())) throw new Error('Sign in with the original cashier to authorize this refund.');
      const actionId = refund.payload.actionId || refund.actionId;
      const response = await authorizedFetch('/auth/authorize-refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, actionId, billNumber: refund.payload.billNumber }) });
      setPin('');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Manager authorization failed');
      await replaceActionPayload(refund.id!, { ...refund.payload, actionId, authorization: data.authorization });
      setRefund(null);
      await flushPendingActions();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Refund could not be authorized'); }
    finally { setBusy(null); }
  };
  if (!actions.length) return null;
  const failed = actions.some(action => action.error);
  return <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] max-w-[90vw] rounded-xl bg-amber-100 border border-amber-400 text-amber-950 px-4 py-2 shadow-lg text-sm">
    <button onClick={() => setOpen(!open)}>{actions.length} action(s) awaiting confirmation{failed ? ' — review required' : ''}</button>
    {open && <div className="max-h-[60vh] overflow-y-auto space-y-3 mt-3">
      <p>Actions for the same bill, table, or stock item wait until their earlier error is resolved.</p>
      {refund && <div className="border border-amber-400 p-3 space-y-2">
        <p>Authorize refund for {refund.payload.billNumber} with a manager PIN.</p>
        <input type="password" autoComplete="off" aria-label="Manager PIN" value={pin} onChange={event => setPin(event.target.value)} className="rounded border p-2" />
        <button disabled={busy !== null || !pin} onClick={() => void renewRefund()}>Authorize and retry</button>
        <button disabled={busy !== null} onClick={() => { setPin(''); setRefund(null); }}>Cancel</button>
      </div>}
      {actions.map(action => <div key={action.id} className="border-t border-amber-300 pt-2">
        <strong>{action.payload?.billNumber || (action.type === 'sync_inventory' ? 'Older inventory update — review needed' : action.type === 'receive_inventory_purchase' ? 'Stock purchase' : action.type)}</strong>
        <p>{action.error || 'Saved on this device; awaiting the restaurant server.'}</p>
        {action.type === 'sync_inventory' && <>
          <p>Open Inventory &amp; Recipes and reload server stock. Compare these older saved values before removing the action; re-enter only purchases missing from the server.</p>
          {Array.isArray(action.payload) && <details><summary>Saved stock values</summary>{action.payload.map((row: any, index: number) => <p key={row.id || index}>{row.name || row.id}: {Number.isFinite(row.currentStock) ? row.currentStock : 'Invalid or missing quantity'} {row.unit || ''}</p>)}</details>}
        </>}
        <div className="flex gap-4 mt-1">
          {action.type === 'settle_bill' && action.error && <button disabled={busy !== null} onClick={() => void reviewBill(action)}>Review in POS</button>}
          {action.type === 'record_return' && action.error && <button disabled={busy !== null} onClick={() => { setPin(''); setRefund(action); }}>Renew manager approval</button>}
          {action.type !== 'sync_inventory' && <button disabled={busy !== null} onClick={async () => { await markActionError(action.id!, ''); await flushPendingActions(); }}>Retry</button>}
          <button onClick={async () => {
            if (window.confirm(`Remove pending ${action.payload?.billNumber || action.type}? Check the server history first: an interrupted acknowledgment can mean it was already saved.`)) await clearAction(action.id!);
          }}>Remove after review</button>
        </div>
      </div>)}
    </div>}
  </div>;
}
