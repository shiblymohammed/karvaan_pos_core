import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecoverableCartDrafts } from '../store/tenantStorage';
import { getSavedSettingsDraft, markSettingsDraftReviewed } from '../store/useSettingsStore';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/useAuthStore';
import { assertCurrentSession } from '../services/sessionGuard';
import { toast } from '../store/useToastStore';
import { History, X, Check, Trash2, ArrowUpRight } from 'lucide-react';

export function DraftRecovery() {
  const navigate = useNavigate();
  const userId = useAuthStore(s => s.currentUser?.id);
  const items = useCartStore(s => s.items);
  const [drafts, setDrafts] = useState<ReturnType<typeof getRecoverableCartDrafts>>([]);
  const [settings, setSettings] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setDrafts(getRecoverableCartDrafts());
      setSettings(getSavedSettingsDraft());
    };
    refresh();
    window.addEventListener('local-draft-updated', refresh);
    return () => window.removeEventListener('local-draft-updated', refresh);
  }, [userId]);

  if (!drafts.length && !settings) return null;

  const dismissAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    drafts.forEach(draft => {
      try {
        localStorage.setItem(`${draft.key}:reviewed`, new Date().toISOString());
      } catch {}
    });
    markSettingsDraftReviewed();
    setDrafts([]);
    setSettings(null);
    setOpen(false);
    toast.info('Saved local drafts dismissed.');
  };

  const review = (draft: typeof drafts[number]) => {
    try {
      assertCurrentSession();
      if (useCartStore.getState().items.length) {
        throw new Error('Finish or park your current cart before opening this draft.');
      }
      const saved = JSON.parse(draft.value).state;
      if (!Array.isArray(saved.items) || saved.items.some((item: any) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
        throw new Error('This older draft needs manual review; its item quantities or product references are invalid.');
      }
      useCartStore.setState({
        items: saved.items,
        orderType: saved.orderType || 'DINE_IN',
        selectedTableId: saved.selectedTableId || null,
        selectedTableName: saved.selectedTableName || null,
        selectedWaiter: saved.selectedWaiter || null,
        customer: saved.customer || null,
        discount: saved.discount || 0,
        currentOrderNumber: saved.currentOrderNumber || null,
        checkoutBillNumber: saved.checkoutBillNumber || null,
        orderVersion: null,
        deliveryAddress: saved.deliveryAddress || '',
        deliveryFee: saved.deliveryFee || 0,
      });
      navigate('/app/pos');
      setOpen(false);
      toast.info('Draft opened for review in cart. Check server orders and bill history before sending or charging it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open this draft');
    }
  };

  return (
    <>
      {/* Discreet floating pill positioned away from POS action buttons */}
      <div className="fixed top-3 right-4 md:right-20 z-40 pointer-events-auto flex items-center gap-1.5 bg-amber-500/95 hover:bg-amber-600 text-white px-3 py-1.5 rounded-full shadow-lg border border-amber-400 text-xs font-bold transition-all backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
          title="Click to view recovered cart drafts"
        >
          <History className="h-3.5 w-3.5" />
          <span>Local Drafts ({drafts.length + (settings ? 1 : 0)})</span>
        </button>
        <button
          onClick={dismissAll}
          className="ml-1 p-0.5 rounded-full hover:bg-black/20 focus:outline-none cursor-pointer text-amber-100 hover:text-white"
          title="Dismiss drafts"
          aria-label="Dismiss drafts"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Centered Modal Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2 text-amber-900">
                <History className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-base">Review Saved Local Drafts</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                These copies are preserved locally from earlier sessions or tabs. Check current server orders before restoring.
              </p>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>I confirm that these drafts belong to this cashier and terminal.</span>
              </label>

              <div className="space-y-3">
                {drafts.map(draft => {
                  let parsedItems: any[] = [];
                  try {
                    parsedItems = JSON.parse(draft.value).state?.items || [];
                  } catch {}

                  return (
                    <div key={draft.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">
                          {draft.legacy ? 'Older Cart Session' : 'Unsaved Cart Draft'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600 max-h-24 overflow-y-auto pl-1 border-l-2 border-amber-300">
                        {parsedItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity} × {item.name || item.productId}</span>
                            {item.price && <span className="font-medium text-slate-500">₹{(item.price * item.quantity).toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                        <button
                          disabled={!confirmed}
                          onClick={() => {
                            localStorage.setItem(`${draft.key}:reviewed`, new Date().toISOString());
                            setDrafts(getRecoverableCartDrafts());
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold text-slate-600 cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          disabled={!confirmed || items.length > 0}
                          onClick={() => review(draft)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span>Open in POS</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {settings && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                    <span className="font-bold text-xs text-slate-800">Saved Settings Draft ({settings.savedAt})</span>
                    <button
                      disabled={!confirmed}
                      onClick={() => {
                        markSettingsDraftReviewed();
                        setSettings(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold text-slate-600 cursor-pointer"
                    >
                      Dismiss Settings Draft
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={dismissAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Dismiss All Drafts</span>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
