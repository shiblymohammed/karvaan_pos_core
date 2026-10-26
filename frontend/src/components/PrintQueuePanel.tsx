import React, { useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { printStateLabel, PrintJob, usePrintQueue } from '../services/printQueue';
import { createId } from '../services/createId';
import { toast } from '../store/useToastStore';
import { useAuthStore } from '../store/useAuthStore';

export const PrintQueuePanel: React.FC = () => {
  const { data, error, refresh } = usePrintQueue();
  const [review, setReview] = useState<PrintJob | null>(null);
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useRef('');
  const role = useAuthStore(state => state.currentUser?.role);
  const admin = ['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(role || '');
  const recover = async () => {
    if (busy || !review || !checked || !reason.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(`/printer/queue/jobs/${review.id}/recover`, { requestId: requestId.current, reason, confirmed: true });
      toast.info('A marked reprint was queued. The original sale was not changed.'); setReview(null); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not request reprint. Retry this same request.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 text-slate-800">
    <div className="flex justify-between items-center gap-3"><h3 className="font-bold">Print jobs</h3><button className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => { void refresh().catch(() => {}); }}>Refresh</button></div>
    <p className="text-xs text-slate-500">Latest 100 jobs plus up to 100 older unresolved jobs, oldest first. “Sent” means accepted by the connection or Windows queue; check the printer for paper output.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!data?.jobs.length && <p className="text-sm text-slate-500">No print jobs loaded.</p>}
    <div className="max-h-80 overflow-auto space-y-2">
      {data?.jobs.map(job => <div key={job.id} className="rounded-xl border bg-white p-3 text-sm">
        <div className="flex justify-between gap-2"><strong className="break-all">{job.kind} · {job.reference}</strong><span className={['FAILED', 'UNCERTAIN'].includes(job.state) ? 'text-red-700' : 'text-slate-600'}>{printStateLabel(job.state)}</span></div>
        {job.parentId && <p className="text-xs text-amber-700">Marked reprint</p>}
        {job.reviewedAt && <p className="text-xs text-slate-500">Reviewed</p>}
        {job.error && <p className="mt-1 text-xs text-red-700">{job.error}</p>}
        <div className="flex gap-3 mt-2">
          {['FAILED', 'UNCERTAIN', 'SENT', 'CANCELLED'].includes(job.state) && <button disabled={busy} className="text-indigo-700 font-bold" onClick={() => { setReview(job); setReason(''); setChecked(false); requestId.current = createId(); }}>Review / reprint</button>}
          {admin && job.state === 'QUEUED' && <button disabled={busy} className="text-red-700" onClick={() => { setReview(job); setReason(''); setChecked(false); requestId.current = 'cancel'; }}>Cancel waiting job</button>}
        </div>
      </div>)}
    </div>
    {review && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="font-bold">{requestId.current === 'cancel' ? 'Cancel waiting job' : 'Check the printer before reprinting'} · {review.reference}</p>
      <p className="text-sm">Check the paper and Windows queue. A delayed document may already be printed or still waiting locally.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)} />I checked the paper and printer queue{requestId.current === 'cancel' ? ' and want to cancel this waiting job' : ''}.</label>
      <label className="block text-sm">Reason<input className="block w-full rounded-lg border p-2 mt-1" maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex gap-3"><button disabled={busy || !checked || !reason.trim()} className="rounded-lg bg-slate-800 text-white px-4 py-2 disabled:opacity-40" onClick={() => {
        if (requestId.current !== 'cancel') { void recover(); return; }
        if (busy) return; setBusy(true);
        void apiClient.post(`/printer/queue/jobs/${review.id}/cancel`, { reason }).then(async () => { setReview(null); await refresh(); }).catch(error => toast.error(error.message)).finally(() => setBusy(false));
      }}>{busy ? 'Saving…' : requestId.current === 'cancel' ? 'Cancel job' : 'Queue marked reprint'}</button><button disabled={busy} onClick={() => setReview(null)}>Back</button></div>
      {requestId.current !== 'cancel' && <button disabled={busy || !checked || !reason.trim()} className="text-sm underline disabled:opacity-40" onClick={() => {
        if (busy) return; setBusy(true);
        void apiClient.post(`/printer/queue/jobs/${review.id}/review`, { reason, confirmed: true }).then(async () => { setReview(null); await refresh(); toast.info('Paper check recorded. No new copy was queued.'); }).catch(error => toast.error(error.message)).finally(() => setBusy(false));
      }}>Paper checked — no new copy needed</button>}
    </div>}
  </section>;
};
