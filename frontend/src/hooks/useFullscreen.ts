import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that manages fullscreen mode and dynamic theme-color for Chrome-like browsers.
 * 
 * - Dynamically updates <meta name="theme-color"> based on the current screen
 * - On first user interaction (tap/click), requests native Fullscreen API
 * - Tracks fullscreen state reactively
 */

// Screen-to-color mapping
const THEME_COLORS = {
  app: '#8cc63f',        // Karvaan green — main app screens
  login: '#0f172a',      // Dark — login/lock screens  
  setup: '#0f172a',      // Dark — setup screen
} as const;

type ThemeContext = keyof typeof THEME_COLORS;

export function useFullscreen(context: ThemeContext = 'app') {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update theme-color meta tag dynamically
  const setThemeColor = useCallback((color: string) => {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.setAttribute('content', color);
    } else {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, []);

  // Request fullscreen via the Fullscreen API
  const requestFullscreen = useCallback(async () => {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy — fail silently
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      }
    } catch {
      // Ignore
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      requestFullscreen();
    }
  }, [isFullscreen, requestFullscreen, exitFullscreen]);

  // Track fullscreen state changes
  useEffect(() => {
    const handleChange = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(fs);
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, []);

  // Prevent browser back button from navigating away
  useEffect(() => {
    // Push an initial dummy state so there's something to "go back" to
    window.history.pushState({ karvaan: true }, '', window.location.href);

    const handlePopState = () => {
      // Re-push state to trap the back button
      window.history.pushState({ karvaan: true }, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Dynamically update theme-color whenever the context changes
  useEffect(() => {
    setThemeColor(THEME_COLORS[context]);
  }, [context, setThemeColor]);

  // Auto-request fullscreen on first user interaction (mobile Chrome)
  useEffect(() => {
    const handler = () => {
      requestFullscreen();
      // Only try once
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };

    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });

    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [requestFullscreen]);

  return {
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
    toggleFullscreen,
    setThemeColor,
  };
}
