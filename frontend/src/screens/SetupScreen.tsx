import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff, Check, X, Loader2, Smartphone,
  AlertCircle, Server, QrCode, Copy, RefreshCw, ArrowRight
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

  const handleSave = () => {
    setOperatingMode(opMode);
    if (opMode !== 'ANDROID_MASTER') {
      let finalUrl = url.trim().replace(/\/$/, '');
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `http://${finalUrl}`;
      }
      setServerUrl(finalUrl);
    }
    window.location.reload();
  };

  const handleSkip = () => {
    setOperatingMode('NODE_SERVER');
    onComplete();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const presets = [
    { label: 'This PC (Default)', value: 'http://localhost:3001' },
    { label: 'Common Home Router IP', value: 'http://192.168.1.100:3001' },
    { label: 'Common Alt Router IP', value: 'http://192.168.0.100:3001' },
  ];

  return (
    <div className="min-h-screen bg-pos-bg flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-pos-accent to-teal-600 flex items-center justify-center font-black text-white text-3xl shadow-glow-accent mb-4">
            K
          </div>
          <h1 className="text-3xl font-black text-pos-text">Network Setup</h1>
          <p className="text-pos-text-muted font-bold mt-2">
            Configure how this device connects to the POS network.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="bg-pos-card p-6 rounded-3xl border border-pos-border shadow-sm mb-6">
          <label className="block text-sm font-black text-pos-text uppercase tracking-wider mb-3">
            Operating Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setOpMode('NODE_SERVER')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                opMode === 'NODE_SERVER' || opMode === 'WAITER_CLIENT'
                  ? 'border-emerald-500 bg-emerald-50/10 shadow-glow-accent'
                  : 'border-pos-border bg-pos-bg hover:border-pos-accent/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Server className={`h-5 w-5 ${opMode === 'NODE_SERVER' ? 'text-emerald-500' : 'text-pos-text-muted'}`} />
                <span className="font-bold text-pos-text">Standard (Node Server)</span>
              </div>
              <p className="text-xs text-pos-text-muted font-semibold">Connect to a Windows PC or Waiter Client</p>
            </button>
            
            <button
              onClick={() => setOpMode('ANDROID_MASTER')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                opMode === 'ANDROID_MASTER'
                  ? 'border-blue-500 bg-blue-50/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'border-pos-border bg-pos-bg hover:border-blue-500/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className={`h-5 w-5 ${opMode === 'ANDROID_MASTER' ? 'text-blue-500' : 'text-pos-text-muted'}`} />
                <span className="font-bold text-pos-text">Android Master</span>
              </div>
              <p className="text-xs text-pos-text-muted font-semibold">This tablet hosts the local network</p>
            </button>
          </div>
        </div>

        {opMode !== 'ANDROID_MASTER' ? (
        <div className="bg-pos-card rounded-2xl border border-pos-border shadow-lg p-6 space-y-6">

          {/* Server URL Input */}
          <div>
            <label className="block text-xs font-black text-pos-text-muted uppercase tracking-wider mb-2">
              Backend Server URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
                  placeholder="http://192.168.1.100:3001"
                  className="w-full pl-9 pr-3 py-3 bg-pos-input border border-pos-border rounded-xl text-pos-text font-bold focus:outline-none focus:border-pos-accent text-sm shadow-inner"
                />
              </div>
              <button onClick={handleProbe} disabled={status === 'probing' || !url.trim()}
                className="px-4 py-3 bg-pos-accent hover:opacity-90 text-white font-black rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 text-sm">
                {status === 'probing'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Wifi className="h-4 w-4" />}
                Test
              </button>
            </div>

            {/* Status */}
            {status === 'ok' && (
              <div className="flex items-center gap-2 mt-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-bold">Connected! Latency: {latency}ms</span>
              </div>
            )}
            {status === 'fail' && (
              <div className="flex items-start gap-2 mt-2 text-rose-500">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-sm font-bold">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <p className="text-xs font-black text-pos-text-muted uppercase tracking-wider mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button key={p.value}
                  onClick={() => { setUrl(p.value); setStatus('idle'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                    url === p.value
                      ? 'bg-pos-accent text-white border-pos-accent'
                      : 'bg-pos-sidebar border-pos-border text-pos-text-muted hover:border-pos-accent hover:text-pos-text'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* QR Code section — for Cashier PC to show so tablets can scan */}
          <div className="border border-pos-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-pos-bg transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-sm font-black text-pos-text">
                <QrCode className="h-4 w-4 text-purple-500" />
                Show QR Code for Tablet / Phone Setup
              </div>
              <ArrowRight className={`h-4 w-4 text-pos-text-muted transition-transform ${showQR ? 'rotate-90' : ''}`} />
            </button>

            {showQR && (
              <div className="border-t border-pos-border px-4 py-5 bg-pos-sidebar">
                <p className="text-xs font-bold text-pos-text-muted mb-4 text-center">
                  Scan this QR code on a tablet or phone to auto-configure it.
                </p>
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-lg">
                    <QRCanvas value={url} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-pos-text mb-1">{url}</p>
                    <button onClick={() => handleCopy(url)}
                      className="flex items-center gap-1.5 text-xs font-bold text-pos-text-muted hover:text-pos-text mx-auto cursor-pointer">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                </div>

                {/* How to use on phone */}
                <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Smartphone className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">How to configure a tablet or phone:</p>
                      <ol className="text-xs font-bold text-amber-700 dark:text-amber-400 space-y-0.5 list-decimal list-inside">
                        <li>Open the POS app on the tablet</li>
                        <li>It will show this Setup Screen automatically</li>
                        <li>Scan the QR code or enter the URL manually</li>
                        <li>Tap "Test" → then "Save & Connect"</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* What this device will be used as */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-black text-blue-700 dark:text-blue-300 mb-1">
                  {url === 'http://localhost:3001' || url.includes('localhost')
                    ? '🖥️ Single PC Mode — Backend runs on this machine'
                    : '📡 Multi-Terminal Mode — Connecting to remote server'}
                </p>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {url === 'http://localhost:3001' || url.includes('localhost')
                    ? 'All data stays on this PC. Best for single billing counter setup.'
                    : 'This device will sync orders and KDS in real-time with the cashier PC.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSkip}
              className="flex-1 py-3 bg-pos-bg hover:bg-pos-sidebar text-pos-text font-bold rounded-xl border border-pos-border transition-colors cursor-pointer text-sm">
              Skip (Use Localhost)
            </button>
            <button
              onClick={handleSave}
              disabled={status !== 'ok' && url !== 'http://localhost:3001' && !url.includes('localhost')}
              className="flex-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
              <Check className="h-4 w-4" /> Save & Connect
            </button>
          </div>
        </div>
        ) : (
          <div className="bg-pos-card p-6 rounded-3xl border border-pos-border shadow-sm">
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Smartphone className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-pos-text">Android Master Mode</h3>
                <p className="text-sm font-semibold text-pos-text-muted mt-2 max-w-md mx-auto">
                  This tablet is acting as the server.
                  <br/><br/>
                  <span className="text-amber-500 font-bold">Important: The app must stay open and the screen must stay on for waiters to send orders.</span>
                </p>
                <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                   <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 uppercase tracking-wider">Waiter Phone Connection URL</p>
                   <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                      {/* We could poll getMasterServerUrl() here, but for now we'll just display a dynamic prompt since the user already knows how to find it or we can just fetch it in useEffect */}
                      <IPDisplay />
                   </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                className="w-full mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-glow-accent cursor-pointer"
              >
                Restart / Refresh Server <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs font-bold text-pos-text-muted mt-4">
          You can change this anytime from Admin → Network Setup
        </p>
      </div>
    </div>
  );
};
