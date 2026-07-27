import React, { useState } from 'react';
import { ChefHat, LogIn, Lock } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const FullLoginScreen: React.FC = () => {
  const { fullLogin } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = fullLogin(username, password);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="h-screen w-full bg-pos-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-pos-card border border-pos-border rounded-3xl shadow-glass overflow-hidden flex flex-col items-center p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-glow-accent mb-6 rotate-3">
          <ChefHat className="text-white h-10 w-10 -rotate-3" />
        </div>
        <h1 className="text-3xl font-black text-pos-text mb-1 tracking-tight">Karvaan POS</h1>
        <p className="text-sm font-bold text-pos-text-muted mb-8 text-center">Secure Terminal Access</p>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-black text-pos-text-muted uppercase tracking-wider mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or john_cashier"
              className="w-full px-4 py-3 bg-pos-bg border border-pos-border rounded-xl text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-black text-pos-text-muted uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-pos-bg border border-pos-border rounded-xl text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              required
            />
          </div>

          {error && (
            <p className="text-rose-500 text-sm font-bold text-center mt-2 animate-pulse">
              Invalid credentials. Please try again.
            </p>
          )}

          <button 
            type="submit"
            className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-glow-accent active:scale-95 flex items-center justify-center gap-2"
          >
            <LogIn className="h-5 w-5" />
            Login to Shift
          </button>
        </form>
        
        <div className="mt-8 flex items-center justify-center gap-2 text-pos-text-muted">
          <Lock className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
};
