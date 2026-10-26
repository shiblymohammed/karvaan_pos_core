import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePrintQueue } from '../services/printQueue';
import { PrintQueuePanel } from './PrintQueuePanel';

export const PrintStatus: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dialog = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [open]);
  const token = useAuthStore(state => state.accessToken);
  const role = useAuthStore(state => state.currentUser?.role);
  const { data, error, refresh, clear } = usePrintQueue();
  const allowed = ['ADMIN', 'REST_ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'].includes(role || '');
  useEffect(() => {
    if (!allowed) return;
    const show = () => setOpen(true);
    window.addEventListener('karvaan-open-print-jobs', show);
    return () => window.removeEventListener('karvaan-open-print-jobs', show);
  }, [allowed]);
  useEffect(() => {
    clear(); setOpen(false);
    if (!token || !allowed) return;
    let stopped = false, timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(); } catch {}
      if (!stopped) timeout = setTimeout(() => { void poll(); }, document.hidden ? 30000 : 5000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timeout); clear(); };
  }, [token, allowed, clear, refresh]);
  if (!allowed) return null;
  const waiting = data?.jobs.filter(job => ['QUEUED', 'CLAIMED', 'SENDING'].includes(job.state)).length || 0;
  const attention = data?.jobs.filter(job => !job.reviewedAt && ['FAILED', 'UNCERTAIN'].includes(job.state)).length || 0;
  return <>
    <button onClick={() => setOpen(true)} className={`fixed right-4 bottom-24 md:bottom-5 z-40 flex gap-2 items-center rounded-xl border px-3 py-2 shadow bg-white ${attention || error ? 'text-red-700 border-red-200' : 'text-slate-700'}`} aria-label="Open print jobs"><Printer size={16} /><span className="text-xs font-bold">Printing{attention ? ` · ${attention} need review` : waiting ? ` · ${waiting} waiting` : error ? ' · unavailable' : ''}</span></button>
    {open && <div ref={dialog} tabIndex={-1} className="fixed inset-0 z-[150] bg-black/40 p-4 flex justify-end" role="dialog" aria-modal="true" aria-label="Print jobs" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false); }}><div className="w-full max-w-xl bg-slate-50 rounded-2xl p-5 overflow-y-auto"><div className="flex justify-end mb-3"><button aria-label="Close print jobs" onClick={() => setOpen(false)}><X /></button></div><PrintQueuePanel /></div></div>}
  </>;
};
