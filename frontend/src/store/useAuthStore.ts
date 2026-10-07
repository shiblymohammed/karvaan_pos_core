import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getServerUrl } from '../services/serverConfig';

interface AuthState {
  currentUser: any | null; // Has {id, name, role, restaurantId}
  accessToken: string | null;
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
      isLocked: false,
      loginTime: null,

      fullLogin: async (username: string, password?: string, pin?: string) => {
        try {
          const res = await fetch(`${getServerUrl()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, pin }),
          });
          
          if (!res.ok) return false;
          
          const data = await res.json();
          set({
            currentUser: data.user,
            accessToken: data.accessToken,
            isLocked: false,
            loginTime: Date.now(),
          });
          return true;
        } catch (e) {
          console.error('Login failed', e);
          return false;
        }
      },

      quickUnlock: async (pin: string) => {
        try {
          const res = await fetch(`${getServerUrl()}/auth/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, userId: get().currentUser?.id }),
          });
          
          if (!res.ok) return false;
          
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
        set({ currentUser: null, accessToken: null, isLocked: false, loginTime: null });
      },

      validateToken: async () => {
        const token = get().accessToken;
        if (!token) return false;

        try {
          const res = await fetch(`${getServerUrl()}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!res.ok) {
            get().logout();
            return false;
          }
          
          const user = await res.json();
          // Update user details (in case role changed)
          set({ currentUser: user });
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
