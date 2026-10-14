import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA or native Tauri
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      !!(window as any).__TAURI__;

    if (isStandalone) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If iOS Safari and not installed, show after 3 seconds
    if (isIosDevice && !isStandalone) {
      const dismissed = sessionStorage.getItem('karvaan_pwa_ios_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => setShowIOSTip(true), 3000);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSTip(false);
    sessionStorage.setItem('karvaan_pwa_ios_dismissed', 'true');
  };

  if (!showPrompt && !showIOSTip) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-white animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-lime-600 to-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-lime-500/20">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight text-white">Install Karvaan POS App</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              {showIOSTip
                ? "Tap Share (⎙) and select 'Add to Home Screen' for full-screen POS."
                : "Install as a native full-screen app for zero latency and offline access."}
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!showIOSTip && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 py-2 px-3 rounded-xl bg-lime-500 hover:bg-lime-400 active:scale-95 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-lime-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
};
