import { toast } from './useToastStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getServerUrl } from '../services/serverConfig';

interface AuthState {
  currentUser: any | null; // Has {id, name, role, restaurantId}
  accessToken: string | null;
  sessionServerUrl: string | null;
  isLocked: boolean;
  loginTime: number | null;
  fullLogin: (username: string, password?: string, pin?: string) => Promise<boolean>;
  quickUnlock: (pin: string) => Promise<boolean>;
  lockTerminal: () => void;
  logout: () => void;
  validateToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      accessToken: null,
      sessionServerUrl: null,
      isLocked: false,
      loginTime: null,

      fullLogin: async (username: string, password?: string, pin?: string) => {
        let server = getServerUrl().replace(/\/$/, '');
        if (server.includes('wq8ss.aiccloud.online') && server.startsWith('http://')) {
          server = server.replace('http://', 'https://');
        }
        const originalSession = localStorage.getItem('pos-auth-storage');
        try {
          const res = await fetch(`${server}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, pin }),
          });
          
          if (!res.ok) {
            let errorMsg = 'Invalid credentials';
            try {
              const errData = await res.json();
              if (errData?.message) errorMsg = errData.message;
            } catch {}
            toast.error(errorMsg);
            return false;
          }
          
          const data = await res.json();
          if (getServerUrl().replace(/\/$/, '') !== server || localStorage.getItem('pos-auth-storage') !== originalSession) return false;
          set({
            currentUser: data.user,
            accessToken: data.accessToken,
            sessionServerUrl: server,
            isLocked: false,
            loginTime: Date.now(),
          });
          return true;
        } catch (e: any) {
          console.error('Login failed', e);
          toast.error(`Connection Error: Unable to reach ${server} (${e?.message || 'Network error'})`);
          return false;
        }
      },

      quickUnlock: async (pin: string) => {
        const server = getServerUrl().replace(/\/$/, ''), token = get().accessToken;
        try {
          const res = await fetch(`${getServerUrl()}/auth/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${get().accessToken}` },
            body: JSON.stringify({ pin, userId: get().currentUser?.id }),
          });
          
          if (!res.ok) return false;
          if (token !== get().accessToken || token !== JSON.parse(localStorage.getItem('pos-auth-storage') || '{}').state?.accessToken || server !== getServerUrl().replace(/\/$/, '')) return false;
          
          set({ isLocked: false });
          return true;
        } catch (e) {
          console.error('Unlock failed', e);
          return false;
        }
      },

      lockTerminal: () => {
        if (get().currentUser) {
          set({ isLocked: true });
        }
      },

      logout: () => {
        set({ currentUser: null, accessToken: null, sessionServerUrl: null, isLocked: false, loginTime: null });
        window.location.href = '/';
      },

      validateToken: async () => {
        const server = getServerUrl().replace(/\/$/, '');
        const token = get().accessToken;
        if (!token) return false;
        if (get().sessionServerUrl && get().sessionServerUrl !== server) { get().logout(); return false; }

        try {
          const res = await fetch(`${getServerUrl()}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const savedToken = JSON.parse(localStorage.getItem('pos-auth-storage') || '{}').state?.accessToken;
          if (token !== get().accessToken || token !== savedToken || server !== getServerUrl().replace(/\/$/, '')) return false;
          
          if (!res.ok) {
            get().logout();
            return false;
          }
          
          const user = await res.json();
          if (token !== get().accessToken || token !== JSON.parse(localStorage.getItem('pos-auth-storage') || '{}').state?.accessToken || server !== getServerUrl().replace(/\/$/, '')) return false;
          // Update user details (in case role changed)
          set({ currentUser: user, sessionServerUrl: server });
          return true;
        } catch (e) {
          console.error('Token validation failed', e);
          // If offline, we might want to let them stay logged in, but for security we'll assume failure means logout if we can't verify.
          // In a true local-first POS, we might skip logout on NetworkError.
          return true; // Keep logged in on network error for offline POS support
        }
      },
    }),
    { name: 'pos-auth-storage' }
  )
);
