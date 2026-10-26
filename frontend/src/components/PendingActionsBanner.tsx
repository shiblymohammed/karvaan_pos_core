import React, { useEffect, useState } from 'react';
import { clearAction, getActionContext, getPendingActions, getRecoveryActions, markActionError, PendingAction, replaceActionPayload, sameContext } from '../services/offlineQueue';
import { flushPendingActions, socket } from '../services/socket';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/cartStore';
import { useNavigate } from 'react-router-dom';
import { toast } from '../store/useToastStore';
import { authorizedFetch } from '../services/authFetch';
import { getServerUrl } from '../services/serverConfig';
import { useStaffStore } from '../store/useStaffStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { applyRemoteSettings } from '../store/useSettingsStore';
import { StockApprovalDialog } from './StockApprovalDialog';

const reviewValues = (value: any): string => JSON.stringify(value, (key, item) => /pin|password|token|authorization/i.test(key) ? undefined : item, 2);

export function PendingActionsBanner() {
  const navigate = useNavigate();
  const userId = useAuthStore(s => s.currentUser?.id);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [recovery, setRecovery] = useState<PendingAction[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [refund, setRefund] = useState<PendingAction | null>(null);
  const [pin, setPin] = useState('');
  const [stockApproval, setStockApproval] = useState<PendingAction | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const changed = () => setConnected(socket.connected);
    socket.on('connect', changed); socket.on('disconnect', changed); socket.on('connect_error', changed);
    return () => { socket.off('connect', changed); socket.off('disconnect', changed); socket.off('connect_error', changed); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void (async () => {
      const pending = await getPendingActions();
      const saved = await getRecoveryActions();
      if (!cancelled) { setActions(pending); setRecovery(saved); }
    })().catch(() => {}); };
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
      if (cart.items.length && !await cart.holdCurrentOrder('Saved before bill review')) throw new Error('The current cart could not be parked. It has been preserved.');
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
  const reloadConfig = async (action: PendingAction) => {
    setBusy(action.id!);
    try {
      if (!sameContext(action, getActionContext())) throw new Error('Sign in with the original account to review this edit.');
      const response = await authorizedFetch(action.type === 'update_settings' ? '/settings' : '/billing/admin-config');
      const current = await response.json();
      if (!response.ok) throw new Error(current.message || 'Current server data could not be loaded');
      if (!sameContext(action, getActionContext())) throw new Error('The account changed during review.');
      if (action.type === 'update_settings') applyRemoteSettings(current, true);
      else if (action.type === 'sync_staff') useStaffStore.setState({ staff: current.staff, serverRevision: current.staffRevision });
      else useInventoryStore.setState({ recipes: current.recipes, recipeRevision: current.recipeRevision });
      toast.info('Current server data loaded. Your failed edit is preserved below; compare it before removing it and re-entering any missing changes.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to reload server data'); }
    finally { setBusy(null); }
  };
  if (!actions.length && !recovery.length) return null;
  const failed = actions.some(action => action.error);
  return <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] max-w-[90vw] rounded-xl bg-amber-100 border border-amber-400 text-amber-950 px-4 py-2 shadow-lg text-sm">
    <button onClick={() => setOpen(!open)}>{actions.length ? `${actions.length} action(s) awaiting confirmation${failed ? ' — review required' : ''}` : `${recovery.length} older update(s) saved for review`}</button>
    {open && <div className="max-h-[60vh] overflow-y-auto space-y-3 mt-3">
      <p>{connected ? 'Connected' : 'Reconnecting'} to {getServerUrl()}. Pending purchases are kept until the server confirms them.</p>
      <p>Actions for the same bill, table, or stock item wait until their earlier error is resolved.</p>
      {refund && <div className="border border-amber-400 p-3 space-y-2">
        <p>Authorize refund for {refund.payload.billNumber} with a manager PIN.</p>
        <input type="password" autoComplete="off" aria-label="Manager PIN" value={pin} onChange={event => setPin(event.target.value)} className="rounded border p-2" />
        <button disabled={busy !== null || !pin} onClick={() => void renewRefund()}>Authorize and retry</button>
        <button disabled={busy !== null} onClick={() => { setPin(''); setRefund(null); }}>Cancel</button>
      </div>}
      {recovery.length > 0 && <button onClick={() => setShowRecovery(!showRecovery)}>{showRecovery ? 'Hide' : 'Review'} {recovery.length} older update(s) — saved separately, no longer sent</button>}
      {[...actions, ...(showRecovery ? recovery : [])].map(action => <div key={action.id} className="border-t border-amber-300 pt-2">
        <strong>{action.payload?.billNumber || (action.type === 'sync_inventory' ? 'Older inventory update — review needed' : action.type === 'receive_inventory_purchase' ? 'Stock purchase' : action.type)}</strong>
        <p>{action.recoveryReason || action.error || action.lastAttemptMessage || 'Saved on this device; awaiting the restaurant server.'}</p>
        {action.type === 'receive_inventory_purchase' && <p>{action.payload.purchaseUnits} {action.payload.purchaseUnit}{action.payload.invoiceCost !== undefined ? ` · Invoice total ₹${action.payload.invoiceCost}` : ''}{action.payload.vendor ? ` · ${action.payload.vendor}` : ''}</p>}
        {action.errorDetails?.shortages?.map(row => <p key={row.id}>{row.name}: {row.available} {row.unit} available; {row.required} required.</p>)}
        {action.type === 'sync_inventory' && <>
          <p>Open Inventory &amp; Recipes and reload server stock. Compare these older saved values before removing the action; re-enter only purchases missing from the server.</p>
          {Array.isArray(action.payload) && <details><summary>Saved stock values</summary>{action.payload.map((row: any, index: number) => <p key={row.id || index}>{row.name || row.id}: {Number.isFinite(row.currentStock) ? row.currentStock : 'Invalid or missing quantity'} {row.unit || ''}</p>)}</details>}
        </>}
        {['sync_waste', 'sync_delivery_orders'].includes(action.type) && <details><summary>Older saved values for review</summary><pre className="whitespace-pre-wrap break-all">{reviewValues(action.payload)}</pre></details>}
        {['sync_staff', 'sync_recipes', 'update_settings'].includes(action.type) && <details><summary>Saved edit for comparison</summary><pre className="whitespace-pre-wrap break-all">{reviewValues(action.payload)}</pre></details>}
        <div className="flex gap-4 mt-1">
          {action.errorDetails?.stockChallenge && <button onClick={() => setStockApproval(action)}>Manager approve stock shortage</button>}
          {['sync_staff', 'sync_recipes', 'update_settings'].includes(action.type) && <button disabled={busy !== null} onClick={() => void reloadConfig(action)}>Reload current server data</button>}
          {action.type === 'settle_bill' && action.error && <button disabled={busy !== null} onClick={() => void reviewBill(action)}>Review in POS</button>}
          {action.type === 'record_return' && action.error && <button disabled={busy !== null} onClick={() => { setPin(''); setRefund(action); }}>Renew manager approval</button>}
          {!action.recoveryReason && action.type !== 'sync_inventory' && <button disabled={busy !== null} onClick={async () => { await markActionError(action.id!, ''); await flushPendingActions(); }}>Retry</button>}
          <button onClick={async () => {
            if (window.confirm(`Remove pending ${action.payload?.billNumber || action.type}? Check the server history first: an interrupted acknowledgment can mean it was already saved.`)) await clearAction(action.id!);
          }}>Remove after review</button>
        </div>
      </div>)}
    </div>}
    {stockApproval?.errorDetails?.stockChallenge && <StockApprovalDialog key={stockApproval.errorDetails.stockChallenge} request={{ stockChallenge: stockApproval.errorDetails.stockChallenge, shortages: stockApproval.errorDetails.shortages, onApproved: async authorization => {
      await replaceActionPayload(stockApproval.id!, { ...stockApproval.payload, stockAuthorization: authorization });
      const id = stockApproval.id!;
      setStockApproval(null);
      const results = await flushPendingActions();
      if (results.get(id)?.status === 'OK') toast.success('Manager approval recorded and the original action confirmed by the server.');
      else toast.info('Approval saved with the original action. Check pending actions for server confirmation.');
    } }} onClose={() => setStockApproval(null)} />}
  </div>;
}
