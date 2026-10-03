import React, { useState, useRef, useEffect } from 'react';
import { 
  Wifi, 
  Server, 
  MonitorSpeaker, 
  UploadCloud, 
  Play, 
  LayoutDashboard, 
  LayoutTemplate, 
  Monitor, 
  Smartphone, 
  Trash, 
  RefreshCw, 
  MessageSquare, 
  Percent, 
  PackagePlus, 
  Settings2,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAddonStore } from '../../store/useAddonStore';
import { getServerUrl, setServerUrl, probeServer } from '../../services/serverConfig';
import { motion, AnimatePresence } from 'framer-motion';

// --- REUSABLE COMPONENTS ---
const SettingsHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="mb-8 border-b border-slate-200 pb-6">
    <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">{title}</h1>
    <p className="text-[14px] text-slate-500 mt-1">{description}</p>
  </div>
);

const SettingsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border border-slate-200 rounded-[8px] overflow-hidden bg-white mb-8 shadow-sm">
    {children}
  </div>
);

const SettingsRow: React.FC<{ label: string; description?: string; control: React.ReactNode; border?: boolean }> = ({ label, description, control, border = true }) => (
  <div className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 ${border ? 'border-b border-slate-200 last:border-b-0' : ''}`}>
    <div className="flex-1 pr-4">
      <h3 className="text-[14px] font-medium text-slate-900">{label}</h3>
      {description && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{description}</p>}
    </div>
    <div className="shrink-0 flex flex-col sm:items-end justify-center min-w-[200px]">
      {control}
    </div>
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input ref={ref} {...props} className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-[6px] text-slate-900 text-[14px] focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-sm transition-all ${props.className || ''}`} />
));

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => (
  <select ref={ref} {...props} className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-[6px] text-slate-900 text-[14px] focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 shadow-sm transition-all ${props.className || ''}`}>
    {props.children}
  </select>
));

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "inline-flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm focus:ring-slate-900",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm focus:ring-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm focus:ring-rose-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const Switch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors duration-200 ease-in-out ${checked ? 'bg-slate-900' : 'bg-slate-200'}`}
  >
    <span aria-hidden="true" className={`pointer-events-none absolute left-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

export const AdminSettingsManager: React.FC = () => {
  const store = useSettingsStore();
  const { addons, addAddon, deleteAddon } = useAddonStore();
  
  const [activeTab, setActiveTab] = useState('general-network');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- STATE ---
  const [networkUrl, setNetworkUrl] = useState(getServerUrl());
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'probing' | 'ok' | 'fail'>('idle');
  const [networkLatency, setNetworkLatency] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

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
  const localTvPromoMedia = store.orderTvPromoMedia;

  const [newNote, setNewNote] = useState({ label: '', icon: '' });
  const [newDiscount, setNewDiscount] = useState({ label: '', amount: '', type: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT' });
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });

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
  }, []);

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

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setSyncMessage('Syncing with Cloud...');
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/sync/trigger`, { method: 'POST' });
      const data = await response.json();
      if (data.status === 'success') {
        setSyncMessage('Sync Successful');
      } else if (data.status === 'already_running') {
        setSyncMessage('Sync already in progress');
      } else {
        setSyncMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setSyncMessage(`Connection failed`);
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const applyGeneralSettings = () => {
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
    store.setOrderTvLayoutMode(localTvLayoutMode);
    store.setOrderTvOrientation(localTvOrientation);
    store.setOrderTvTicker(localTvTickerEnabled, localTvTickerMessage);
    store.setOrderTvPromoInterval(localTvPromoInterval);
    store.setOrderTvPromoText(localTvPromoText);
    store.setOrderTvPromoQrUrl(localTvPromoQrUrl);
    store.setOrderTvPromoBgColor(localTvPromoBgColor);
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

  // --- RENDER SECTIONS ---
  const renderNetworkSync = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Network & Sync" description="Configure server connections and cloud synchronization." />
      
      <SettingsSection>
        <SettingsRow 
          label="Server Connection" 
          description="The local network address of the master server." 
          control={
            <div className="flex gap-2 w-full max-w-sm">
              <Input type="url" value={networkUrl} onChange={e => { setNetworkUrl(e.target.value); setNetworkStatus('idle'); }} placeholder="http://192.168.1.100:3001" className="flex-1" />
              <Button variant="secondary" onClick={handleNetworkTest}>Test</Button>
            </div>
          } 
        />
        {(networkStatus === 'ok' || networkStatus === 'fail') && (
          <SettingsRow 
            label="Connection Status" 
            control={
              <div className="flex items-center gap-3 w-full justify-end">
                {networkStatus === 'ok' && <span className="text-[13px] font-medium text-emerald-600">Connected ({networkLatency}ms)</span>}
                {networkStatus === 'fail' && <span className="text-[13px] font-medium text-rose-600">Cannot reach server</span>}
                <Button onClick={handleNetworkSave} disabled={networkStatus !== 'ok' && !networkUrl.includes('localhost')}>Save Network</Button>
              </div>
            }
          />
        )}
      </SettingsSection>

      <SettingsSection>
        <SettingsRow 
          label="Cloud Sync" 
          description="Manually trigger a sync with the cloud database. Sync happens automatically in the background."
          control={
            <div className="flex items-center gap-4 w-full justify-end">
              {syncMessage && <span className="text-[13px] text-slate-500">{syncMessage}</span>}
              <Button variant="secondary" onClick={handleManualSync} disabled={isManualSyncing}>
                <RefreshCw className={`w-4 h-4 ${isManualSyncing ? 'animate-spin' : ''}`} /> Sync Now
              </Button>
            </div>
          }
        />
      </SettingsSection>
    </div>
  );

  const renderWorkspace = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Workspace" description="General configuration for the point of sale." />
      <SettingsSection>
        <SettingsRow 
          label="Order Number Prefix" 
          description="A short prefix prepended to every new order (e.g. KOT-1234)."
          control={<Input type="text" value={localOrderPrefix} onChange={e => setLocalOrderPrefix(e.target.value.toUpperCase())} placeholder="KOT" className="w-full max-w-[150px]" />} 
        />
      </SettingsSection>
      <div className="flex justify-end mt-6">
        <Button onClick={applyGeneralSettings}>Save changes</Button>
      </div>
    </div>
  );

  const renderTvBehaviors = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Order TV Behaviors" description="Configure alerts, sounds, and animations for the customer-facing Order TV." />
      <SettingsSection>
        <SettingsRow 
          label="Now Serving Popup" 
          description="Show a massive alert when an order is marked ready."
          control={<Switch checked={localTvPopup} onChange={() => setLocalTvPopup(!localTvPopup)} />} 
        />
        <SettingsRow 
          label="Audio Chime" 
          description="Play a sound over speakers when an order is ready."
          control={<Switch checked={localTvAudio} onChange={() => setLocalTvAudio(!localTvAudio)} />} 
        />
        {localTvAudio && (
          <SettingsRow 
            label="Chime Tone" 
            control={
              <div className="flex flex-col gap-2 w-full max-w-sm">
                <div className="flex gap-2">
                  <Select value={localTvAudioTone} onChange={e => setLocalTvAudioTone(e.target.value)} className="flex-1">
                    <option value="bell">Classic Bell</option><option value="chime">Soft Chime</option><option value="digital">Digital Beep</option><option value="custom">Custom File</option>
                  </Select>
                  <Button variant="secondary" onClick={playTestAudio}><Play className="w-4 h-4" /> Test</Button>
                </div>
                {localTvAudioTone === 'custom' && (
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} className="text-[13px] text-slate-500 w-full" />
                )}
              </div>
            }
          />
        )}
        <SettingsRow 
          label="Voice Announcements (TTS)" 
          description="Speak the order number when ready."
          control={<Switch checked={localTvTtsEnabled} onChange={() => setLocalTvTtsEnabled(!localTvTtsEnabled)} />} 
        />
        {localTvTtsEnabled && (
          <SettingsRow 
            label="TTS Voice" 
            control={
              <Select value={localTvTtsVoiceName} onChange={e => setLocalTvTtsVoiceName(e.target.value)} className="w-full max-w-sm">
                <option value="">Default System Voice</option>
                {typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </Select>
            }
          />
        )}
        <SettingsRow 
          label="Confetti Celebration" 
          description="Burst confetti on the screen when an order is ready."
          control={<Switch checked={localTvConfetti} onChange={() => setLocalTvConfetti(!localTvConfetti)} />} 
        />
        <SettingsRow 
          label="Water Fill Animation" 
          description="Show liquid filling up on prep tickets."
          control={<Switch checked={localTvWaterFill} onChange={() => setLocalTvWaterFill(!localTvWaterFill)} />} 
        />
        {localTvWaterFill && (
          <SettingsRow 
            label="Liquid Color" 
            control={<input type="color" value={localTvWaterColor || '#fbbf24'} onChange={e => setLocalTvWaterColor(e.target.value)} className="w-10 h-10 rounded-[6px] cursor-pointer border border-slate-300 p-1 bg-white" />} 
          />
        )}
        <SettingsRow 
          label="Ready Badge" 
          description="Show a stamped badge on ready orders."
          control={<Switch checked={localTvReadyBadge} onChange={() => setLocalTvReadyBadge(!localTvReadyBadge)} />} 
        />
        <SettingsRow 
          label="Time Waiting" 
          description="Show wait times on active tickets."
          control={<Switch checked={localTvTimeWaiting} onChange={() => setLocalTvTimeWaiting(!localTvTimeWaiting)} />} 
        />
        <SettingsRow 
          label="Chaos Animation" 
          description="Tickets jump and shake intensely when ready."
          control={<Switch checked={localTvChaos} onChange={() => setLocalTvChaos(!localTvChaos)} />} 
          border={false}
        />
      </SettingsSection>
      <div className="flex justify-end mt-6">
        <Button onClick={applyGeneralSettings}>Save changes</Button>
      </div>
    </div>
  );

  const renderTvLayout = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Order TV Layout" description="Configure the structural layout and orientation of the Order TV." />
      <SettingsSection>
        <SettingsRow 
          label="Layout Mode" 
          description="Choose between a full queue or a split view with promotions."
          control={
            <div className="flex bg-slate-100 p-1 rounded-[8px] w-full max-w-[300px]">
              <button onClick={() => setLocalTvLayoutMode('FULL_QUEUE')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-[13px] font-medium transition-all ${localTvLayoutMode === 'FULL_QUEUE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <LayoutDashboard className="w-4 h-4" /> Full Queue
              </button>
              <button onClick={() => setLocalTvLayoutMode('SPLIT_PROMO')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-[13px] font-medium transition-all ${localTvLayoutMode === 'SPLIT_PROMO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <LayoutTemplate className="w-4 h-4" /> Split Promo
              </button>
            </div>
          }
        />
        <SettingsRow 
          label="Orientation" 
          description="Optimize the layout for landscape or portrait displays."
          control={
            <div className="flex bg-slate-100 p-1 rounded-[8px] w-full max-w-[300px]">
              <button onClick={() => setLocalTvOrientation('HORIZONTAL')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-[13px] font-medium transition-all ${localTvOrientation === 'HORIZONTAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Monitor className="w-4 h-4" /> Landscape
              </button>
              <button onClick={() => setLocalTvOrientation('VERTICAL')} className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[6px] text-[13px] font-medium transition-all ${localTvOrientation === 'VERTICAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Smartphone className="w-4 h-4" /> Portrait
              </button>
            </div>
          }
        />
        <SettingsRow 
          label="Promotional Ticker" 
          description="Show a scrolling marquee text at the bottom of the screen."
          control={<Switch checked={localTvTickerEnabled} onChange={() => setLocalTvTickerEnabled(!localTvTickerEnabled)} />}
        />
        {localTvTickerEnabled && (
          <SettingsRow 
            label="Ticker Message" 
            control={<Input type="text" value={localTvTickerMessage} onChange={e => setLocalTvTickerMessage(e.target.value)} placeholder="Ticker Message..." className="w-full max-w-sm" />} 
            border={false}
          />
        )}
      </SettingsSection>
      <div className="flex justify-end mt-6">
        <Button onClick={applyGeneralSettings}>Save changes</Button>
      </div>
    </div>
  );

  const renderTvMedia = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Promo Media" description="Manage text, QR codes, and media playlists for the Split Promo layout." />
      <SettingsSection>
        <SettingsRow 
          label="Overlay Message" 
          description="Promotional text shown over the media."
          control={<Input type="text" value={localTvPromoText} onChange={e => setLocalTvPromoText(e.target.value)} placeholder="e.g. Happy Hour Starts at 5 PM!" className="w-full max-w-sm" />} 
        />
        <SettingsRow 
          label="QR Code URL" 
          description="URL embedded in the on-screen QR code."
          control={<Input type="url" value={localTvPromoQrUrl} onChange={e => setLocalTvPromoQrUrl(e.target.value)} placeholder="https://karvaan.app/menu" className="w-full max-w-sm" />} 
        />
        <SettingsRow 
          label="Background Fallback" 
          control={<input type="color" value={localTvPromoBgColor || '#000000'} onChange={e => setLocalTvPromoBgColor(e.target.value)} className="w-10 h-10 rounded-[6px] cursor-pointer border border-slate-300 p-1 bg-white" />} 
        />
        <SettingsRow 
          label="Playlist Delay (Seconds)" 
          description="How long each media item shows before rotating."
          control={<Input type="number" min="2" max="60" value={localTvPromoInterval} onChange={e => setLocalTvPromoInterval(parseInt(e.target.value))} className="w-24 text-center" />} 
        />
        <SettingsRow 
          label="Media Playlist" 
          description="Images and videos shown in the promo section."
          control={
            <div className="w-full flex flex-col gap-4">
              <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? 'Uploading...' : <><UploadCloud className="w-4 h-4" /> Upload Files</>}
              </Button>
            </div>
          }
          border={localTvPromoMedia.length > 0}
        />
        {localTvPromoMedia.length > 0 && (
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {localTvPromoMedia.map((media) => (
                <div key={media.id} className="relative group aspect-video bg-slate-100 rounded-[8px] border border-slate-200 overflow-hidden shadow-sm">
                  {media.type === 'IMAGE' ? <img src={media.url} alt="Promo" className="w-full h-full object-cover" /> : <video src={media.url} className="w-full h-full object-cover" muted />}
                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="danger" onClick={() => store.removeOrderTvPromoMedia(media.id)} className="!px-3 !py-2"><Trash className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SettingsSection>
      <div className="flex justify-end mt-6">
        <Button onClick={applyGeneralSettings}>Save changes</Button>
      </div>
    </div>
  );

  const renderPosConfig = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="POS Configuration" description="Manage quick notes, discounts, and paid add-ons." />
      
      <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Quick Notes</h2>
      <SettingsSection>
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-3">
          <Input type="text" placeholder="Icon (e.g. 🌶️)" value={newNote.icon} onChange={e => setNewNote({ ...newNote, icon: e.target.value })} className="w-24 text-center" />
          <Input type="text" placeholder="Label (e.g. Extra Spicy)" value={newNote.label} onChange={e => setNewNote({ ...newNote, label: e.target.value })} className="flex-1" />
          <Button onClick={() => { if (newNote.label) { store.addNote(newNote); setNewNote({label:'', icon:''}); } }}>Add Note</Button>
        </div>
        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {store.notes.length === 0 ? (
             <div className="p-8 text-center text-[13px] text-slate-500">No quick notes added.</div>
          ) : (
            store.notes.map(n => (
              <div key={n.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{n.icon}</span>
                  <span className="text-[14px] font-medium text-slate-900">{n.label}</span>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-600" onClick={() => store.deleteNote(n.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Predefined Discounts</h2>
      <SettingsSection>
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-3">
          <Select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value as any })} className="w-32">
            <option value="PERCENTAGE">% Off</option><option value="FLAT">Flat ₹</option>
          </Select>
          <Input type="number" placeholder="Amt" value={newDiscount.amount} onChange={e => setNewDiscount({ ...newDiscount, amount: e.target.value })} className="w-24" />
          <Input type="text" placeholder="Label" value={newDiscount.label} onChange={e => setNewDiscount({ ...newDiscount, label: e.target.value })} className="flex-1" />
          <Button onClick={() => { if (newDiscount.label && newDiscount.amount) { store.addDiscount({ label: newDiscount.label, amount: Number(newDiscount.amount), type: newDiscount.type }); setNewDiscount({label:'', amount:'', type:'PERCENTAGE'}); } }}>Add Discount</Button>
        </div>
        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {store.discounts.length === 0 ? (
             <div className="p-8 text-center text-[13px] text-slate-500">No discounts added.</div>
          ) : (
            store.discounts.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[6px] bg-slate-100 border border-slate-200 flex items-center justify-center font-medium text-[14px] text-slate-700">
                    {d.type === 'PERCENTAGE' ? '%' : '₹'}
                  </div>
                  <div>
                    <h4 className="font-medium text-[14px] text-slate-900">{d.label}</h4>
                    <p className="text-[13px] text-slate-500">{d.type === 'PERCENTAGE' ? `${d.amount}%` : `₹${d.amount}`} Off</p>
                  </div>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-600" onClick={() => store.deleteDiscount(d.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <h2 className="text-[15px] font-semibold text-slate-900 mb-4">Paid Add-ons</h2>
      <SettingsSection>
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-3">
          <Input type="text" placeholder="Add-on Name" value={newAddon.name} onChange={e => setNewAddon({ ...newAddon, name: e.target.value })} className="flex-1" />
          <Input type="number" placeholder="₹ Price" value={newAddon.price} onChange={e => setNewAddon({ ...newAddon, price: e.target.value })} className="w-32" />
          <Button onClick={() => { if (newAddon.name && newAddon.price) { addAddon({ name: newAddon.name, price: Number(newAddon.price), isActive: true }); setNewAddon({name:'', price:''}); } }}>Add Item</Button>
        </div>
        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
          {addons.length === 0 ? (
             <div className="p-8 text-center text-[13px] text-slate-500">No add-ons added.</div>
          ) : (
            addons.map(a => (
              <div key={a.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                <div>
                  <h4 className="font-medium text-[14px] text-slate-900">{a.name}</h4>
                  <p className="text-[13px] text-emerald-600 font-medium">+₹{a.price}</p>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-600" onClick={() => deleteAddon(a.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>
    </div>
  );

  const NavButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[14px] font-medium transition-colors ${
        activeTab === id 
          ? 'bg-slate-200/60 text-slate-900' 
          : 'text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-slate-900' : 'text-slate-400'}`} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#fafafa] overflow-hidden text-slate-900 font-sans">
      
      {/* Mobile Nav Select */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 shrink-0">
        <Select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} className="w-full font-medium">
          <optgroup label="System">
            <option value="general-network">Network & Sync</option>
            <option value="general-workspace">Workspace</option>
          </optgroup>
          <optgroup label="Order TV">
            <option value="tv-behaviors">Behaviors</option>
            <option value="tv-layout">Layout</option>
            <option value="tv-media">Promo Media</option>
          </optgroup>
          <optgroup label="POS">
            <option value="pos-config">POS Configuration</option>
          </optgroup>
        </Select>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex-col shrink-0 overflow-y-auto hidden md:flex">
        <div className="p-5 pb-3">
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">Settings</h2>
        </div>
        <nav className="flex-1 px-3 space-y-6 pb-6">
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">System</h3>
            <div className="space-y-0.5">
              <NavButton id="general-network" label="Network & Sync" icon={Wifi} />
              <NavButton id="general-workspace" label="Workspace" icon={LayoutDashboard} />
            </div>
          </div>
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Order TV</h3>
            <div className="space-y-0.5">
              <NavButton id="tv-behaviors" label="Behaviors" icon={MonitorSpeaker} />
              <NavButton id="tv-layout" label="Layout" icon={LayoutTemplate} />
              <NavButton id="tv-media" label="Promo Media" icon={Play} />
            </div>
          </div>
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">POS Config</h3>
            <div className="space-y-0.5">
              <NavButton id="pos-config" label="Quick Notes & Discounts" icon={MessageSquare} />
            </div>
          </div>
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 bg-white overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto p-6 md:p-12 pb-32">
          {activeTab === 'general-network' && renderNetworkSync()}
          {activeTab === 'general-workspace' && renderWorkspace()}
          {activeTab === 'tv-behaviors' && renderTvBehaviors()}
          {activeTab === 'tv-layout' && renderTvLayout()}
          {activeTab === 'tv-media' && renderTvMedia()}
          {activeTab === 'pos-config' && renderPosConfig()}
        </div>
      </main>
    </div>
  );
};
