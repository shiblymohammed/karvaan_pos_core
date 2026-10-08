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
  MoreHorizontal,
  Database
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAddonStore } from '../../store/useAddonStore';
import { getServerUrl, setServerUrl, probeServer } from '../../services/serverConfig';
import { motion, AnimatePresence } from 'framer-motion';

import { Printer } from 'lucide-react';

// --- REUSABLE COMPONENTS ---
const SettingsHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="mb-8 border-b border-white/20 pb-6">
    <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{title}</h1>
    <p className="text-[14px] text-slate-500 mt-1">{description}</p>
  </div>
);

const SettingsSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border border-white/40 rounded-[24px] overflow-hidden bg-white/60 backdrop-blur-xl mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
    {children}
  </div>
);

const SettingsRow: React.FC<{ label: string; description?: string; control: React.ReactNode; border?: boolean; stackOnMobile?: boolean }> = ({ label, description, control, border = true, stackOnMobile = false }) => (
  <div className={`p-4 sm:p-5 flex ${stackOnMobile ? 'flex-col sm:flex-row sm:items-center items-start' : 'flex-row items-center'} justify-between gap-4 sm:gap-6 ${border ? 'border-b border-white/40 last:border-b-0' : ''}`}>
    <div className="flex-1 pr-2 sm:pr-4">
      <h3 className="text-[14px] font-bold text-slate-800">{label}</h3>
      {description && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed hidden sm:block">{description}</p>}
      {description && stackOnMobile && <p className="text-[12px] text-slate-500 mt-1 leading-relaxed sm:hidden block">{description}</p>}
      {description && !stackOnMobile && <p className="text-[12px] text-slate-500 mt-0.5 leading-tight sm:hidden block">{description}</p>}
    </div>
    <div className={`shrink-0 flex justify-end ${stackOnMobile ? 'w-full sm:w-auto sm:min-w-[200px]' : ''}`}>
      {control}
    </div>
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input ref={ref} {...props} className={`w-full px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/40 rounded-xl text-slate-900 text-[14px] font-medium focus:outline-none focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${props.className || ''}`} />
));

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className={`relative ${className || 'w-full'}`}>
    <select ref={ref} {...props} className={`w-full appearance-none px-4 py-2.5 bg-white/50 backdrop-blur-md border border-white/40 rounded-xl text-slate-900 text-[14px] font-bold focus:outline-none focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 shadow-sm transition-all pr-10 cursor-pointer`}>
      {children}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </div>
  </div>
));

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-bold rounded-xl transition-all focus:outline-none active:scale-95";
  const variants = {
    primary: "bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] text-[#0f172a] shadow-[0_4px_12px_rgba(140,198,63,0.3)] hover:shadow-[0_6px_16px_rgba(140,198,63,0.4)]",
    secondary: "bg-white/60 backdrop-blur-md text-slate-700 border border-white/60 hover:bg-white/80 shadow-sm",
    danger: "bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)] hover:shadow-[0_6px_16px_rgba(244,63,94,0.4)]",
    ghost: "bg-transparent text-slate-500 hover:bg-white/40 hover:text-slate-900"
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

const Switch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-4 focus:ring-[#8cc63f]/20 transition-colors duration-300 ease-in-out shadow-inner ${checked ? 'bg-[#8cc63f]' : 'bg-slate-200'}`}
  >
    <span aria-hidden="true" className={`pointer-events-none absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
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
  const [localParcelCharge, setLocalParcelCharge] = useState(store.parcelChargeAmount || 0);
  const [localTimeFormat, setLocalTimeFormat] = useState<'12h' | '24h'>(store.timeFormat || '12h');
  const [localDateFormat, setLocalDateFormat] = useState<'AUTO' | 'MANUAL'>(store.dateFormat || 'AUTO');
  const [localOperatingMode, setLocalOperatingMode] = useState<'FINE_DINING' | 'QSR' | 'CLOUD_KITCHEN'>(store.operatingMode || 'FINE_DINING');

  const [localTvEnabled, setLocalTvEnabled] = useState(store.orderTvEnabled);
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
  const [localTvShowDelivery, setLocalTvShowDelivery] = useState(store.orderTvShowDelivery);

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

  // Backup Settings
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupTime, setBackupTime] = useState('03:00');
  const [backupLocation, setBackupLocation] = useState('../../backups');
  const [isBackupSaving, setIsBackupSaving] = useState(false);
  const [backupSaveMsg, setBackupSaveMsg] = useState('');

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/backup/settings`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setBackupEnabled(data.enabled ?? true);
          setBackupTime(data.time ?? '03:00');
          setBackupLocation(data.location ?? '../../backups');
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLocalOrderPrefix(store.orderPrefix);
    setLocalParcelCharge(store.parcelChargeAmount || 0);
    setLocalTimeFormat(store.timeFormat || '12h');
    setLocalDateFormat(store.dateFormat || 'AUTO');
    setLocalOperatingMode(store.operatingMode || 'FINE_DINING');
    setLocalTvEnabled(store.orderTvEnabled);
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
    setLocalTvShowDelivery(store.orderTvShowDelivery);
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
    store.setParcelChargeAmount(localParcelCharge);
    store.setTimeFormat(localTimeFormat as '12h' | '24h');
    store.setDateFormat(localDateFormat as 'AUTO' | 'MANUAL');
    store.setOperatingMode(localOperatingMode as 'FINE_DINING' | 'QSR' | 'CLOUD_KITCHEN');
    store.setOrderTvEnabled(localTvEnabled);
    if (localTvPopup !== store.orderTvShowPopup) store.toggleOrderTvPopup();
    store.setOrderTvAudio(localTvAudio, localTvAudioTone, store.orderTvCustomAudioData);
    store.setOrderTvTts(localTvTtsEnabled, localTvTtsVoiceName);
    store.setOrderTvConfetti(localTvConfetti);
    store.setOrderTvWaterFill(localTvWaterFill);
    store.setOrderTvWaterColor(localTvWaterColor);
    store.setOrderTvReadyBadge(localTvReadyBadge);
    store.setOrderTvTimeWaiting(localTvTimeWaiting);
    store.setOrderTvChaosAnimation(localTvChaos);
    store.setOrderTvShowDelivery(localTvShowDelivery);
    store.setOrderTvLayoutMode(localTvLayoutMode);
    store.setOrderTvOrientation(localTvOrientation);
    store.setOrderTvTicker(localTvTickerEnabled, localTvTickerMessage);
    store.setOrderTvPromoInterval(localTvPromoInterval);
    store.setOrderTvPromoText(localTvPromoText);
    store.setOrderTvPromoQrUrl(localTvPromoQrUrl);
    store.setOrderTvPromoBgColor(localTvPromoBgColor);
  };

  const applyBackupSettings = async () => {
    setIsBackupSaving(true);
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/backup/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: backupEnabled, time: backupTime, location: backupLocation })
      });
      if (response.ok) {
        setBackupSaveMsg('Backup settings saved successfully!');
      } else {
        setBackupSaveMsg('Failed to save settings.');
      }
    } catch (error) {
      setBackupSaveMsg('Error saving settings.');
    }
    setIsBackupSaving(false);
    setTimeout(() => setBackupSaveMsg(''), 5000);
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
  const renderHardware = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Printer & Hardware" description="Manage receipt printers, cash drawers, and label printing options. Please use the dedicated 'Label & Printers' tab in the sidebar." />
    </div>
  );

  const renderNetworkSync = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Network & Sync" description="Configure server connections and cloud synchronization." />
      
      <SettingsSection>
        <SettingsRow 
          label="Server Connection" 
          stackOnMobile
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
            stackOnMobile
            control={
              <div className="flex items-center gap-3 w-full justify-end">
                {networkStatus === 'ok' && <span className="text-[13px] font-medium text-emerald-600">Connected ({networkLatency}ms)</span>}
                {networkStatus === 'fail' && <span className="text-[13px] font-medium text-rose-600">Cannot reach server</span>}
                <Button onClick={handleNetworkSave} disabled={networkStatus !== 'ok' && !networkUrl.includes('localhost')}>Save Network</Button>
              </div>
            }
          />
        )}
        <SettingsRow 
          label="Connect New Devices" 
          stackOnMobile
          description="Scan this QR code with a tablet or phone to instantly connect it to the network." 
          control={
            <div className="flex justify-end w-full">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(networkUrl)}`} alt="Network QR" className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border border-slate-200 shadow-sm" />
            </div>
          } 
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow 
          label="Enable Cloud Sync" 
          description="Automatically push sales and sync menus with the central Master Cloud Node."
          control={
            <Switch 
              checked={store.cloudSyncEnabled} 
              onChange={() => store.setCloudSyncEnabled(!store.cloudSyncEnabled)} 
            />
          }
        />
        <SettingsRow 
          label="Manual Cloud Sync" 
          stackOnMobile
          description="Force a manual sync with the cloud database immediately."
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
          label="Operating Model (Pipeline)" 
          stackOnMobile
          description="Changes POS workflows. Fine Dining (Tables), QSR (Counter/Tokens), Cloud Kitchen (Delivery/Dispatch)."
          control={
            <Select value={localOperatingMode} onChange={e => setLocalOperatingMode(e.target.value as 'FINE_DINING' | 'QSR' | 'CLOUD_KITCHEN')} className="w-full sm:max-w-[200px]">
              <option value="FINE_DINING">Full Service (Tables)</option>
              <option value="QSR">QSR / Fast Food</option>
              <option value="CLOUD_KITCHEN">Cloud Kitchen (Delivery)</option>
            </Select>
          } 
        />
        <SettingsRow 
          label="Order Number Prefix" 
          stackOnMobile
          description="A short prefix prepended to every new order (e.g. KOT-1234)."
          control={<Input type="text" value={localOrderPrefix} onChange={e => setLocalOrderPrefix(e.target.value.toUpperCase())} placeholder="KOT" className="w-full sm:max-w-[150px]" />} 
        />
        <SettingsRow 
          label="Parcel/Packaging Charge (₹)" 
          stackOnMobile
          description="Auto-applied fixed charge for takeaway/parcel orders."
          control={<Input type="number" min="0" value={localParcelCharge} onChange={e => setLocalParcelCharge(Number(e.target.value))} className="w-full sm:max-w-[150px]" />} 
        />
        <SettingsRow 
          label="Time Format" 
          stackOnMobile
          description="Display time in 12-hour (AM/PM) or 24-hour military format."
          control={
            <Select value={localTimeFormat} onChange={e => setLocalTimeFormat(e.target.value as '12h' | '24h')} className="w-full sm:max-w-[150px]">
              <option value="12h">12-Hour (AM/PM)</option>
              <option value="24h">24-Hour</option>
            </Select>
          } 
        />
        <SettingsRow 
          label="Date Format Settings" 
          stackOnMobile
          description="Auto shows relative dates (e.g. 'Today'). Manual shows exact dates."
          control={
            <Select value={localDateFormat} onChange={e => setLocalDateFormat(e.target.value as 'AUTO' | 'MANUAL')} className="w-full sm:max-w-[150px]">
              <option value="AUTO">Auto (Relative)</option>
              <option value="MANUAL">Manual (Exact)</option>
            </Select>
          } 
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
          label="Enable Order TV Screen" 
          description="Turn the customer-facing Order TV screen on or off entirely."
          control={<Switch checked={localTvEnabled} onChange={() => setLocalTvEnabled(!localTvEnabled)} />} 
        />
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
            stackOnMobile
            control={
              <div className="flex flex-col gap-3 w-full sm:max-w-[400px]">
                <div className="grid grid-cols-2 gap-1 p-1 bg-white/50 backdrop-blur-md border border-white/40 rounded-xl">
                  {[
                    { id: 'bell', label: 'Classic Bell' },
                    { id: 'chime', label: 'Soft Chime' },
                    { id: 'digital', label: 'Digital Beep' },
                    { id: 'custom', label: 'Custom File' }
                  ].map(tone => (
                    <button
                      key={tone.id}
                      onClick={() => setLocalTvAudioTone(tone.id)}
                      className={`relative flex items-center justify-center py-2 px-3 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${localTvAudioTone === tone.id ? 'text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {localTvAudioTone === tone.id && (
                        <motion.div layoutId="chimeTonePill" className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-lg shadow-sm z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                      )}
                      <span className="relative z-10">{tone.label}</span>
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={playTestAudio} className="w-full flex justify-center items-center gap-2"><Play className="w-4 h-4" /> Test Sound</Button>
                {localTvAudioTone === 'custom' && (
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} className="text-[13px] text-slate-500 w-full px-3 py-2 bg-white/50 border border-white/40 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[13px] file:font-bold file:bg-gradient-to-r file:from-[#8cc63f] file:to-[#b5ef85] file:text-[#0f172a] hover:file:opacity-90 transition-all cursor-pointer file:cursor-pointer file:shadow-sm" />
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
            stackOnMobile
            control={
              <Select value={localTvTtsVoiceName} onChange={e => setLocalTvTtsVoiceName(e.target.value)} className="w-full sm:max-w-sm">
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
            control={<input type="color" value={localTvWaterColor || '#fbbf24'} onChange={e => setLocalTvWaterColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border border-white/40 p-1 bg-white/50 shadow-sm" />} 
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
        />
        <SettingsRow 
          label="Show Delivery Orders" 
          description="Display delivery orders on the Order TV screen."
          control={<Switch checked={localTvShowDelivery} onChange={() => setLocalTvShowDelivery(!localTvShowDelivery)} />} 
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
          stackOnMobile
          description="Choose between a full queue or a split view with promotions."
          control={
            <div className="flex bg-white/50 backdrop-blur-md border border-white/40 p-1 rounded-xl w-full sm:max-w-[300px]">
              <button onClick={() => setLocalTvLayoutMode('FULL_QUEUE')} className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${localTvLayoutMode === 'FULL_QUEUE' ? 'text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`}>
                {localTvLayoutMode === 'FULL_QUEUE' && (
                  <motion.div layoutId="tvLayoutPill" className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-lg shadow-sm z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <LayoutDashboard className="w-4 h-4 relative z-10" /> <span className="relative z-10">Full Queue</span>
              </button>
              <button onClick={() => setLocalTvLayoutMode('SPLIT_PROMO')} className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${localTvLayoutMode === 'SPLIT_PROMO' ? 'text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`}>
                {localTvLayoutMode === 'SPLIT_PROMO' && (
                  <motion.div layoutId="tvLayoutPill" className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-lg shadow-sm z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <LayoutTemplate className="w-4 h-4 relative z-10" /> <span className="relative z-10">Split Promo</span>
              </button>
            </div>
          }
        />
        <SettingsRow 
          label="Orientation" 
          stackOnMobile
          description="Optimize the layout for landscape or portrait displays."
          control={
            <div className="flex bg-white/50 backdrop-blur-md border border-white/40 p-1 rounded-xl w-full sm:max-w-[300px]">
              <button onClick={() => setLocalTvOrientation('HORIZONTAL')} className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${localTvOrientation === 'HORIZONTAL' ? 'text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`}>
                {localTvOrientation === 'HORIZONTAL' && (
                  <motion.div layoutId="tvOrientationPill" className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-lg shadow-sm z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <Monitor className="w-4 h-4 relative z-10" /> <span className="relative z-10">Landscape</span>
              </button>
              <button onClick={() => setLocalTvOrientation('VERTICAL')} className={`relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all active:scale-95 ${localTvOrientation === 'VERTICAL' ? 'text-[#0f172a]' : 'text-slate-500 hover:text-slate-700'}`}>
                {localTvOrientation === 'VERTICAL' && (
                  <motion.div layoutId="tvOrientationPill" className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-lg shadow-sm z-0" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <Smartphone className="w-4 h-4 relative z-10" /> <span className="relative z-10">Portrait</span>
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
            stackOnMobile
            control={<Input type="text" value={localTvTickerMessage} onChange={e => setLocalTvTickerMessage(e.target.value)} placeholder="Ticker Message..." className="w-full sm:max-w-sm" />} 
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
          stackOnMobile
          description="Promotional text shown over the media."
          control={<Input type="text" value={localTvPromoText} onChange={e => setLocalTvPromoText(e.target.value)} placeholder="e.g. Happy Hour Starts at 5 PM!" className="w-full sm:max-w-sm" />} 
        />
        <SettingsRow 
          label="QR Code URL" 
          stackOnMobile
          description="URL embedded in the on-screen QR code."
          control={<Input type="url" value={localTvPromoQrUrl} onChange={e => setLocalTvPromoQrUrl(e.target.value)} placeholder="https://karvaan.app/menu" className="w-full sm:max-w-sm" />} 
        />
        <SettingsRow 
          label="Background Fallback" 
          control={<input type="color" value={localTvPromoBgColor || '#000000'} onChange={e => setLocalTvPromoBgColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border border-white/40 p-1 bg-white/50 shadow-sm" />} 
        />
        <SettingsRow 
          label="Playlist Delay (Seconds)" 
          stackOnMobile
          description="How long each media item shows before rotating."
          control={<Input type="number" min="2" max="60" value={localTvPromoInterval === 0 ? '' : localTvPromoInterval} onChange={e => setLocalTvPromoInterval(e.target.value === '' ? 0 : parseInt(e.target.value))} className="w-full sm:w-24 sm:text-center" />} 
        />
        <SettingsRow 
          label="Media Playlist" 
          stackOnMobile
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
      
      <h2 className="text-[16px] font-bold text-slate-900 mb-4 px-1">Quick Notes</h2>
      <SettingsSection>
        <div className="p-4 border-b border-white/40 bg-white/40 flex gap-3">
          <Input type="text" placeholder="Icon (e.g. 🌶️)" value={newNote.icon} onChange={e => setNewNote({ ...newNote, icon: e.target.value })} className="w-24 text-center" />
          <Input type="text" placeholder="Label (e.g. Extra Spicy)" value={newNote.label} onChange={e => setNewNote({ ...newNote, label: e.target.value })} className="flex-1" />
          <Button onClick={() => { if (newNote.label) { store.addNote(newNote); setNewNote({label:'', icon:''}); } }}>Add Note</Button>
        </div>
        <div className="divide-y divide-white/40 max-h-[300px] overflow-y-auto">
          {store.notes.length === 0 ? (
             <div className="p-8 text-center text-[14px] text-slate-500 font-medium">No quick notes added.</div>
          ) : (
            store.notes.map(n => (
              <div key={n.id} className="flex items-center justify-between p-4 hover:bg-white/40 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[22px] w-8 text-center">{n.icon}</span>
                  <span className="text-[14px] font-bold text-slate-900">{n.label}</span>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-500" onClick={() => store.deleteNote(n.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <h2 className="text-[16px] font-bold text-slate-900 mb-4 px-1">Predefined Discounts</h2>
      <SettingsSection>
        <div className="p-4 border-b border-white/40 bg-white/40 flex gap-3">
          <Select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value as any })} className="w-32">
            <option value="PERCENTAGE">% Off</option><option value="FLAT">Flat ₹</option>
          </Select>
          <Input type="number" placeholder="Amt" value={newDiscount.amount} onChange={e => setNewDiscount({ ...newDiscount, amount: e.target.value })} className="w-24" />
          <Input type="text" placeholder="Label" value={newDiscount.label} onChange={e => setNewDiscount({ ...newDiscount, label: e.target.value })} className="flex-1" />
          <Button onClick={() => { if (newDiscount.label && newDiscount.amount) { store.addDiscount({ label: newDiscount.label, amount: Number(newDiscount.amount), type: newDiscount.type }); setNewDiscount({label:'', amount:'', type:'PERCENTAGE'}); } }}>Add</Button>
        </div>
        <div className="divide-y divide-white/40 max-h-[300px] overflow-y-auto">
          {store.discounts.length === 0 ? (
             <div className="p-8 text-center text-[14px] text-slate-500 font-medium">No discounts added.</div>
          ) : (
            store.discounts.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 hover:bg-white/40 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/50 border border-white/60 flex items-center justify-center font-bold text-[15px] text-[#8cc63f] shadow-sm">
                    {d.type === 'PERCENTAGE' ? '%' : '₹'}
                  </div>
                  <div>
                    <h4 className="font-bold text-[14px] text-slate-900">{d.label}</h4>
                    <p className="text-[13px] text-slate-500">{d.type === 'PERCENTAGE' ? `${d.amount}%` : `₹${d.amount}`} Off</p>
                  </div>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-500" onClick={() => store.deleteDiscount(d.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <h2 className="text-[16px] font-bold text-slate-900 mb-4 px-1">Paid Add-ons</h2>
      <SettingsSection>
        <div className="p-4 border-b border-white/40 bg-white/40 flex gap-3">
          <Input type="text" placeholder="Add-on Name" value={newAddon.name} onChange={e => setNewAddon({ ...newAddon, name: e.target.value })} className="flex-1" />
          <Input type="number" placeholder="₹ Price" value={newAddon.price} onChange={e => setNewAddon({ ...newAddon, price: e.target.value })} className="w-32" />
          <Button onClick={() => { if (newAddon.name && newAddon.price) { addAddon({ name: newAddon.name, price: Number(newAddon.price), isActive: true }); setNewAddon({name:'', price:''}); } }}>Add Item</Button>
        </div>
        <div className="divide-y divide-white/40 max-h-[300px] overflow-y-auto">
          {addons.length === 0 ? (
             <div className="p-8 text-center text-[14px] text-slate-500 font-medium">No add-ons added.</div>
          ) : (
            addons.map(a => (
              <div key={a.id} className="flex items-center justify-between p-4 hover:bg-white/40 transition-colors">
                <div>
                  <h4 className="font-bold text-[14px] text-slate-900">{a.name}</h4>
                  <p className="text-[13px] text-[#8cc63f] font-bold">+₹{a.price}</p>
                </div>
                <Button variant="ghost" className="!p-2 text-slate-400 hover:text-rose-500" onClick={() => deleteAddon(a.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))
          )}
        </div>
      </SettingsSection>
    </div>
  );

  const renderBackupSettings = () => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsHeader title="Automated Backup" description="Configure scheduled database backups." />
      <SettingsSection>
        <SettingsRow 
          label="Enable Automated Backup" 
          description="Runs a daily backup of your data."
          control={<Switch checked={backupEnabled} onChange={() => setBackupEnabled(!backupEnabled)} />} 
        />
        {backupEnabled && (
          <>
            <SettingsRow 
              label="Backup Time" 
              stackOnMobile
              description="Time of day when the automated backup runs."
              control={<Input type="time" value={backupTime} onChange={e => setBackupTime(e.target.value)} className="w-full sm:max-w-[150px]" />} 
            />
            <SettingsRow 
              label="Backup Location" 
              stackOnMobile
              description="Path to store backup files (relative to backend folder or absolute path)."
              control={<Input type="text" value={backupLocation} onChange={e => setBackupLocation(e.target.value)} placeholder="../../backups" className="w-full sm:max-w-sm" />} 
            />
          </>
        )}
      </SettingsSection>
      <div className="flex justify-end mt-6 items-center gap-3">
        {backupSaveMsg && <span className="text-sm font-bold text-emerald-600">{backupSaveMsg}</span>}
        <Button onClick={applyBackupSettings} disabled={isBackupSaving}>
          {isBackupSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );

  const renderNavButton = (id: string, label: string, Icon: any) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-bold transition-all active:scale-95 ${
        activeTab === id 
          ? 'text-[#0f172a]' 
          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
      }`}
    >
      {activeTab === id && (
        <motion.div
          layoutId="sidebarActiveTab"
          className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-xl shadow-[0_4px_12px_rgba(140,198,63,0.3)] z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <Icon className={`w-4 h-4 relative z-10 ${activeTab === id ? 'text-[#0f172a]' : 'text-slate-400'}`} />
      <span className="relative z-10">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row h-full bg-transparent overflow-hidden text-slate-900 font-sans">
      
      {/* Mobile Nav Bar */}
      <div className="md:hidden bg-white/60 backdrop-blur-xl border-b border-white/40 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 p-3 min-w-max">
          {[
            { id: 'general-network', label: 'Network', icon: Wifi },
            { id: 'general-workspace', label: 'Workspace', icon: LayoutDashboard },
            { id: 'hardware', label: 'Hardware', icon: Printer },
            { id: 'tv-behaviors', label: 'TV Behaviors', icon: MonitorSpeaker },
            { id: 'tv-layout', label: 'TV Layout', icon: LayoutTemplate },
            { id: 'tv-media', label: 'Promo Media', icon: Play },
            { id: 'pos-config', label: 'POS Config', icon: MessageSquare },
            { id: 'backup', label: 'Backup', icon: Database }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold transition-all active:scale-95 ${
                  isActive 
                    ? 'text-[#0f172a]' 
                    : 'bg-white/40 text-slate-600 border border-white/40'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-0 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] rounded-full shadow-md z-0"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className={`w-3.5 h-3.5 relative z-10 ${isActive ? 'text-[#0f172a]' : 'text-slate-400'}`} />
                <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-white/20 flex-col shrink-0 overflow-y-auto hidden md:flex">
        <div className="p-5 pb-3">
          <h2 className="text-[22px] font-bold text-slate-900 tracking-tight">Settings</h2>
        </div>
        <nav className="flex-1 px-3 space-y-6 pb-6">
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">System</h3>
            <div className="space-y-0.5">
              {renderNavButton('general-network', 'Network & Sync', Wifi)}
              {renderNavButton('general-workspace', 'Workspace', LayoutDashboard)}
              {renderNavButton('hardware', 'Hardware & Printers', Printer)}
              {renderNavButton('backup', 'Backup & Restore', Database)}
            </div>
          </div>
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Order TV</h3>
            <div className="space-y-0.5">
              {renderNavButton('tv-behaviors', 'Behaviors', MonitorSpeaker)}
              {renderNavButton('tv-layout', 'Layout', LayoutTemplate)}
              {renderNavButton('tv-media', 'Promo Media', Play)}
            </div>
          </div>
          <div>
            <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">POS Config</h3>
            <div className="space-y-0.5">
              {renderNavButton('pos-config', 'Quick Notes & Discounts', MessageSquare)}
            </div>
          </div>
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 bg-transparent overflow-y-auto w-full pb-20 md:pb-0">
        <div className="max-w-3xl mx-auto p-4 md:p-12 pb-32">
          {activeTab === 'general-network' && renderNetworkSync()}
          {activeTab === 'general-workspace' && renderWorkspace()}
          {activeTab === 'hardware' && renderHardware()}
          {activeTab === 'tv-behaviors' && renderTvBehaviors()}
          {activeTab === 'tv-layout' && renderTvLayout()}
          {activeTab === 'tv-media' && renderTvMedia()}
          {activeTab === 'pos-config' && renderPosConfig()}
          {activeTab === 'backup' && renderBackupSettings()}
        </div>
      </main>
    </div>
  );
};
