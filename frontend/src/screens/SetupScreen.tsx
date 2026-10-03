import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff, Check, X, Loader2, Smartphone,
  AlertCircle, Server, QrCode, Copy, RefreshCw, ArrowRight, Monitor, ChevronRight
} from 'lucide-react';
import { getServerUrl, setServerUrl, probeServer, getOperatingMode, setOperatingMode, OperatingMode } from '../services/serverConfig';
import { getMasterServerUrl } from '../services/localServer';
import QRCode from 'qrcode';

type ProbeStatus = 'idle' | 'probing' | 'ok' | 'fail';

interface SetupScreenProps {
  onComplete: () => void;
}

const IPDisplay = () => {
  const [ip, setIp] = useState('Starting server...');
  useEffect(() => {
    const int = setInterval(() => {
      const url = getMasterServerUrl();
      if (url) {
        setIp(url);
        clearInterval(int);
      }
    }, 1000);
    return () => clearInterval(int);
  }, []);
  return <>{ip}</>;
};

// ─── QR Code Canvas ───────────────────────────────────────────────────────────
const QRCanvas: React.FC<{ value: string }> = ({ value }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: 180,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(console.error);
    }
  }, [value]);

  return <canvas ref={canvasRef} className="rounded-xl shadow-md" />;
};

// ─── Main Setup Screen ────────────────────────────────────────────────────────
export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [url, setUrl] = useState(getServerUrl());
  const [status, setStatus] = useState<ProbeStatus>('idle');
  const [latency, setLatency] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [networkIPs, setNetworkIPs] = useState<string[]>([]);

  const [opMode, setOpMode] = useState<OperatingMode>(getOperatingMode());
  const [masterIp, setMasterIp] = useState<string>('');

  // Try to auto-detect local IPs from backend on load
  useEffect(() => {
    fetch(`${getServerUrl()}/health`)
      .then(r => r.json())
      .then(d => { if (d.localIPs) setNetworkIPs(d.localIPs); })
      .catch(() => {});
      
    // If in capacitor, try to get IP
    if ((window as any).Capacitor) {
      import('@capacitor/network').then(({ Network }) => {
        // network plugin doesn't give local IP easily in all versions, 
        // but we'll mock it or use an alternative if available
      }).catch(() => {});
    }
  }, []);

  const handleProbe = async () => {
    if (!url.trim()) return;
    setStatus('probing');
    setErrorMsg('');
    const result = await probeServer(url);
    setLatency(result.latencyMs);
    if (result.ok) {
      setStatus('ok');
    } else {
      setStatus('fail');
      setErrorMsg('Could not reach the server. Check IP and make sure the backend is running.');
    }
  };

  const [isConnecting, setIsConnecting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleSave = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setOperatingMode(opMode);
      if (opMode !== 'ANDROID_MASTER') {
        let finalUrl = url.trim().replace(/\/$/, '');
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
          finalUrl = `http://${finalUrl}`;
        }
        setServerUrl(finalUrl);
      }
      setIsConnecting(false);
      setShowWelcome(true);
    }, 800);
  };

  const handleSkip = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setOperatingMode('NODE_SERVER');
      setIsConnecting(false);
      setShowWelcome(true);
    }, 800);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const presets = [
    { label: 'This PC', value: 'http://localhost:3001' },
    { label: 'Home Router', value: 'http://192.168.1.100:3001' },
    { label: 'Alt Router', value: 'http://192.168.0.100:3001' },
  ];

  return (
    <div className="absolute inset-0 w-full h-[100dvh] flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-sm selection:bg-emerald-500 selection:text-white font-sans z-50">
      
      {/* Main Setup Card (Light Glassmorphic Modal) */}
      <div className="relative w-full max-w-[540px] max-h-[95dvh] flex flex-col bg-white/95 backdrop-blur-3xl border border-white/50 rounded-[24px] sm:rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.15)] z-10 transition-all duration-700 overflow-hidden">
        
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center text-center p-10 sm:p-14 animate-in zoom-in-95 duration-500 flex-1 bg-white">
            <div className="w-20 h-20 bg-emerald-100 rounded-[24px] flex items-center justify-center mb-6 shadow-inner border border-emerald-200">
              <Check className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2 tracking-tight">You're all set!</h2>
            <p className="text-slate-500 font-bold mb-10 max-w-xs text-sm">
              Your terminal is successfully connected and ready to use in the Karvaan ecosystem.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-4 bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-400/30 border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:shadow-[0_8px_20px_rgba(16,185,129,0.3)] focus-visible:ring-emerald-500/50 hover:-translate-y-0.5 active:scale-[0.96] text-white rounded-[16px] font-black text-sm sm:text-base flex items-center justify-center shadow-md transition-all duration-300 relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <span className="drop-shadow-sm z-10">Get Started</span>
              <ArrowRight className="h-5 w-5 z-10 ml-2 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        ) : (
          <>
            {/* Branding Header */}
            <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 flex flex-col items-center text-center border-b border-slate-100 bg-white/50 relative shrink-0">
              <img src="/logo/karvaan_logo_dark.png" alt="Karvaan POS" className="h-10 sm:h-12 object-contain mb-3 drop-shadow-sm" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Network Setup</h1>
              <p className="text-slate-500 font-bold mt-1.5 text-xs max-w-[280px]">
                Connect to the local Karvaan ecosystem.
              </p>
            </div>

            {/* Scrollable Content Area */}
            <div className="p-5 sm:p-8 flex flex-col bg-slate-50/50 overflow-y-auto no-scrollbar flex-1">
              
              {/* Mode Selection */}
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1">Setup Mode</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-5">
                {/* Standard PC Button */}
                <button 
                  onClick={() => setOpMode('NODE_SERVER')}
                  className={`group relative p-3 rounded-2xl border-2 transition-all duration-300 active:scale-[0.96] flex flex-col items-start gap-2 overflow-hidden focus-visible:outline-none focus-visible:ring-4 ${
                    opMode === 'NODE_SERVER' || opMode === 'WAITER_CLIENT'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400/30 border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 shadow-[0_8px_24px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/30 text-white' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:-translate-y-0.5 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 transition-colors ${opMode === 'NODE_SERVER' ? 'bg-white/20 text-white shadow-inner' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div className="text-left z-10">
                    <p className={`font-black text-sm ${opMode === 'NODE_SERVER' ? 'text-white' : 'text-slate-800'}`}>Standard PC</p>
                    <p className={`text-[9px] font-bold mt-0.5 ${opMode === 'NODE_SERVER' ? 'text-emerald-100' : 'text-slate-500'}`}>Connect to backend</p>
                  </div>
                  {opMode === 'NODE_SERVER' && <Check className="h-4 w-4 absolute top-3 right-3 text-white drop-shadow-md" />}
                </button>

                {/* Android Master Mode Button */}
                <button 
                  onClick={() => setOpMode('ANDROID_MASTER')}
                  className={`group relative p-3 rounded-2xl border-2 transition-all duration-300 active:scale-[0.96] flex flex-col items-start gap-2 overflow-hidden focus-visible:outline-none focus-visible:ring-4 ${
                    opMode === 'ANDROID_MASTER'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-transparent shadow-[0_8px_16px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/30' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:-translate-y-0.5 shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 transition-colors ${opMode === 'ANDROID_MASTER' ? 'bg-white/20 text-white shadow-inner' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="text-left z-10">
                    <p className={`font-black text-sm ${opMode === 'ANDROID_MASTER' ? 'text-white' : 'text-slate-800'}`}>Tablet Master</p>
                    <p className={`text-[9px] font-bold mt-0.5 ${opMode === 'ANDROID_MASTER' ? 'text-blue-100' : 'text-slate-500'}`}>Host the network</p>
                  </div>
                  {opMode === 'ANDROID_MASTER' && <Check className="h-4 w-4 absolute top-3 right-3 text-white drop-shadow-md" />}
                </button>
              </div>

              {/* Dynamic Content: Standard Mode */}
              {opMode !== 'ANDROID_MASTER' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col gap-4">
                  
                  {/* Modern Input */}
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-100 rounded-lg text-slate-400 group-focus-within:text-emerald-500 group-focus-within:bg-emerald-50 transition-colors">
                      <Server className="h-4 w-4" />
                    </div>
                    <input
                      type="url"
                      value={url}
                      onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
                      onKeyDown={e => e.key === 'Enter' && handleProbe()}
                      placeholder="http://192.168.1.100:3001"
                      className="w-full pl-[3.5rem] pr-[100px] py-3.5 bg-white border-2 border-slate-200 rounded-[16px] text-slate-800 font-black text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
                    />
                    <button 
                      onClick={handleProbe} 
                      disabled={status === 'probing' || !url.trim()} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-100 hover:bg-emerald-500 text-slate-500 hover:text-white font-black text-[11px] rounded-[10px] transition-all active:scale-[0.96] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {status === 'probing' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                      <span className="hidden sm:inline">Test</span>
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="h-8 flex items-center">
                    {status === 'ok' && (
                      <div className="flex items-center gap-2 text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm animate-in zoom-in duration-300">
                        <Check className="h-4 w-4" />
                        <span className="text-[11px] font-black tracking-wide">Connected ({latency}ms)</span>
                      </div>
                    )}
                    {status === 'fail' && (
                      <div className="flex items-center gap-2 text-rose-600 bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 shadow-sm animate-in zoom-in duration-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="text-[11px] font-black tracking-wide truncate">{errorMsg || "Connection Failed"}</span>
                      </div>
                    )}
                  </div>

                  {/* Presets Grid */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Quick Presets</p>
                    <div className="flex flex-wrap gap-2">
                      {presets.map(p => (
                        <button key={p.value}
                          onClick={() => { setUrl(p.value); setStatus('idle'); }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all active:scale-[0.96] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 ${
                            url === p.value
                              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50'
                          }`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* QR Code Toggle */}
                  <div className="mt-2 border-2 border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-500 group">
                    <button
                      onClick={() => setShowQR(!showQR)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:bg-slate-100"
                    >
                      <div className="flex items-center gap-3 text-xs sm:text-sm font-black text-slate-700">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600 group-hover:scale-110 transition-transform"><QrCode className="h-4 w-4" /></div>
                        Configure Waiter Tablet
                      </div>
                      <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${showQR ? 'rotate-90' : ''}`} />
                    </button>

                    {showQR && (
                      <div className="border-t-2 border-slate-100 px-4 py-5 bg-slate-50 flex flex-col items-center animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-bold text-slate-500 mb-3 text-center max-w-[200px]">
                          Scan to set up connection automatically.
                        </p>
                        <div className="bg-white p-3 rounded-[16px] shadow-xl border border-slate-200 mb-4 scale-90 sm:scale-100 transform origin-center">
                          <QRCanvas value={url} />
                        </div>
                        <button onClick={() => handleCopy(url)} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] sm:text-xs font-black text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm active:scale-[0.96] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          {copied ? 'Copied' : 'Copy Link'}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* Dynamic Content: Android Master Mode */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border-2 border-blue-100 p-6 rounded-[24px] text-center shadow-sm relative overflow-hidden flex-1 flex flex-col justify-center">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                  
                  <div className="w-16 h-16 bg-blue-50 rounded-[16px] mx-auto flex items-center justify-center text-blue-500 mb-4 border border-blue-100 shadow-inner">
                    <Smartphone className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Tablet Host Active</h3>
                  <p className="text-xs font-bold text-slate-500 mb-6 max-w-xs mx-auto">
                    This device is acting as the central server for all Waiter apps and KDS displays. Keep the app open.
                  </p>
                  
                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Your Network IP</p>
                     <p className="text-2xl font-black text-blue-600 tracking-tight drop-shadow-sm">
                        <IPDisplay />
                     </p>
                  </div>
                </div>
              )}
              
            </div>
              
            {/* Bottom Actions */}
            <div className="p-5 sm:p-8 pt-4 bg-white/50 border-t border-slate-100 shrink-0">
              <div className="flex flex-row gap-3">
                <button 
                  onClick={handleSkip} 
                  disabled={isConnecting}
                  className="px-5 py-3.5 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-[16px] font-black text-xs flex items-center justify-center transition-all active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 shadow-sm disabled:opacity-50 disabled:active:scale-100 w-24"
                >
                  Localhost
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={(status !== 'ok' && url !== 'http://localhost:3001' && !url.includes('localhost')) || isConnecting}
                  className={`flex-1 py-3.5 text-white rounded-[16px] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 tracking-wide focus-visible:outline-none focus-visible:ring-2 relative overflow-hidden shadow-md group ${
                    opMode === 'ANDROID_MASTER' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 border border-blue-400/30 border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:shadow-[0_8px_20px_rgba(59,130,246,0.3)] focus-visible:ring-blue-500/50' 
                      : 'bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-400/30 border-t-white/30 border-l-white/20 border-b-black/20 border-r-black/20 hover:shadow-[0_8px_20px_rgba(16,185,129,0.3)] focus-visible:ring-emerald-500/50'
                  } hover:-translate-y-0.5 active:scale-[0.96] disabled:hover:translate-y-0 disabled:opacity-50 disabled:grayscale-[50%] disabled:active:scale-100 disabled:shadow-none`}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  {isConnecting ? (
                    <Loader2 className="h-5 w-5 animate-spin z-10" />
                  ) : (
                    <>
                      <span className="drop-shadow-sm z-10">{opMode === 'ANDROID_MASTER' ? 'Start Host' : 'Connect'}</span> 
                      <ArrowRight className="h-4 w-4 z-10 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-center text-[10px] font-bold text-slate-400 mt-4">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono text-slate-500">Enter</kbd> to quickly connect
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
