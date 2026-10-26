import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { getServerUrl } from '../services/serverConfig';
import { createId } from '../services/createId';
import { PrintDestination, usePrintQueue } from '../services/printQueue';
import { getPrinterProfile, savePrinterProfile } from '../services/printerProfile';
import { toast } from '../store/useToastStore';
import { PrintQueuePanel } from './PrintQueuePanel';
import { useAuthStore } from '../store/useAuthStore';

const DestinationEditor: React.FC<{ role: 'RECEIPT' | 'KITCHEN'; existing?: PrintDestination }> = ({ role, existing }) => {
  const { data, refresh } = usePrintQueue();
  const [draft, setDraft] = useState<PrintDestination>(() => existing || { role, name: role === 'RECEIPT' ? 'Counter receipt printer' : 'Kitchen printer', agentId: '', transport: 'TCP', address: '', port: 9100, paperWidth: 80, autoPrint: false, revision: 0 });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const testRequest = React.useRef<string | null>(null);
  React.useEffect(() => { if (existing && !dirty) setDraft(existing); }, [existing, dirty]);
  const change = (patch: Partial<PrintDestination>) => { setDirty(true); setDraft(previous => ({ ...previous, ...patch })); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try { const saved = await apiClient.put('/printer/queue/destination', draft); setDraft(saved); setDirty(false); await refresh(); toast.success('Printer assignment saved. Existing jobs keep their original destination.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save printer'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={save} className="rounded-xl bg-white border p-4 space-y-3">
    <h3 className="font-bold">{role === 'RECEIPT' ? 'Receipt printer' : 'Kitchen printer'}</h3>
    {dirty && existing && existing.revision !== draft.revision && <p role="alert" className="text-sm text-red-700">This assignment changed on another device. Your draft is preserved. <button type="button" className="underline" onClick={() => { setDraft(existing); setDirty(false); }}>Load latest assignment</button></p>}
    <label className="block text-sm">Printing computer<select required disabled={busy} className="block border rounded-lg p-2 w-full mt-1" value={draft.agentId} onChange={event => change({ agentId: event.target.value })}><option value="">Choose paired computer</option>{data?.agents.filter(agent => !agent.revokedAt && !agent.pairingExpiresAt).map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
    <label className="block text-sm">Printer name<input required maxLength={80} disabled={busy} className="block border rounded-lg p-2 w-full mt-1" value={draft.name} onChange={event => change({ name: event.target.value })} /></label>
    <label className="block text-sm">Connection<select disabled={busy} className="block border rounded-lg p-2 w-full mt-1" value={draft.transport} onChange={event => change({ transport: event.target.value as PrintDestination['transport'], address: '' })}><option value="TCP">Network printer (LAN)</option><option value="WINDOWS">Installed Windows printer (USB or LAN)</option></select></label>
    <label className="block text-sm">{draft.transport === 'TCP' ? 'Printer’s local IP address' : 'Exact Windows printer queue name'}<input required maxLength={200} disabled={busy} className="block border rounded-lg p-2 w-full mt-1" placeholder={draft.transport === 'TCP' ? '192.168.1.50' : 'EPSON TM-T82 Receipt'} value={draft.address} onChange={event => change({ address: event.target.value })} /></label>
    <div className="flex gap-3">{draft.transport === 'TCP' && <label className="text-sm flex-1">Port<input type="number" min={1} max={65535} required disabled={busy} className="block border rounded-lg p-2 w-full mt-1" value={draft.port} onChange={event => change({ port: Number(event.target.value) })} /></label>}<label className="text-sm flex-1">Paper width<select disabled={busy} className="block border rounded-lg p-2 w-full mt-1" value={draft.paperWidth} onChange={event => change({ paperWidth: Number(event.target.value) })}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label></div>
    <label className="flex gap-2 text-sm items-start"><input type="checkbox" disabled={busy} checked={draft.autoPrint} onChange={event => change({ autoPrint: event.target.checked })} />Automatically print newly saved {role === 'RECEIPT' ? 'payments and delivery dispatch notes' : 'kitchen items'} for this restaurant</label>
    <p className="text-xs text-slate-500">Save with automatic printing off, test the paper, then enable it. Enabling does not print older orders.</p>
    <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save assignment'}</button><button type="button" disabled={busy || !existing} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={() => {
      if (busy) return; setBusy(true); testRequest.current ||= createId();
      void apiClient.post('/printer/queue/test', { role, requestId: testRequest.current }).then(async () => { testRequest.current = null; toast.info('Test queued using the saved assignment. Check the paper.'); await refresh(); }).catch(error => toast.error(error.message)).finally(() => setBusy(false));
    }}>Test saved printer</button></div>
  </form>;
};

export const CloudPrintSettings: React.FC = () => {
  const { data, refresh } = usePrintQueue();
  const role = useAuthStore(state => state.currentUser?.role);
  const admin = ['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(role || '');
  const [name, setName] = useState('Counter computer');
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [browser, setBrowser] = useState(() => getPrinterProfile());
  return <div className="space-y-6 text-slate-800">
    <header><h1 className="text-2xl font-black">Printing</h1><p className="text-sm text-slate-600 mt-2">Your POS stays in the browser. One paired restaurant computer sends jobs to the local printers.</p></header>
    {admin && <>
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <h2 className="font-bold">1. Connect the restaurant computer</h2>
        <ol className="list-decimal ml-5 text-sm space-y-2"><li>Install Node.js 22.12 or newer on the Windows printing computer.</li><li><a download href="/karvaan-print-agent.zip" className="text-indigo-700 underline">Download the local printing service</a>, extract it, and open <strong>SETUP.txt</strong>.</li><li>Create a pairing code below. Run the included installer on that computer and enter the server URL and code.</li></ol>
        <p className="text-sm">Server URL: <code className="break-all">{getServerUrl()}</code></p>
        <div className="flex flex-wrap gap-2"><input aria-label="Printing computer name" className="border rounded-lg p-2 flex-1" maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} /><button disabled={busy || !name.trim()} className="rounded-lg bg-indigo-700 text-white px-4 py-2 disabled:opacity-40" onClick={() => {
          if (busy) return; setBusy(true);
          void apiClient.post('/printer/queue/pairing', { name }).then(async result => { setPairing(result); await refresh(); }).catch(error => toast.error(error.message)).finally(() => setBusy(false));
        }}>{busy ? 'Saving…' : 'Create pairing code'}</button></div>
        {pairing && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3"><p className="font-mono font-bold break-all select-all">{pairing.code}</p><p className="text-xs mt-1">Single use. Expires {new Date(pairing.expiresAt).toLocaleTimeString()}. Share only with the person setting up this computer.</p></div>}
        <p className="text-xs text-slate-500">Keep the printing computer on and the installing Windows user signed in. Locking the screen is fine. The service starts at sign-in and connects outward to the VPS.</p>
        <div className="space-y-2">{data?.agents.map(agent => <div key={agent.id} className="flex flex-wrap gap-2 items-center justify-between border-t pt-2 text-sm"><span><strong>{agent.name}</strong> · {agent.revokedAt ? 'Revoked' : agent.pairingExpiresAt ? new Date(agent.pairingExpiresAt) < new Date() ? 'Pairing expired' : 'Waiting for pairing' : agent.lastSeenAt && Date.now() - new Date(agent.lastSeenAt).getTime() < 45000 ? 'Connected' : 'Not connected'}</span>{!agent.revokedAt && <button disabled={busy} className="text-red-700" onClick={() => setRevokeId(agent.id)}>Revoke access</button>}</div>)}</div>
        {revokeId && <div className="rounded-lg bg-red-50 p-3 space-y-2"><p className="text-sm">Revoking cancels this computer’s waiting jobs and disables its automatic printing. Jobs already being sent need paper review.</p><button disabled={busy} className="font-bold text-red-700 mr-4" onClick={() => { setBusy(true); void apiClient.post(`/printer/queue/agents/${revokeId}/revoke`, {}).then(async () => { setRevokeId(null); await refresh(); }).catch(error => toast.error(error.message)).finally(() => setBusy(false)); }}>Revoke this computer</button><button disabled={busy} onClick={() => setRevokeId(null)}>Back</button></div>}
      </section>
      <section className="space-y-3"><h2 className="font-bold">2. Assign and test printers</h2><div className="grid md:grid-cols-2 gap-4">{(['RECEIPT', 'KITCHEN'] as const).map(destinationRole => {
        const existing = data?.destinations.find(destination => destination.role === destinationRole);
        return <DestinationEditor key={destinationRole} role={destinationRole} existing={existing} />;
      })}</div><p className="text-xs text-slate-500">Thermal output uses ESC/POS. Check printer compatibility and character support. Use browser/driver printing if the printer cannot render your menu’s script correctly.</p></section>
    </>}
    <section className="rounded-2xl border bg-white p-5 space-y-3"><h2 className="font-bold">Browser fallback on this terminal</h2><p className="text-sm text-slate-600">Opens the device’s normal print dialog. Choose the receipt or kitchen printer in that dialog.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={!!browser.browserKitchenPrint} onChange={event => { const profile = { ...browser, browserKitchenPrint: event.target.checked }; savePrinterProfile(profile); setBrowser(profile); }} />Open a kitchen paper preview after sending when automatic kitchen printing is off</label><label className="block text-sm">Browser receipt width<select className="border rounded-lg p-2 ml-3" value={browser.browserPaperWidth || 80} onChange={event => { const profile = { ...browser, browserPaperWidth: Number(event.target.value) as 58 | 80 }; savePrinterProfile(profile); setBrowser(profile); }}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label></section>
    <section className="rounded-2xl border bg-slate-50 p-5"><PrintQueuePanel /></section>
  </div>;
};
