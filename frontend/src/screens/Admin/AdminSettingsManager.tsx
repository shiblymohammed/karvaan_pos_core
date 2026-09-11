import React, { useState, useRef, useEffect } from 'react';
import { Settings2, Plus, Trash2, Tag, Percent, MessageSquare, PackagePlus, Wifi, Server, ExternalLink, MonitorSpeaker, UploadCloud, Check, Play, LayoutDashboard, LayoutTemplate, Monitor, Smartphone, Trash, Save } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAddonStore } from '../../store/useAddonStore';
import { getServerUrl, setServerUrl, probeServer } from '../../services/serverConfig';

export const AdminSettingsManager: React.FC<{ type: 'quick' | 'system' }> = ({ type }) => {
  const store = useSettingsStore();
  const { addons, addAddon, deleteAddon } = useAddonStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- QUICK KEYS STATE ---
  const [newNote, setNewNote] = useState({ label: '', icon: '' });
  const [newDiscount, setNewDiscount] = useState({ label: '', amount: '', type: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT' });
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });

  // --- NETWORK STATE ---
  const [networkUrl, setNetworkUrl] = useState(getServerUrl());
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'probing' | 'ok' | 'fail'>('idle');
  const [networkLatency, setNetworkLatency] = useState(0);

  // --- LOCAL SYSTEM STATE ---
  const [localOrderPrefix, setLocalOrderPrefix] = useState(store.orderPrefix);
  const [localTvPopup, setLocalTvPopup] = useState(store.orderTvShowPopup);
  const [localTvAudio, setLocalTvAudio] = useState(store.orderTvPlayAudio);
  const [localTvAudioTone, setLocalTvAudioTone] = useState(store.orderTvAudioTone);
  const [localTvTtsEnabled, setLocalTvTtsEnabled] = useState(store.orderTvTtsEnabled);
  const [localTvTtsVoiceName, setLocalTvTtsVoiceName] = useState(store.orderTvTtsVoiceName);
  const [localTvConfetti, setLocalTvConfetti] = useState(store.orderTvConfettiEnabled);
  const [localTvWaterFill, setLocalTvWaterFill] = useState(store.orderTvWaterFillEnabled);
  const [localTvWaterColor, setLocalTvWaterColor] = useState(store.orderTvWaterColor);
  const [localTvReadyBadge, setLocalTvReadyBadge] = useState(store.orderTvReadyBadgeEnabled);
  const [localTvTimeWaiting, setLocalTvTimeWaiting] = useState(store.orderTvTimeWaitingEnabled);
  const [localTvChaos, setLocalTvChaos] = useState(store.orderTvChaosAnimationEnabled);

  const [localTvLayoutMode, setLocalTvLayoutMode] = useState(store.orderTvLayoutMode);
  const [localTvOrientation, setLocalTvOrientation] = useState(store.orderTvOrientation);
  const [localTvTickerEnabled, setLocalTvTickerEnabled] = useState(store.orderTvTickerEnabled);
  const [localTvTickerMessage, setLocalTvTickerMessage] = useState(store.orderTvTickerMessage);

  const [localTvPromoInterval, setLocalTvPromoInterval] = useState(store.orderTvPromoInterval);
  const [localTvPromoText, setLocalTvPromoText] = useState(store.orderTvPromoText);
  const [localTvPromoQrUrl, setLocalTvPromoQrUrl] = useState(store.orderTvPromoQrUrl);
  const [localTvPromoBgColor, setLocalTvPromoBgColor] = useState(store.orderTvPromoBgColor);

  const [applyState, setApplyState] = useState<'idle' | 'general' | 'layout' | 'promo'>('idle');

  // Keep media array fully synced automatically since upload affects server anyway
  const localTvPromoMedia = store.orderTvPromoMedia;

  // Sync state on mount or when store changes remotely
  useEffect(() => {
    setLocalOrderPrefix(store.orderPrefix);
    setLocalTvPopup(store.orderTvShowPopup);
    setLocalTvAudio(store.orderTvPlayAudio);
    setLocalTvAudioTone(store.orderTvAudioTone);
    setLocalTvTtsEnabled(store.orderTvTtsEnabled);
    setLocalTvTtsVoiceName(store.orderTvTtsVoiceName);
    setLocalTvConfetti(store.orderTvConfettiEnabled);
    setLocalTvWaterFill(store.orderTvWaterFillEnabled);
    setLocalTvWaterColor(store.orderTvWaterColor);
    setLocalTvReadyBadge(store.orderTvReadyBadgeEnabled);
    setLocalTvTimeWaiting(store.orderTvTimeWaitingEnabled);
    setLocalTvChaos(store.orderTvChaosAnimationEnabled);
    setLocalTvLayoutMode(store.orderTvLayoutMode);
    setLocalTvOrientation(store.orderTvOrientation);
    setLocalTvTickerEnabled(store.orderTvTickerEnabled);
    setLocalTvTickerMessage(store.orderTvTickerMessage);
    setLocalTvPromoInterval(store.orderTvPromoInterval);
    setLocalTvPromoText(store.orderTvPromoText);
    setLocalTvPromoQrUrl(store.orderTvPromoQrUrl);
    setLocalTvPromoBgColor(store.orderTvPromoBgColor);
  }, []); // Run on mount

  // --- ACTIONS ---
  const handleNetworkTest = async () => {
    setNetworkStatus('probing');
    const result = await probeServer(networkUrl);
    setNetworkLatency(result.latencyMs);
    setNetworkStatus(result.ok ? 'ok' : 'fail');
  };
  const handleNetworkSave = () => {
    setServerUrl(networkUrl);
    setNetworkStatus('idle');
    alert('Server URL saved. Reload the page to reconnect the WebSocket.');
  };

  const handleAddNote = () => {
    if (!newNote.label) return;
    store.addNote(newNote);
    setNewNote({ label: '', icon: '' });
  };
  const handleAddDiscount = () => {
    if (!newDiscount.label || !newDiscount.amount) return;
    store.addDiscount({
      label: newDiscount.label, amount: Number(newDiscount.amount), type: newDiscount.type
    });
    setNewDiscount({ label: '', amount: '', type: 'PERCENTAGE' });
  };
  const handleAddAddon = () => {
    if (!newAddon.name || !newAddon.price) return;
    addAddon({ name: newAddon.name, price: Number(newAddon.price), isActive: true });
    setNewAddon({ name: '', price: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`http://${window.location.hostname}:3001/upload`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        store.addOrderTvPromoMedia({
          id: `media-${Date.now()}-${i}`,
          type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
          url: `http://${window.location.hostname}:3001${data.url}`
        });
      }
    } catch (error: any) {
      alert('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      store.setOrderTvAudio(localTvAudio, 'custom', event.target?.result as string);
      setLocalTvAudioTone('custom');
    };
    reader.readAsDataURL(file);
  };
  const playTestAudio = () => {
    import('../../utils/audioHelper').then(({ playAudioTone }) => {
      playAudioTone(localTvAudioTone, store.orderTvCustomAudioData);
    });
  };

  // --- APPLY BUTTONS ---
  const applyGeneralSettings = () => {
    setApplyState('general');
    store.setOrderPrefix(localOrderPrefix);
    if (localTvPopup !== store.orderTvShowPopup) store.toggleOrderTvPopup();
    store.setOrderTvAudio(localTvAudio, localTvAudioTone, store.orderTvCustomAudioData);
    store.setOrderTvTts(localTvTtsEnabled, localTvTtsVoiceName);
    store.setOrderTvConfetti(localTvConfetti);
    store.setOrderTvWaterFill(localTvWaterFill);
    store.setOrderTvWaterColor(localTvWaterColor);
    store.setOrderTvReadyBadge(localTvReadyBadge);
    store.setOrderTvTimeWaiting(localTvTimeWaiting);
    store.setOrderTvChaosAnimation(localTvChaos);
    setTimeout(() => setApplyState('idle'), 1500);
  };

  const applyLayoutSettings = () => {
    setApplyState('layout');
    store.setOrderTvLayoutMode(localTvLayoutMode);
    store.setOrderTvOrientation(localTvOrientation);
    store.setOrderTvTicker(localTvTickerEnabled, localTvTickerMessage);
    setTimeout(() => setApplyState('idle'), 1500);
  };

  const applyPromoSettings = () => {
    setApplyState('promo');
    store.setOrderTvPromoInterval(localTvPromoInterval);
    store.setOrderTvPromoText(localTvPromoText);
    store.setOrderTvPromoQrUrl(localTvPromoQrUrl);
    store.setOrderTvPromoBgColor(localTvPromoBgColor);
    setTimeout(() => setApplyState('idle'), 1500);
  };

  // --- REUSABLE COMPONENTS ---
  const ToggleRow = ({ label, desc, active, onToggle, children }: any) => (
    <div className={`relative overflow-hidden backdrop-blur-xl border rounded-[1rem] transition-all duration-300 ${active ? 'bg-pos-bg/80 border-emerald-500/30' : 'bg-pos-bg/40 border-pos-border'}`}>
      <div className="flex items-center justify-between p-4 relative z-10">
        <div className="flex flex-col">
          <h4 className="font-black text-sm text-pos-text flex items-center gap-2">
            {label}
            {active && <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] uppercase font-black tracking-wider">Active</span>}
          </h4>
          <p className="text-xs font-bold text-pos-text-muted mt-1">{desc}</p>
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner shrink-0 ${active ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 border-0' : 'bg-pos-input border border-pos-border'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {active && children && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">{children}</div>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 bg-pos-bg">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-pos-text tracking-tight">
          {type === 'quick' ? 'POS Quick-Keys' : 'System Configuration'}
        </h2>
        <p className="text-sm font-bold text-pos-text-muted mt-1.5">
          {type === 'quick' ? 'Configure quick notes, predefined discounts, and add-ons.' : 'Configure network connections and customer-facing Order TV displays.'}
        </p>
      </div>

      {type === 'quick' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QUICK NOTES */}
          <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl"><MessageSquare className="h-5 w-5 text-emerald-500" /></div>
              <h3 className="text-lg font-black text-pos-text">Predefined Order Notes</h3>
            </div>
            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Icon" value={newNote.icon} onChange={e => setNewNote({ ...newNote, icon: e.target.value })} className="w-16 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text text-center focus:outline-none focus:border-emerald-500" />
              <input type="text" placeholder="Label" value={newNote.label} onChange={e => setNewNote({ ...newNote, label: e.target.value })} className="flex-1 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500" />
              <button onClick={handleAddNote} className="px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-wrap gap-2 flex-1 overflow-y-auto max-h-[300px]">
              {store.notes.map(n => (
                <div key={n.id} className="flex items-center gap-2 bg-pos-bg border border-pos-border rounded-lg px-3 py-2">
                  <span className="text-sm">{n.icon}</span><span className="text-sm font-bold text-pos-text">{n.label}</span>
                  <button onClick={() => store.deleteNote(n.id)} className="ml-2 text-pos-text-muted hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* PREDEFINED DISCOUNTS */}
          <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl"><Percent className="h-5 w-5 text-emerald-500" /></div>
              <h3 className="text-lg font-black text-pos-text">Predefined Discounts</h3>
            </div>
            <div className="flex gap-2 mb-6">
              <select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value as any })} className="w-24 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text text-xs font-bold focus:outline-none focus:border-emerald-500">
                <option value="PERCENTAGE">% Off</option><option value="FLAT">Flat ₹</option>
              </select>
              <input type="number" placeholder="Amt" value={newDiscount.amount} onChange={e => setNewDiscount({ ...newDiscount, amount: e.target.value })} className="w-20 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500" />
              <input type="text" placeholder="Label" value={newDiscount.label} onChange={e => setNewDiscount({ ...newDiscount, label: e.target.value })} className="flex-1 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500" />
              <button onClick={handleAddDiscount} className="px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[300px]">
              {store.discounts.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-pos-bg border border-pos-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">{d.type === 'PERCENTAGE' ? '%' : '₹'}</div>
                    <div><h4 className="font-bold text-sm text-pos-text">{d.label}</h4><p className="text-xs font-bold text-pos-text-muted">{d.type === 'PERCENTAGE' ? `${d.amount}%` : `₹${d.amount}`} Off</p></div>
                  </div>
                  <button onClick={() => store.deleteDiscount(d.id)} className="text-pos-text-muted hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* PAID ADD-ONS */}
          <div className="bg-pos-card border border-pos-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl"><PackagePlus className="h-5 w-5 text-emerald-500" /></div>
              <h3 className="text-lg font-black text-pos-text">Paid Add-ons</h3>
            </div>
            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Name" value={newAddon.name} onChange={e => setNewAddon({ ...newAddon, name: e.target.value })} className="flex-1 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500" />
              <input type="number" placeholder="₹ Price" value={newAddon.price} onChange={e => setNewAddon({ ...newAddon, price: e.target.value })} className="w-24 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-emerald-500" />
              <button onClick={handleAddAddon} className="px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[300px]">
              {addons.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-pos-bg border border-pos-border rounded-lg px-4 py-3">
                  <div><h4 className="font-bold text-sm text-pos-text">{a.name}</h4><p className="text-xs font-bold text-emerald-600">+₹{a.price}</p></div>
                  <button onClick={() => deleteAddon(a.id)} className="text-pos-text-muted hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* COLUMN 1: NETWORK & GENERAL BEHAVIORS */}
          <div className="flex flex-col gap-6">
            <div className="bg-pos-card rounded-2xl border border-pos-border p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-blue-500/10 rounded-xl"><Wifi className="h-5 w-5 text-blue-500" /></div>
                <h3 className="text-lg font-black text-pos-text">Network Setup</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
                    <input type="url" value={networkUrl} onChange={e => { setNetworkUrl(e.target.value); setNetworkStatus('idle'); }} placeholder="http://192.168.1.100:3001" className="w-full pl-9 pr-3 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-blue-500" />
                  </div>
                  <button onClick={handleNetworkTest} className="px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors">Test</button>
                </div>
                {networkStatus === 'ok' && <p className="text-xs font-bold text-emerald-600">✓ Connected ({networkLatency}ms)</p>}
                {networkStatus === 'fail' && <p className="text-xs font-bold text-rose-500">✗ Cannot reach server</p>}
                <div className="pt-4 border-t border-pos-border flex justify-end">
                  <button onClick={handleNetworkSave} disabled={networkStatus !== 'ok' && !networkUrl.includes('localhost')} className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40">
                    <Save className="w-4 h-4" /> Save Network
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-pos-card rounded-2xl border border-pos-border p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl"><Settings2 className="h-5 w-5 text-indigo-500" /></div>
                <h3 className="text-lg font-black text-pos-text">General Behaviors</h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex flex-col gap-2 p-4 bg-pos-bg/40 border border-pos-border rounded-[1rem]">
                  <label className="font-black text-sm text-pos-text">Order Number Prefix</label>
                  <p className="text-xs font-bold text-pos-text-muted">Will be prepended to new orders (e.g. KOT-1234).</p>
                  <input type="text" value={localOrderPrefix} onChange={e => setLocalOrderPrefix(e.target.value.toUpperCase())} placeholder="KOT" className="w-32 bg-pos-input border border-pos-border rounded-xl p-3 text-pos-text focus:outline-none focus:border-indigo-500 font-bold" />
                </div>
                
                <ToggleRow label="Now Serving Popup" desc="Massive alert when ready" active={localTvPopup} onToggle={() => setLocalTvPopup(!localTvPopup)} />
                <ToggleRow label="Audio Chime" desc="Play a sound over speakers" active={localTvAudio} onToggle={() => setLocalTvAudio(!localTvAudio)}>
                  <div className="flex flex-col gap-3">
                    <select value={localTvAudioTone} onChange={e => setLocalTvAudioTone(e.target.value)} className="w-full bg-pos-input border border-pos-border rounded-lg p-2 text-sm font-bold text-pos-text focus:outline-none focus:border-emerald-500">
                      <option value="bell">Classic Bell</option><option value="chime">Soft Chime</option><option value="digital">Digital Beep</option><option value="custom">Custom File</option>
                    </select>
                    {localTvAudioTone === 'custom' && (
                      <input type="file" accept="audio/*" onChange={handleAudioUpload} className="text-xs text-pos-text-muted" />
                    )}
                    <button onClick={playTestAudio} className="w-full py-2 bg-pos-input border border-pos-border rounded-lg text-sm font-bold text-pos-text hover:bg-white/10 flex justify-center items-center gap-2"><Play className="w-4 h-4 text-emerald-500" /> Test Sound</button>
                  </div>
                </ToggleRow>
                <ToggleRow label="Voice Announcements" desc="TTS for ready orders" active={localTvTtsEnabled} onToggle={() => setLocalTvTtsEnabled(!localTvTtsEnabled)}>
                  <select value={localTvTtsVoiceName} onChange={e => setLocalTvTtsVoiceName(e.target.value)} className="w-full bg-pos-input border border-pos-border rounded-lg p-2 text-sm font-bold text-pos-text focus:outline-none focus:border-emerald-500">
                    <option value="">Default System Voice</option>
                    {typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </ToggleRow>
                <ToggleRow label="Confetti Celebration" desc="Burst confetti when ready" active={localTvConfetti} onToggle={() => setLocalTvConfetti(!localTvConfetti)} />
                <ToggleRow label="Water Fill Animation" desc="Show liquid fill on prep tickets" active={localTvWaterFill} onToggle={() => setLocalTvWaterFill(!localTvWaterFill)}>
                  <div className="flex items-center gap-3">
                    <input type="color" value={localTvWaterColor || '#fbbf24'} onChange={e => setLocalTvWaterColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                    <span className="text-xs font-bold text-pos-text-muted">Liquid Color</span>
                  </div>
                </ToggleRow>
                <ToggleRow label="Ready Badge" desc="Stamped badge for ready orders" active={localTvReadyBadge} onToggle={() => setLocalTvReadyBadge(!localTvReadyBadge)} />
                <ToggleRow label="Time Waiting" desc="Show wait times on tickets" active={localTvTimeWaiting} onToggle={() => setLocalTvTimeWaiting(!localTvTimeWaiting)} />
                <ToggleRow label="Chaos Animation" desc="Jump and shake on TV" active={localTvChaos} onToggle={() => setLocalTvChaos(!localTvChaos)} />
              </div>
              
              <div className="pt-4 border-t border-pos-border flex justify-end">
                <button onClick={applyGeneralSettings} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors w-40">
                  {applyState === 'general' ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Apply General</>}
                </button>
              </div>
            </div>
          </div>

          {/* COLUMN 2: TV LAYOUT */}
          <div className="flex flex-col gap-6">
            <div className="bg-pos-card rounded-2xl border border-pos-border p-6 shadow-sm flex flex-col h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl"><LayoutTemplate className="h-5 w-5 text-emerald-500" /></div>
                <h3 className="text-lg font-black text-pos-text">Order TV Layout</h3>
              </div>
              
              <div className="space-y-6 mb-6 flex-1">
                <div>
                  <h4 className="text-xs font-black text-pos-text-muted uppercase tracking-widest mb-3">Layout Mode</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setLocalTvLayoutMode('FULL_QUEUE')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${localTvLayoutMode === 'FULL_QUEUE' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-pos-border bg-pos-input text-pos-text'}`}>
                      <LayoutDashboard className="w-6 h-6 mb-2" /><span className="text-xs font-bold">Full Queue</span>
                    </button>
                    <button onClick={() => setLocalTvLayoutMode('SPLIT_PROMO')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${localTvLayoutMode === 'SPLIT_PROMO' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-pos-border bg-pos-input text-pos-text'}`}>
                      <LayoutTemplate className="w-6 h-6 mb-2" /><span className="text-xs font-bold">Split Promo</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-pos-text-muted uppercase tracking-widest mb-3">TV Orientation</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setLocalTvOrientation('HORIZONTAL')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${localTvOrientation === 'HORIZONTAL' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-pos-border bg-pos-input text-pos-text'}`}>
                      <Monitor className="w-6 h-6 mb-2" /><span className="text-xs font-bold">Landscape</span>
                    </button>
                    <button onClick={() => setLocalTvOrientation('VERTICAL')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${localTvOrientation === 'VERTICAL' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-pos-border bg-pos-input text-pos-text'}`}>
                      <Smartphone className="w-6 h-6 mb-2" /><span className="text-xs font-bold">Portrait</span>
                    </button>
                  </div>
                </div>

                <ToggleRow label="Promotional Ticker" desc="Scrolling bottom bar" active={localTvTickerEnabled} onToggle={() => setLocalTvTickerEnabled(!localTvTickerEnabled)}>
                  <input type="text" value={localTvTickerMessage} onChange={e => setLocalTvTickerMessage(e.target.value)} placeholder="Ticker Message..." className="w-full bg-pos-input border border-pos-border rounded-lg p-3 text-sm font-bold text-pos-text focus:border-emerald-500 focus:outline-none" />
                </ToggleRow>
              </div>

              <div className="pt-4 border-t border-pos-border flex justify-end mt-auto">
                <button onClick={applyLayoutSettings} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-colors w-40">
                  {applyState === 'layout' ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Apply Layout</>}
                </button>
              </div>
            </div>
          </div>

          {/* COLUMN 3: PROMO MEDIA */}
          <div className="flex flex-col gap-6">
            <div className="bg-pos-card rounded-2xl border border-pos-border p-6 shadow-sm flex flex-col h-full">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-rose-500/10 rounded-xl"><MonitorSpeaker className="h-5 w-5 text-rose-500" /></div>
                <h3 className="text-lg font-black text-pos-text">Promo Media Overlays</h3>
              </div>
              
              <div className="space-y-6 mb-6 flex-1">
                <div>
                  <h4 className="text-xs font-black text-pos-text-muted uppercase tracking-widest mb-3">Customizations</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-pos-text-muted uppercase mb-1 block">Overlay Message</label>
                      <input type="text" value={localTvPromoText} onChange={e => setLocalTvPromoText(e.target.value)} placeholder="e.g. Happy Hour Starts at 5 PM!" className="w-full bg-pos-input border border-pos-border rounded-xl p-3 text-sm font-bold text-pos-text focus:border-rose-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-pos-text-muted uppercase mb-1 block">QR Code URL</label>
                      <input type="url" value={localTvPromoQrUrl} onChange={e => setLocalTvPromoQrUrl(e.target.value)} placeholder="https://karvaan.app/menu" className="w-full bg-pos-input border border-pos-border rounded-xl p-3 text-sm font-bold text-pos-text focus:border-rose-500 focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="color" value={localTvPromoBgColor || '#000000'} onChange={e => setLocalTvPromoBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                      <span className="text-xs font-bold text-pos-text-muted">Background Fallback</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black text-pos-text-muted uppercase tracking-widest">Media Playlist</h4>
                    <span className="text-[10px] font-bold text-pos-text-muted">{localTvPromoInterval}s Delay</span>
                  </div>
                  <input type="range" min="2" max="30" value={localTvPromoInterval} onChange={e => setLocalTvPromoInterval(parseInt(e.target.value))} className="w-full mb-4 accent-rose-500" />
                  
                  <div className="flex items-center gap-2 mb-4">
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full flex items-center justify-center gap-2 bg-pos-input border border-pos-border hover:bg-white/5 py-2.5 rounded-xl font-bold text-sm text-pos-text transition-colors">
                      {isUploading ? '⏳ Uploading...' : <><UploadCloud className="w-4 h-4" /> Upload Files</>}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[200px]">
                    {localTvPromoMedia.map((media) => (
                      <div key={media.id} className="relative group aspect-video bg-pos-input rounded-xl border border-pos-border overflow-hidden">
                        {media.type === 'IMAGE' ? <img src={media.url} alt="Promo" className="w-full h-full object-cover" /> : <video src={media.url} className="w-full h-full object-cover" muted />}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => store.removeOrderTvPromoMedia(media.id)} className="p-2 bg-rose-500 text-white rounded-full"><Trash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-pos-border flex justify-end mt-auto">
                <button onClick={applyPromoSettings} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-colors w-40">
                  {applyState === 'promo' ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Apply Promo</>}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
