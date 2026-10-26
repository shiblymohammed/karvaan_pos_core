import React, { useEffect, useState } from 'react';
import { authorizedFetch } from '../services/authFetch';

export function StockApprovalsPanel() {
  const [records, setRecords] = useState<any[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try {
      const response = await authorizedFetch('/billing/stock-approvals');
      const rows = await response.json();
      if (!response.ok || !Array.isArray(rows)) throw new Error(rows.message || 'Stock approvals could not be loaded');
      setRecords(rows);
    } catch (error) { setError(error instanceof Error ? error.message : 'Stock approvals could not be loaded'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  return <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 text-slate-800">
    <div className="flex justify-between gap-3 items-center"><div><h3 className="font-bold">Manager-approved stock shortages</h3><p className="text-xs text-slate-500">Latest 100 approvals. Reconcile stock counts and missing purchases.</p></div><button disabled={busy} onClick={() => void load()} className="text-sm font-bold disabled:opacity-40">{busy ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!busy && !error && records.length === 0 && <p className="text-sm">No stock shortage approvals recorded.</p>}
    <div className="max-h-80 overflow-auto space-y-3">{records.map(record => <article key={record.id} className="rounded-xl bg-white border border-amber-100 p-3 text-sm space-y-1">
      <p className="font-bold">{record.reference}</p><p>{new Date(record.recordedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
      <p>Approved by {record.managerName || record.approvedBy} · Recorded by {record.cashierName || record.cashierId}</p>
      <p>{record.reason}</p>{record.shortages?.map((row: any) => <p key={row.id}>{row.name}: short by {row.shortfall} {row.unit} ({row.available} available; {row.required} required).</p>)}
    </article>)}</div>
  </section>;
}
