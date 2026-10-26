import React, { useState } from 'react';
import { authorizedFetch } from '../services/authFetch';
import { toast } from '../store/useToastStore';

export interface StockApprovalRequest {
  stockChallenge: string;
  shortages?: { id: string; name: string; unit: string; available: number; required: number; shortfall: number }[];
  onApproved: (authorization: string) => Promise<void>;
}
export function StockApprovalDialog({ request, onClose }: { request: StockApprovalRequest; onClose: () => void }) {
  const [pin, setPin] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const approve = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await authorizedFetch('/auth/authorize-stock-shortage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, reason, challenge: request.stockChallenge }) });
      setPin('');
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Manager approval failed');
      await request.onApproved(result.authorization);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Stock approval failed'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="stock-approval-title">
    <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4 text-slate-800 max-h-[90vh] overflow-auto">
      <h2 id="stock-approval-title" className="font-bold text-lg">Manager approval for stock shortage</h2>
      <p className="text-sm">Continuing will record negative stock. Check the ingredients and explain why the sale can proceed.</p>
      <ul className="text-sm space-y-2">{request.shortages?.map(row => <li key={row.id}><strong>{row.name}</strong>: {row.available} {row.unit} available; {row.required} required. Short by {row.shortfall} {row.unit}.</li>)}</ul>
      <label className="block text-sm">Manager PIN<input autoFocus type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={event => setPin(event.target.value)} className="block border rounded-lg p-2 w-full mt-1" /></label>
      <label className="block text-sm">Reason<textarea value={reason} maxLength={500} onChange={event => setReason(event.target.value)} className="block border rounded-lg p-2 w-full mt-1" /></label>
      <div className="flex gap-3 justify-end"><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy || !pin || reason.trim().length < 5} onClick={() => void approve()} className="bg-amber-500 text-slate-950 rounded-lg px-4 py-2 disabled:opacity-40">{busy ? 'Confirming…' : 'Approve and continue'}</button></div>
    </div>
  </div>;
}
