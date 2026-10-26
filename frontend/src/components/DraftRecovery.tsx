import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecoverableCartDrafts } from '../store/tenantStorage';
import { getSavedSettingsDraft, markSettingsDraftReviewed } from '../store/useSettingsStore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/useAuthStore';
import { assertCurrentSession } from '../services/sessionGuard';
import { toast } from '../store/useToastStore';

export function DraftRecovery() {
  const navigate = useNavigate();
  const userId = useAuthStore(s => s.currentUser?.id);
  const items = useCartStore(s => s.items);
  const [drafts, setDrafts] = useState<ReturnType<typeof getRecoverableCartDrafts>>([]);
  const [settings, setSettings] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const refresh = () => { setDrafts(getRecoverableCartDrafts()); setSettings(getSavedSettingsDraft()); };
    refresh();
    window.addEventListener('local-draft-updated', refresh);
    return () => window.removeEventListener('local-draft-updated', refresh);
  }, [userId]);
  if (!drafts.length && !settings) return null;
  const review = (draft: typeof drafts[number]) => {
    try {
      assertCurrentSession();
      if (useCartStore.getState().items.length) throw new Error('Finish or park your current cart before opening this draft.');
      const saved = JSON.parse(draft.value).state;
      if (!Array.isArray(saved.items) || saved.items.some((item: any) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new Error('This older draft needs manual review; its item quantities or product references are invalid.');
      useCartStore.setState({ items: saved.items, orderType: saved.orderType || 'DINE_IN', selectedTableId: saved.selectedTableId || null, selectedTableName: saved.selectedTableName || null, selectedWaiter: saved.selectedWaiter || null, customer: saved.customer || null, discount: saved.discount || 0, currentOrderNumber: saved.currentOrderNumber || null, checkoutBillNumber: saved.checkoutBillNumber || null, orderVersion: null, deliveryAddress: saved.deliveryAddress || '', deliveryFee: saved.deliveryFee || 0 });
      navigate('/app/pos'); setOpen(false);
      toast.info('Draft opened for review. Check server orders and bill history before sending or charging it. The original copy is preserved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to open this draft'); }
  };
  return <div className="fixed bottom-20 right-4 z-[80] max-w-[90vw] rounded-xl border border-amber-400 bg-amber-100 text-amber-950 p-3 shadow-lg text-sm">
    <button onClick={() => setOpen(!open)}>Review saved local drafts</button>
    {open && <div className="mt-3 space-y-3 max-h-[55vh] overflow-auto max-w-lg">
      <p>These copies are for recovery. Check current server orders and bill history before re-entering anything.</p>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I checked that this draft belongs to the selected restaurant, backend, and cashier.</label>
      {drafts.map(draft => <div key={draft.key} className="border-t border-amber-300 pt-2">
        <strong>{draft.legacy ? 'Older cart — account and backend unknown' : 'Cart from an earlier tab'}</strong>
        {JSON.parse(draft.value).state.items.map((item: any, index: number) => <p key={index}>{item.quantity} × {item.name || item.productId}</p>)}
        <div className="flex gap-4 mt-2">
          <button disabled={!confirmed || items.length > 0} onClick={() => review(draft)}>Open for review in POS</button>
          <button disabled={!confirmed} onClick={() => { localStorage.setItem(`${draft.key}:reviewed`, new Date().toISOString()); setDrafts(getRecoverableCartDrafts()); }}>Mark reviewed</button>
        </div>
      </div>)}
      {settings && <details className="border-t border-amber-300 pt-2"><summary>Saved settings edit ({settings.savedAt})</summary><p>Compare this copy with current settings and re-enter only the changes you still want. Pending saves are shown in the confirmation panel.</p><pre className="whitespace-pre-wrap break-all mt-2">{JSON.stringify(settings.settings, null, 2)}</pre><button disabled={!confirmed} onClick={markSettingsDraftReviewed}>Mark this copy reviewed</button></details>}
    </div>}
  </div>;
}
