import React, { useEffect, useState } from 'react';
import {
  clearAction,
  getActionContext,
  getPendingActions,
  getRecoveryActions,
  markActionError,
  PendingAction,
  replaceActionPayload,
  sameContext,
} from '../services/offlineQueue';
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
import {
  CloudOff,
  RefreshCw,
  AlertTriangle,
  X,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Server,
  Layers,
  CheckCircle2,
} from 'lucide-react';

const reviewValues = (value: any): string =>
  JSON.stringify(value, (key, item) => (/pin|password|token|authorization/i.test(key) ? undefined : item), 2);

export function PendingActionsBanner() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.currentUser?.id);
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
    socket.on('connect', changed);
    socket.on('disconnect', changed);
    socket.on('connect_error', changed);
    return () => {
      socket.off('connect', changed);
      socket.off('disconnect', changed);
      socket.off('connect_error', changed);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void (async () => {
        const pending = await getPendingActions();
        const saved = await getRecoveryActions();
        if (!cancelled) {
          setActions(pending);
          setRecovery(saved);
        }
      })().catch(() => {});
    };
    refresh();
    window.addEventListener('offline-queue-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('offline-queue-updated', refresh);
    };
  }, [userId]);

  const reviewBill = async (action: PendingAction) => {
    setBusy(action.id!);
    try {
      if (!sameContext(action, getActionContext()))
        throw new Error('Sign in with the original cashier to review this action.');
      const original = JSON.stringify(useCartStore.getState().items);
      const bill = action.payload;
      let latest: any = null;
      if (bill.orderNumber) {
        const response = await authorizedFetch(
          `/billing/active-order/${encodeURIComponent(bill.orderNumber)}${bill.tableId ? `?tableId=${encodeURIComponent(bill.tableId)}` : ''}`
        );
        latest = await response.json();
        if (!response.ok) throw new Error(latest.message || 'Latest order could not be loaded');
      }
      if (!sameContext(action, getActionContext()) || original !== JSON.stringify(useCartStore.getState().items))
        throw new Error('The current session or cart changed. Open bill review again.');
      const cart = useCartStore.getState();
      if (cart.items.length && !(await cart.holdCurrentOrder('Saved before bill review')))
        throw new Error('The current cart could not be parked. It has been preserved.');
      let items = bill.items || [];
      if (latest) {
        const signature = (item: any) =>
          `${item.productId || item.id}:${(item.addons || []).map((addon: any) => addon.id).sort().join(',')}`;
        const remaining = new Map<string, number>();
        for (const item of latest.items) remaining.set(signature(item), (remaining.get(signature(item)) || 0) + item.quantity);
        const extras: any[] = [];
        for (const item of [...items.filter((item: any) => item.status !== 'NEW'), ...items.filter((item: any) => item.status === 'NEW')]) {
          const key = signature(item),
            saved = remaining.get(key) || 0;
          remaining.set(key, Math.max(0, saved - item.quantity));
          if (item.status === 'NEW' && item.quantity > saved) extras.push({ ...item, quantity: item.quantity - saved });
        }
        items = [...latest.items, ...extras];
      }
      useCartStore.setState({
        items,
        currentOrderNumber: latest?.orderNumber || bill.orderNumber,
        orderVersion: latest?.version || null,
        checkoutBillNumber: bill.billNumber,
        orderType: bill.orderType,
        selectedTableId: bill.tableId || null,
        selectedTableName: bill.table || null,
        discount: bill.discount || 0,
        customer: bill.customerPhone ? { name: bill.customerName, phone: bill.customerPhone } : null,
      });
      navigate('/app/pos');
      setOpen(false);
      toast.info('Latest kitchen items loaded. Review and confirm this bill to retry its original invoice.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bill could not be loaded');
    } finally {
      setBusy(null);
    }
  };

  const renewRefund = async () => {
    if (!refund || busy !== null) return;
    setBusy(refund.id!);
    try {
      if (!sameContext(refund, getActionContext()))
        throw new Error('Sign in with the original cashier to authorize this refund.');
      const actionId = refund.payload.actionId || refund.actionId;
      const response = await authorizedFetch('/auth/authorize-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, actionId, billNumber: refund.payload.billNumber }),
      });
      setPin('');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Manager authorization failed');
      await replaceActionPayload(refund.id!, { ...refund.payload, actionId, authorization: data.authorization });
      setRefund(null);
      await flushPendingActions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund could not be authorized');
    } finally {
      setBusy(null);
    }
  };

  const reloadConfig = async (action: PendingAction) => {
    setBusy(action.id!);
    try {
      if (!sameContext(action, getActionContext()))
        throw new Error('Sign in with the original account to review this edit.');
      const response = await authorizedFetch(action.type === 'update_settings' ? '/settings' : '/billing/admin-config');
      const current = await response.json();
      if (!response.ok) throw new Error(current.message || 'Current server data could not be loaded');
      if (!sameContext(action, getActionContext())) throw new Error('The account changed during review.');
      if (action.type === 'update_settings') applyRemoteSettings(current, true);
      else if (action.type === 'sync_staff')
        useStaffStore.setState({ staff: current.staff, serverRevision: current.staffRevision });
      else useInventoryStore.setState({ recipes: current.recipes, recipeRevision: current.recipeRevision });
      toast.info('Current server data loaded. Your failed edit is preserved below; compare it before removing it.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reload server data');
    } finally {
      setBusy(null);
    }
  };

  if (!actions.length && !recovery.length) return null;

  const failed = actions.some((action) => action.error);
  const totalCount = actions.length + (showRecovery ? recovery.length : 0);

  return (
    <>
      {/* ─── Compact, Non-Intrusive Floating Trigger Pill (Bottom-Left) ─── */}
      <div className="fixed left-4 bottom-20 md:bottom-5 z-40 pointer-events-auto">
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border shadow-lg backdrop-blur-md transition-all active:scale-95 cursor-pointer font-bold text-xs ${
            failed
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 hover:bg-amber-500/25 shadow-amber-500/10'
              : 'bg-slate-900/90 border-slate-700 text-slate-100 hover:bg-slate-800 shadow-slate-950/20'
          }`}
          title="Open Offline Sync Queue"
          aria-label="Offline Sync Queue"
        >
          {failed ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span>
            {actions.length
              ? `${actions.length} Offline Sync${actions.length > 1 ? 's' : ''}${failed ? ' (Review)' : ''}`
              : `${recovery.length} Saved Record(s)`}
          </span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected ? 'bg-emerald-500 ring-2 ring-emerald-500/30' : 'bg-amber-500 animate-ping'
            }`}
          />
        </button>
      </div>

      {/* ─── Clean, Modern Centered Modal Dialog ─── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    failed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {failed ? <AlertTriangle className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">Offline Sync Queue</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                        connected ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      />
                      {connected ? 'Connected' : 'Reconnecting to'}{' '}
                      <span className="font-mono opacity-80 max-w-[200px] truncate">{getServerUrl()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Transactions and configuration updates are held safely in your browser and automatically dispatched
                when the server acknowledges them.
              </p>

              {/* Refund PIN Prompt */}
              {refund && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Authorize refund for {refund.payload.billNumber} with Manager PIN:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder="Manager PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      disabled={busy !== null || !pin}
                      onClick={() => void renewRefund()}
                      className="px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Authorize &amp; Retry
                    </button>
                    <button
                      disabled={busy !== null}
                      onClick={() => {
                        setPin('');
                        setRefund(null);
                      }}
                      className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Recovery Toggle */}
              {recovery.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowRecovery(!showRecovery)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    {showRecovery ? 'Hide' : 'Show'} {recovery.length} older archived record(s)
                  </button>
                </div>
              )}

              {/* Actions List */}
              <div className="space-y-3">
                {[...actions, ...(showRecovery ? recovery : [])].map((action) => {
                  const isError = Boolean(action.error);
                  const isBill = action.type === 'settle_bill';
                  const title =
                    action.payload?.billNumber ||
                    (action.type === 'sync_inventory'
                      ? 'Inventory Reconcile'
                      : action.type === 'receive_inventory_purchase'
                        ? 'Stock Purchase'
                        : action.type === 'sync_menu'
                          ? 'Menu Synchronization'
                          : action.type);

                  return (
                    <div
                      key={action.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isError ? 'bg-amber-50/70 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                isBill
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isError
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {action.type.replace('_', ' ')}
                            </span>
                            <span className="font-black text-slate-900 text-sm">{title}</span>
                          </div>

                          <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">
                            {action.recoveryReason ||
                              action.error ||
                              action.lastAttemptMessage ||
                              'Queued on this device; awaiting server confirmation.'}
                          </p>

                          {action.type === 'receive_inventory_purchase' && (
                            <p className="text-xs font-bold text-slate-600 mt-1">
                              {action.payload.purchaseUnits} {action.payload.purchaseUnit}
                              {action.payload.invoiceCost !== undefined
                                ? ` · Invoice total ₹${action.payload.invoiceCost}`
                                : ''}
                              {action.payload.vendor ? ` · ${action.payload.vendor}` : ''}
                            </p>
                          )}

                          {action.errorDetails?.shortages?.map((row) => (
                            <p key={row.id} className="text-xs font-bold text-rose-600 mt-1">
                              {row.name}: {row.available} {row.unit} available; {row.required} required.
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/60">
                        {action.errorDetails?.stockChallenge && (
                          <button
                            onClick={() => setStockApproval(action)}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                          >
                            Approve Shortage
                          </button>
                        )}

                        {['sync_staff', 'sync_recipes', 'update_settings'].includes(action.type) && (
                          <button
                            disabled={busy !== null}
                            onClick={() => void reloadConfig(action)}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Reload Server Data
                          </button>
                        )}

                        {action.type === 'settle_bill' && action.error && (
                          <button
                            disabled={busy !== null}
                            onClick={() => void reviewBill(action)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Review in POS
                          </button>
                        )}

                        {action.type === 'record_return' && action.error && (
                          <button
                            disabled={busy !== null}
                            onClick={() => {
                              setPin('');
                              setRefund(action);
                            }}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                          >
                            Renew PIN
                          </button>
                        )}

                        {!action.recoveryReason && action.type !== 'sync_inventory' && (
                          <button
                            disabled={busy !== null}
                            onClick={async () => {
                              await markActionError(action.id!, '');
                              await flushPendingActions();
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" /> Retry
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Remove pending ${action.payload?.billNumber || action.type}? Check server history first: an interrupted acknowledgment may mean it was already recorded.`
                              )
                            ) {
                              await clearAction(action.id!);
                            }
                          }}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">
                {actions.length} action{actions.length > 1 ? 's' : ''} in queue
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Approval Dialog */}
      {stockApproval?.errorDetails?.stockChallenge && (
        <StockApprovalDialog
          key={stockApproval.errorDetails.stockChallenge}
          request={{
            stockChallenge: stockApproval.errorDetails.stockChallenge,
            shortages: stockApproval.errorDetails.shortages,
            onApproved: async (authorization) => {
              await replaceActionPayload(stockApproval.id!, {
                ...stockApproval.payload,
                stockAuthorization: authorization,
              });
              const id = stockApproval.id!;
              setStockApproval(null);
              const results = await flushPendingActions();
              if (results.get(id)?.status === 'OK')
                toast.success('Manager approval recorded and the original action confirmed by the server.');
              else toast.info('Approval saved with the original action. Check pending actions for server confirmation.');
            },
          }}
          onClose={() => setStockApproval(null)}
        />
      )}
    </>
  );
}
