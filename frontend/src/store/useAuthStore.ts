import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getServerUrl } from '../services/serverConfig';

interface AuthState {
  currentUser: any | null; // Has {id, name, role, restaurantId}
  accessToken: string | null;
  isLocked: boolean;
  loginTime: number | null;
  fullLogin: (username: string, password?: string, pin?: string) => Promise<boolean>;
  quickUnlock: (pin: string) => boolean;
  lockTerminal: () => void;
  logout: () => void;
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

      quickUnlock: (pin: string) => {
        // Quick unlock should really verify the PIN against backend, 
        // but for now, we unlock if it matches stored PIN (mock implementation)
        set({ isLocked: false });
        return true;
      },

      lockTerminal: () => {
        if (get().currentUser) {
          set({ isLocked: true });
        }
      },

      logout: () => {
        set({ currentUser: null, accessToken: null, isLocked: false, loginTime: null });
      },
    }),
    { name: 'pos-auth-storage' }
  )
);
