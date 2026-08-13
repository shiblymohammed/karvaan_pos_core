import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Delete, AlertTriangle } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { quickUnlock, currentUser, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);

  // Security States
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  const [numLockOn, setNumLockOn] = useState<boolean | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lockout Timer
  useEffect(() => {
    if (lockoutUntil) {
      const interval = setInterval(() => {
        const left = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (left <= 0) {
          setLockoutUntil(null);
          setFailedAttempts(0);
          setLockoutTimeLeft(0);
        } else {
          setLockoutTimeLeft(left);
        }
      }, 1000);
      // Run once immediately
      setLockoutTimeLeft(Math.ceil((lockoutUntil - Date.now()) / 1000));
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  const triggerHaptic = useCallback((type: 'tap' | 'error' = 'tap') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'tap') navigator.vibrate(40);
      else if (type === 'error') navigator.vibrate([200, 100, 200]);
    }
  }, []);

  const handleKeyPress = useCallback((digit: string) => {
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    if (pin.length < 4 && !error) {
      const newPin = pin + digit;
      setPin(newPin);
      triggerHaptic('tap');
      
      if (newPin.length === 4) {
        const success = quickUnlock(newPin);
        if (!success) {
          setError(true);
          triggerHaptic('error');
          
          setFailedAttempts((prev) => {
            const next = prev + 1;
            if (next >= 5) {
              setLockoutUntil(Date.now() + 30000);
            }
            return next;
          });

          setTimeout(() => {
            setPin('');
            setError(false);
          }, 1000);
        } else {
          setFailedAttempts(0);
        }
      }
    }
  }, [pin, error, lockoutUntil, triggerHaptic, quickUnlock]);

  const handleDelete = useCallback(() => {
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    if (!error && pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
      triggerHaptic('tap');
    }
  }, [pin, error, lockoutUntil, triggerHaptic]);

  // Physical Keyboard Support
  useEffect(() => {
    const handleKeyEvent = (e: KeyboardEvent) => {
      // Update NumLock state whenever any key is pressed or released
      setNumLockOn(e.getModifierState('NumLock'));

      // Only process actual inputs on keydown to prevent double-firing
      if (e.type === 'keyup') return;

      // Ignore if a modal is open or locked out
      if (showLogoutConfirm || lockoutUntil) return;
      
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDelete();
      } else if (e.key === 'Escape') {
        setShowLogoutConfirm(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyEvent);
    window.addEventListener('keyup', handleKeyEvent);
    
    return () => {
      window.removeEventListener('keydown', handleKeyEvent);
      window.removeEventListener('keyup', handleKeyEvent);
    };
  }, [handleKeyPress, handleDelete, showLogoutConfirm, lockoutUntil]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-[100] overflow-hidden select-none touch-none bg-gradient-to-br from-[#f4faec] via-white to-[#e8f5d6] p-2 md:p-12 lg:p-20">
      
      {/* Decorative Ambient Gradient Orbs (Hardware Accelerated) */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] md:w-[800px] md:h-[800px] bg-[#8cc63f]/20 blur-[100px] md:blur-[130px] rounded-full pointer-events-none z-0 translate-x-1/4 -translate-y-1/4 fixed transform-gpu will-change-transform"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] md:w-[600px] md:h-[600px] bg-[#8cc63f]/15 blur-[100px] md:blur-[120px] rounded-full pointer-events-none z-0 -translate-x-1/4 translate-y-1/4 fixed transform-gpu will-change-transform"></div>

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 md:gap-24 lg:gap-32 z-10">
        
        {/* Left Side: Logo, Clock, User Info */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left w-full md:w-1/2 md:max-w-none">
          
          {/* Logo */}
          <img 
            src="/logo/karvaan_logo_dark.png" 
            alt="Karvaan POS" 
            className="h-8 md:h-14 lg:h-16 drop-shadow-[0_4px_12px_rgba(0,0,0,0.05)] pointer-events-none mb-4 md:mb-16" 
          />
          
          {/* Clock */}
          <div className="mb-4 md:mb-16 md:ml-2">
            <h2 className="text-[3rem] md:text-7xl lg:text-[5.5rem] font-light text-slate-800 tracking-tight drop-shadow-sm leading-none">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h2>
            <p className="text-[#78ad33] text-[10px] md:text-base font-bold mt-1 md:mt-4 tracking-widest uppercase">
              {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>

          {/* Profile Avatar & Welcome */}
          <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-6 bg-white/60 border border-white md:bg-transparent md:border-transparent rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-0 shadow-sm md:shadow-none w-full md:w-auto backdrop-blur-md md:backdrop-blur-none">
            <div className="w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-[#8cc63f] to-[#5a8222] flex items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(140,198,63,0.3),inset_0_2px_4px_rgba(255,255,255,0.3)] relative md:ml-2">
              <span className="text-xl md:text-3xl font-bold text-white drop-shadow-sm">{getInitials(currentUser?.name)}</span>
              {error && !lockoutUntil && (
                <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping"></div>
              )}
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 mb-0.5 md:mb-1.5 tracking-tight">Welcome back</h1>
              <p className="text-slate-500 text-[10px] md:text-sm font-medium tracking-widest uppercase">
                {lockoutUntil ? <span className="text-rose-500 flex items-center gap-1 justify-center md:justify-start"><AlertTriangle className="h-3 md:h-4 w-3 md:w-4" /> Terminal Locked</span> : 'Enter PIN to unlock'}
              </p>
            </div>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4 mt-12 ml-1">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer px-6 py-3 rounded-full hover:bg-black/5 border border-transparent hover:border-black/5 uppercase tracking-widest shadow-sm"
            >
              Switch User
            </button>
            <button
              onClick={() => setShowForgotPin(true)}
              className="text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer px-6 py-3 rounded-full hover:bg-black/5 border border-transparent uppercase tracking-widest"
            >
              Forgot PIN?
            </button>
          </div>

        </div>

        {/* Right Side: Keypad */}
        <div className="flex flex-col items-center w-full md:w-1/2 max-w-[280px] md:max-w-[360px] shrink-0">
          
          {/* PIN Indicators */}
          <div className={`flex justify-center gap-3 md:gap-5 mb-4 md:mb-8 w-full ${error ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 ${
                  pin.length > i
                    ? 'bg-[#8cc63f] shadow-[0_0_12px_rgba(140,198,63,0.6)] scale-110'
                    : 'bg-black/10 border border-black/5'
                } ${error && !lockoutUntil ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] border-transparent' : ''}`}
              />
            ))}
          </div>

          {/* Num Lock Indicator */}
          <div className={`h-6 md:h-8 mb-2 md:mb-4 transition-all duration-300 flex items-center justify-center ${numLockOn === false ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            {numLockOn === false && (
              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                <AlertTriangle className="h-3 md:h-3.5 w-3 md:w-3.5" /> Num Lock Off
              </div>
            )}
          </div>

          {/* Keypad or Lockout Message */}
          {lockoutUntil ? (
            <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-2xl md:rounded-[2rem] p-6 md:p-8 text-center shadow-sm animate-in fade-in zoom-in duration-300">
              <AlertTriangle className="h-10 w-10 md:h-16 md:w-16 text-rose-500 mb-4 md:mb-6 drop-shadow-sm" />
              <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-1 md:mb-2">Too Many Attempts</h3>
              <p className="text-rose-600 text-xs md:text-sm mb-4 md:mb-6">Terminal locked.</p>
              <div className="text-3xl md:text-4xl font-black text-rose-500 font-mono tracking-widest">
                00:{lockoutTimeLeft.toString().padStart(2, '0')}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 md:gap-5 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeyPress(digit.toString())}
                  className="h-14 md:h-auto md:aspect-square rounded-xl md:rounded-[1.25rem] bg-white/60 hover:bg-white active:bg-slate-100 border border-black/5 hover:border-black/10 text-2xl md:text-4xl font-medium text-slate-800 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation backdrop-blur-md"
                >
                  {digit}
                </button>
              ))}
              <div className="h-14 md:h-auto md:aspect-square"></div>
              <button
                onClick={() => handleKeyPress('0')}
                className="h-14 md:h-auto md:aspect-square rounded-xl md:rounded-[1.25rem] bg-white/60 hover:bg-white active:bg-slate-100 border border-black/5 hover:border-black/10 text-2xl md:text-4xl font-medium text-slate-800 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 touch-manipulation backdrop-blur-md"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="h-14 md:h-auto md:aspect-square rounded-xl md:rounded-[1.25rem] bg-transparent hover:bg-black/5 active:bg-rose-50 active:text-rose-600 border border-transparent text-xl font-semibold text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 touch-manipulation"
              >
                <Delete className="h-5 w-5 md:h-7 md:w-7" />
              </button>
            </div>
          )}

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center justify-center gap-2 mt-4 w-full">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer px-4 py-2.5 rounded-full hover:bg-black/5 border border-transparent hover:border-black/5 uppercase tracking-widest shadow-sm"
            >
              Switch User
            </button>
            <button
              onClick={() => setShowForgotPin(true)}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer px-4 py-2.5 rounded-full hover:bg-black/5 border border-transparent uppercase tracking-widest"
            >
              Forgot PIN?
            </button>
          </div>
        </div>

      </div>

      {/* Forgot PIN Modal */}
      {showForgotPin && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl p-6 md:p-8 max-w-[320px] w-full shadow-2xl border border-white text-center animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
            {/* Subtle Orb Inside Modal */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#8cc63f]/10 blur-[30px] rounded-full pointer-events-none z-0"></div>
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#8cc63f]/10 border border-[#8cc63f]/20 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-[#8cc63f]" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Forgot PIN?</h3>
              <p className="text-slate-500 text-xs md:text-sm mb-6 leading-relaxed">
                For security purposes, automated PIN recovery is disabled on POS terminals. Please ask your Manager or System Administrator to reset your PIN.
              </p>
              <button 
                onClick={() => setShowForgotPin(false)} 
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8cc63f] to-[#78ad33] text-white font-bold text-sm hover:from-[#9cda45] hover:to-[#83be36] transition-all shadow-[0_4px_12px_rgba(140,198,63,0.3)] active:scale-95"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl p-6 md:p-8 max-w-[320px] w-full shadow-2xl border border-white text-center animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
            {/* Subtle Orb Inside Modal */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-rose-500/10 blur-[30px] rounded-full pointer-events-none z-0"></div>
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Switch User?</h3>
              <p className="text-slate-500 text-xs md:text-sm mb-6 leading-relaxed">
                This will securely end your current session and return you to the main login screen.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowLogoutConfirm(false)} 
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors border border-slate-200 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={logout} 
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold hover:from-rose-400 hover:to-rose-500 transition-all shadow-[0_4px_12px_rgba(244,63,94,0.3)] border border-rose-400/50 active:scale-95"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
