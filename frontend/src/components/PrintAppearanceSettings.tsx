import React, { useEffect, useRef, useState } from 'react';
import { Printer, Save } from 'lucide-react';
import { applyRemoteSettings, useSettingsStore } from '../store/useSettingsStore';
import { ReceiptLogoUploader } from './ReceiptLogoUploader';
import { PRINT_LAYOUTS, PrintBranding, PrintLayoutKind, PrintLayoutPreview, printLayoutSample } from './PrintLayoutPreview';
import { apiClient } from '../services/apiClient';
import { canEditConfig } from '../services/configSnapshot';
import { createId } from '../services/createId';
import { getActionContext, sameContext } from '../services/offlineQueue';
import { toast } from '../store/useToastStore';

const fromSettings = (state: ReturnType<typeof useSettingsStore.getState>) => ({ receiptName: state.receiptName || '', receiptPhone: state.receiptPhone || '', receiptAddress: state.receiptAddress || '', receiptGstin: state.receiptGstin || '', receiptLogo: state.receiptLogo || '', receiptFooterNote: state.receiptFooterNote || '', checkoutReceiptAndKot: state.checkoutReceiptAndKot });
export function PrintAppearanceSettings() {
  const settings = useSettingsStore();
  const [form, setForm] = useState(() => fromSettings(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<PrintLayoutKind>('RECEIPT');
  const [width, setWidth] = useState<58 | 80>(80);
  const dirty = useRef(false);
  const revision = useRef(settings.serverRevision);
  const request = useRef<{ signature: string; actionId: string; expectedRevision: number } | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!dirty.current) { setForm(fromSettings(settings)); revision.current = settings.serverRevision; } }, [settings.serverRevision]);
  const change = (field: keyof typeof form, value: string | boolean) => { dirty.current = true; setForm(current => ({ ...current, [field]: value })); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !canEditConfig(revision.current)) return;
    const values = { ...form, receiptName: form.receiptName.trim(), receiptPhone: form.receiptPhone.trim(), receiptAddress: form.receiptAddress.trim(), receiptGstin: form.receiptGstin.trim(), receiptFooterNote: form.receiptFooterNote.trim() };
    if (!values.receiptName) { setError('Enter the restaurant name.'); return; }
    const signature = JSON.stringify(values);
    if (request.current?.signature !== signature) request.current = { signature, actionId: createId(), expectedRevision: revision.current };
    setBusy(true); setError('');
    try {
      const context = getActionContext();
      const result = await apiClient.put('/settings', { ...values, actionId: request.current.actionId, expectedRevision: request.current.expectedRevision });
      if (!sameContext(context, getActionContext())) return;
      applyRemoteSettings(result); dirty.current = false; revision.current = result.serverRevision; request.current = null;
      setForm(values); toast.success('Print settings saved to the restaurant server.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save. Your changes are still here.'); }
    finally { setBusy(false); }
  };
  const branding: PrintBranding = form;
  return <section className="rounded-2xl border bg-white p-4 sm:p-6 space-y-6 text-slate-800">
    <header><h1 className="text-xl font-extrabold flex items-center gap-2"><Printer className="h-5 w-5" />Printing & restaurant details</h1><p className="mt-1 text-sm text-slate-500">Upload your logo, enter your details and use a ready-made layout.</p></header>
    <div className="grid lg:grid-cols-2 gap-8">
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <ReceiptLogoUploader logo={form.receiptLogo} onChange={logo => change('receiptLogo', logo || '')} />
          {([['receiptName', 'Restaurant name', 120], ['receiptPhone', 'Restaurant phone number', 60], ['receiptGstin', 'GST / tax registration number (optional)', 60], ['receiptFooterNote', 'Thank-you message (optional)', 300]] as const).map(([field, label, maxLength]) => <label key={field} className="block text-sm font-semibold">{label}<input value={form[field]} maxLength={maxLength} required={field === 'receiptName'} type={field === 'receiptPhone' ? 'tel' : 'text'} onChange={event => change(field, event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>)}
          <div><label htmlFor="print-receipt-address" className="block text-sm font-semibold">Restaurant address</label><textarea id="print-receipt-address" value={form.receiptAddress} maxLength={500} rows={3} onChange={event => change('receiptAddress', event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></div>
          <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><input className="mt-1" type="checkbox" checked={form.checkoutReceiptAndKot} onChange={event => change('checkoutReceiptAndKot', event.target.checked)} /><span><strong className="block">Print customer bill + KOT together at checkout</strong><span className="block mt-1 text-slate-600">Prints the customer receipt, then a separate kitchen ticket on the same receipt printer. Already-sent kitchen items are excluded. Manual receipt reprints print the customer copy only.</span></span></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error} Your changes are kept for review.</p>}
        <div className="flex flex-wrap gap-3"><button disabled={busy} type="submit" className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save print settings'}</button><button type="button" disabled={busy} className="text-sm underline" onClick={async () => { dirty.current = false; request.current = null; await settings.fetchSettings(); setForm(fromSettings(useSettingsStore.getState())); revision.current = useSettingsStore.getState().serverRevision; setError(''); }}>Reload saved settings</button></div>
      </form>
      <div className="space-y-4 min-w-0">
        <div><h2 className="font-bold">6 standard layouts</h2><p className="text-xs text-slate-500">Includes the 3 labels: cup/item, delivery bag and kitchen KOT. Samples use demonstration order details.</p></div>
        <div className="grid grid-cols-2 gap-2">{PRINT_LAYOUTS.map(layout => <button type="button" key={layout.id} aria-pressed={kind === layout.id} onClick={() => setKind(layout.id)} className={`rounded-xl border p-2.5 text-left text-sm ${kind === layout.id ? 'border-slate-800 bg-slate-100 font-bold' : 'border-slate-200'}`}>{layout.name}</button>)}</div>
        <div className="flex items-center justify-between gap-3"><label className="text-sm">Preview width<select aria-label="Print preview paper width" value={width} onChange={event => setWidth(Number(event.target.value) as 58 | 80)} className="ml-2 rounded-lg border p-1"><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label><button type="button" className="text-sm font-bold underline" onClick={() => { if (preview.current) void printLayoutSample(preview.current, width).catch(error => toast.error(error.message)); }}>Print sample</button></div>
        <div className="rounded-xl bg-slate-100 p-4 overflow-auto"><div ref={preview} style={{ width: width === 58 ? 240 : 310, maxWidth: '100%', margin: '0 auto', boxShadow: '0 8px 30px #0001' }}><PrintLayoutPreview kind={kind} branding={branding} /></div></div>
        <p className="text-xs text-slate-500">Bill, pre-bill, KOT and dispatch layouts print automatically. For actual cup/item and bag labels, open a confirmed bill → Packaging labels and select suitable label media in the print dialog.</p>
      </div>
    </div>
  </section>;
}
