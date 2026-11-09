import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download } from 'lucide-react';
import { DEFAULT_URL } from '../services/serverConfig';

const downloadUrl = `${DEFAULT_URL}/downloads/latest.apk`;
const releaseUrl = `${DEFAULT_URL}/downloads/latest.json`;

/** The server updates the latest alias independently of the web app release. */
export function AndroidAppDownload({ onDownload }: { onDownload?: () => void }) {
  const [release, setRelease] = useState<{ version: string; testing: boolean } | null>(null);
  const visible = !Capacitor.isNativePlatform() && !(window as any).__TAURI__;

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    fetch(releaseUrl, { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!controller.signal.aborted && typeof data?.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(data.version)) {
          setRelease({ version: data.version, testing: data.buildType === 'debug' });
        }
      })
      .catch(() => { /* The direct download still works if metadata is unavailable. */ })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [visible]);

  if (!visible) return null;
  return <a
    href={downloadUrl}
    download="Karvaan-POS-latest.apk"
    onClick={onDownload}
    aria-label="Download Android app"
    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-left text-slate-900 transition-colors hover:border-lime-400 hover:bg-lime-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lime-700"><Download size={21} /></span>
    <span className="min-w-0">
      <span className="block text-sm font-extrabold">Download Android app</span>
      <span className="mt-0.5 block text-xs font-medium text-slate-600">
        {release ? `v${release.version} · ${release.testing ? 'Testing APK' : 'Android APK'}` : 'APK for Android tablets & phones'}
      </span>
    </span>
  </a>;
}
