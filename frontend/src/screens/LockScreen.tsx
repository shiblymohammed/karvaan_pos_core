import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, Delete } from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { quickUnlock, currentUser, logout } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (pin.length === 4) {
      const success = quickUnlock(pin);
      if (!success) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 1000);
      }
    }
  }, [pin, quickUnlock]);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4 && !error) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (!error) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 bg-pos-bg flex flex-col items-center justify-center z-50">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-glow-accent">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-pos-text mb-2">Terminal Locked</h1>
        <p className="text-pos-text-muted font-bold text-sm">Welcome back, {currentUser?.name}</p>
        <p className="text-xs text-pos-text-muted/60 mt-1 uppercase tracking-widest">Enter PIN to Unlock</p>
      </div>

      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              pin.length > i
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110'
                : 'bg-pos-border'
            } ${error ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : ''}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-rose-500 font-bold mb-4 animate-pulse">Invalid PIN. Try again.</p>
      )}

      <div className="grid grid-cols-3 gap-4 max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            onClick={() => handleKeyPress(digit.toString())}
            className="w-20 h-20 rounded-2xl bg-pos-card border border-pos-border text-2xl font-black text-pos-text flex items-center justify-center hover:bg-pos-card-hover active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            {digit}
          </button>
        ))}
        <div className="w-20 h-20"></div>
        <button
          onClick={() => handleKeyPress('0')}
          className="w-20 h-20 rounded-2xl bg-pos-card border border-pos-border text-2xl font-black text-pos-text flex items-center justify-center hover:bg-pos-card-hover active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-20 h-20 rounded-2xl bg-pos-card border border-pos-border text-xl font-black text-pos-text-muted flex items-center justify-center hover:bg-pos-card-hover hover:text-rose-500 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>

      <div className="mt-12 text-center">
        <button
          onClick={logout}
          className="text-xs font-bold text-pos-text-muted hover:text-emerald-500 transition-colors uppercase tracking-widest border-b border-transparent hover:border-emerald-500 pb-1 cursor-pointer"
        >
          Not you? Switch User
        </button>
      </div>
    </div>
  );
};
