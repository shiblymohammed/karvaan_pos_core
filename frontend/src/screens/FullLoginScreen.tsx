import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, EyeOff, ArrowRight, Check, Loader2, Server, Wifi, RefreshCw, Edit3, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getServerUrl, setServerUrl, probeServer } from '../services/serverConfig';

export const FullLoginScreen: React.FC = () => {
  const { fullLogin } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Server health & switch modal state
  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [serverPing, setServerPing] = useState<number | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    checkServerHealth(serverUrl);
  }, [serverUrl]);

  const checkServerHealth = async (urlToCheck: string) => {
    try {
      const res = await probeServer(urlToCheck);
      setServerPing(res.ok ? res.latencyMs : -1);
    } catch {
      setServerPing(-1);
    }
  };

  const handleTestAndSaveServer = async () => {
    if (!customUrl.trim()) return;
    setIsTestingServer(true);
    setTestResult(null);
    try {
      const res = await probeServer(customUrl.trim());
      if (res.ok) {
        setServerUrl(customUrl.trim());
        setServerUrlState(customUrl.trim());
        setServerPing(res.latencyMs);
        setTestResult({ ok: true, msg: `Connected successfully (${res.latencyMs}ms)` });
        setTimeout(() => setShowServerModal(false), 800);
      } else {
        setTestResult({ ok: false, msg: 'Server unreachable at this address' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err?.message || 'Connection failed' });
    } finally {
      setIsTestingServer(false);
    }
  };

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-focus username on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      passwordRef.current?.focus();
    }
  };

  const triggerErrorShake = () => {
    setError(true);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setDebugInfo('');
    setIsLoading(true);

    try {
      const uTrimmed = username.trim();
      const pTrimmed = password.trim();
      let success = await fullLogin(uTrimmed, pTrimmed);
      if (!success && /^\d{4,8}$/.test(pTrimmed)) success = await fullLogin(uTrimmed, undefined, pTrimmed);
      if (!success) {
        triggerErrorShake();
      }
    } catch (err: any) {
      setDebugInfo(`ERROR: ${err?.message || String(err)}`);
      triggerErrorShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row justify-center lg:justify-end md:p-8 lg:p-16 relative overflow-y-auto overflow-x-hidden bg-white md:bg-transparent touch-pan-y pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      
      {/* Background Image (Desktop/Tablet) */}
      <div 
        className="absolute inset-0 hidden md:block z-0"
        style={{
          backgroundImage: 'url("/background/login_bg.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      ></div>

      {/* Background Effect: Dark gradient overlay (Laptops and Landscape Tablets) */}
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none z-0"></div>
      
      {/* Background Effect: Dark overlay for Portrait Tablets so card stands out */}
      <div className="absolute inset-0 hidden md:block lg:hidden bg-black/40 pointer-events-none z-0"></div>

      {/* Background Gradient Text & Logo (Visible on Laptop/Desktop on the left side) */}
      <div className="absolute left-12 lg:left-16 xl:left-24 2xl:left-32 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 z-0 max-w-[45vw]">
        {/* Brand Logo (Desktop) */}
        <div className="mb-4">
          <img 
            src="/logo/karvaan_logo_main.png" 
            alt="Karvaan POS" 
            className="h-14 xl:h-16 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)] pointer-events-none" 
          />
        </div>
        <h2 className="text-5xl xl:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#8cc63f] drop-shadow-2xl leading-tight">
          Next-Gen<br/>Restaurant<br/>Platform.
        </h2>
        <p className="text-white/90 text-lg xl:text-2xl font-semibold tracking-wide drop-shadow-lg max-w-lg mt-2">
          Zero latency. Total control. <br className="hidden xl:block" />The premium point of sale experience.
        </p>
      </div>
      
      {/* Background Effect: Subtle ambient color glow */}
      <div className="absolute inset-y-0 right-0 w-full md:w-1/2 bg-[#8cc63f]/15 blur-[100px] z-0 pointer-events-none mix-blend-screen hidden md:block"></div>

      {/* The Login Card / Native Full-Screen Mobile View */}
      <div className={`w-full max-w-[500px] md:max-w-[550px] lg:max-w-[650px] 2xl:max-w-[800px] md:w-[85vw] lg:w-[45vw] 2xl:w-[40vw] min-h-[100dvh] md:min-h-0 bg-gradient-to-br from-[#d0f0af] via-white to-white md:from-[#d0f0af]/90 md:via-white/90 md:to-white/80 backdrop-blur-3xl md:border border-white/60 shadow-none md:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15),0_0_40px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.02)] rounded-none md:rounded-[40px] px-6 py-8 sm:p-10 md:p-12 lg:p-16 2xl:p-20 z-10 flex flex-col justify-center m-auto lg:my-auto lg:mr-0 lg:-translate-y-4 relative transition-transform duration-500 select-none ${isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        
        {/* Logo Section (Mobile & Tablet Portrait Only) */}
        <div className="flex lg:hidden justify-center mb-6 md:mb-8 mt-2 md:mt-0 shrink-0">
          <img 
            src="/logo/karvaan_logo_dark.png" 
            alt="Karvaan POS" 
            className="h-10 md:h-12 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.05)] md:drop-shadow-[0_4px_10px_rgba(0,0,0,0.1)] pointer-events-none transform transition-transform hover:scale-105 duration-500" 
          />
        </div>

        {/* Welcome Text */}
        <div className="mb-6 md:mb-10 2xl:mb-12 text-center shrink-0">
          <h1 className="text-[26px] leading-tight sm:text-3xl md:text-4xl lg:text-5xl 2xl:text-6xl font-black text-[#1a2b3c] mb-1.5 md:mb-3 2xl:mb-4 tracking-tight">
            Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8cc63f] to-[#5a8222] drop-shadow-sm">Back</span>
          </h1>
          <p className="text-[#64748b] text-[14px] sm:text-base md:text-lg 2xl:text-xl font-medium leading-relaxed px-2 md:px-0">Sign in to Karvaan POS and start your shift.</p>
        </div>

        <form onSubmit={handleLogin} className="w-full max-w-xl mx-auto md:mx-0 space-y-5 md:space-y-6">
          {/* Email / Username Field */}
          <div>
            <label className="block text-[12px] md:text-sm font-bold text-[#334155] mb-1.5 md:mb-2 uppercase tracking-wider drop-shadow-sm ml-1 md:ml-0">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none">
                <Mail className="h-[20px] w-[20px] md:h-5 md:w-5 text-[#94a3b8] group-focus-within:text-[#8cc63f] transition-colors duration-300 drop-shadow-sm" strokeWidth={2.5} />
              </div>
              <input 
                ref={usernameRef}
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                placeholder="e.g. admin or waiter_1"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full pl-12 md:pl-14 2xl:pl-20 pr-4 md:pr-5 2xl:pr-8 py-4 md:py-4 2xl:py-6 bg-[#f8fafc] md:bg-white border border-[#cbd5e1] rounded-xl md:rounded-2xl 2xl:rounded-3xl text-[#0f172a] text-[16px] md:text-lg 2xl:text-xl font-bold focus:outline-none focus:border-[#8cc63f] focus:ring-[3px] focus:ring-[#8cc63f]/30 transition-all duration-300 shadow-sm md:shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] hover:bg-white hover:border-[#94a3b8] placeholder:text-[#94a3b8] placeholder:font-medium select-auto"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[12px] md:text-sm 2xl:text-base font-bold text-[#334155] mb-1.5 md:mb-2 2xl:mb-3 uppercase tracking-wider drop-shadow-sm ml-1 md:ml-0">Password / PIN</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 2xl:pl-6 flex items-center pointer-events-none">
                <Lock className="h-[20px] w-[20px] md:h-5 md:w-5 2xl:h-7 2xl:w-7 text-[#94a3b8] group-focus-within:text-[#8cc63f] transition-colors duration-300 drop-shadow-sm" strokeWidth={2.5} />
              </div>
              <input 
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="w-full pl-12 md:pl-14 2xl:pl-20 pr-12 md:pr-16 2xl:pr-20 py-4 md:py-4 2xl:py-6 bg-[#f8fafc] md:bg-white border border-[#cbd5e1] rounded-xl md:rounded-2xl 2xl:rounded-3xl text-[#0f172a] text-[16px] md:text-lg 2xl:text-xl font-bold focus:outline-none focus:border-[#8cc63f] focus:ring-[3px] focus:ring-[#8cc63f]/30 transition-all duration-300 shadow-sm md:shadow-[inset_0_2px_6px_rgba(0,0,0,0.02)] hover:bg-white hover:border-[#94a3b8] placeholder:text-[#94a3b8] placeholder:font-medium select-auto"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 md:pr-5 2xl:pr-6 flex items-center text-[#94a3b8] hover:text-[#475569] transition-colors duration-300 active:scale-95"
              >
                <EyeOff className="h-[20px] w-[20px] md:h-5 md:w-5 drop-shadow-sm" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Additional Elements */}
          <div className="flex items-center justify-between pt-1 md:pt-2">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group px-1"
              onClick={() => setRememberMe(!rememberMe)}
            >
              <div className={`w-5 h-5 rounded-[6px] border-[1.5px] md:border-2 flex items-center justify-center transition-all duration-200 ${rememberMe ? 'bg-[#8cc63f] border-[#8cc63f]' : 'bg-white border-[#cbd5e1] group-hover:border-[#94a3b8]'}`}>
                <Check className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${rememberMe ? 'scale-100' : 'scale-0'}`} strokeWidth={3} />
              </div>
              <span className="text-[#475569] group-hover:text-[#334155] transition-colors text-[14px] md:text-sm font-bold">Remember me</span>
            </div>
            <a href="#" className="text-[#8cc63f] hover:text-[#7ab036] text-[14px] md:text-sm font-bold transition-colors pr-1 active:opacity-70">Forgot password?</a>
          </div>

          {error && (
            <div className="text-rose-500 text-sm font-bold text-center md:text-left pt-2">
              <p className="animate-pulse bg-rose-50/80 border border-rose-200 py-3 px-4 rounded-xl">Invalid credentials. Please try again.</p>
              {debugInfo && (
                <p className="text-[10px] text-slate-400 mt-2 font-mono break-all px-2">{debugInfo}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isLoading}
            className="group w-full mt-6 md:mt-10 relative overflow-hidden py-4 bg-gradient-to-r from-[#8cc63f] to-[#78ad33] hover:from-[#7ab036] hover:to-[#6a982c] disabled:from-[#cbd5e1] disabled:to-[#94a3b8] disabled:cursor-not-allowed text-white font-black text-[16px] md:text-xl rounded-xl md:rounded-2xl transition-all duration-300 transform md:hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2 md:gap-3 shadow-[0_6px_20px_rgba(140,198,63,0.25)] md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_24px_rgba(140,198,63,0.4)] focus:outline-none focus:ring-4 focus:ring-[#8cc63f]/40 shrink-0"
          >
            {/* Shimmer effect overlay */}
            {!isLoading && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none hidden md:block"></div>}
            
            <span className="relative z-10 drop-shadow-sm md:drop-shadow-md tracking-wide">
              {isLoading ? 'Authenticating...' : 'Login to Shift'}
            </span>
            {isLoading ? (
              <Loader2 className="h-5 w-5 md:h-6 md:w-6 relative z-10 animate-spin drop-shadow-sm md:drop-shadow-md" strokeWidth={3} />
            ) : (
              <ArrowRight className="h-5 w-5 md:h-6 md:w-6 relative z-10 drop-shadow-sm md:drop-shadow-md transform transition-transform duration-300 md:group-hover:translate-x-1.5" strokeWidth={3} />
            )}
          </button>
        </form>

        {/* Server Connection Indicator */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                serverPing === null
                  ? 'bg-amber-400 animate-pulse'
                  : serverPing >= 0
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-bold text-[#475569] shrink-0">Server:</span>
            <span className="font-mono text-[11px] font-bold text-slate-700 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-lg truncate max-w-[180px] sm:max-w-[240px]">
              {serverUrl}
            </span>
            {serverPing !== null && serverPing >= 0 && (
              <span className="text-[10px] font-bold text-emerald-600 hidden sm:inline">
                {serverPing}ms
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setCustomUrl(serverUrl);
              setTestResult(null);
              setShowServerModal(true);
            }}
            className="text-[11px] font-extrabold text-[#78ad33] hover:text-[#5a8222] flex items-center gap-1 pl-2 shrink-0 cursor-pointer active:scale-95"
          >
            <Edit3 className="h-3 w-3" /> Change
          </button>
        </div>

        <div className="mt-3 mb-2 md:mb-0 flex items-center justify-between text-[#94a3b8] opacity-80 shrink-0 text-[10px] md:text-xs">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span className="font-bold uppercase tracking-wider">End-to-End Encrypted</span>
          </div>
          <span className="font-mono text-[10px]">v1.0.1</span>
        </div>

        {/* Server Switch Modal */}
        {showServerModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-4 text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Server className="h-4 w-4" />
                  </div>
                  <h3 className="font-black text-base text-slate-800">Backend Server URL</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 uppercase">
                  Server Address (HTTP / HTTPS)
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  placeholder="e.g. http://wq8ss.aiccloud.online"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]"
                />
                <p className="text-[11px] text-slate-500">
                  Default cloud server: <code className="font-bold text-slate-700">http://wq8ss.aiccloud.online</code>
                </p>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    testResult.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}
                >
                  {testResult.ok ? '✓ ' : '✗ '} {testResult.msg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTestAndSaveServer}
                  disabled={isTestingServer || !customUrl.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#8cc63f] to-[#78ad33] hover:from-[#7ab036] hover:to-[#6a982c] text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isTestingServer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  {isTestingServer ? 'Testing…' : 'Test & Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
