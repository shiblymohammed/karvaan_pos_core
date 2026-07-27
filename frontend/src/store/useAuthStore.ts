import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStaffStore, StaffMember } from './useStaffStore';

interface AuthState {
  currentUser: StaffMember | null;
  isLocked: boolean;
  fullLogin: (username: string, password?: string) => boolean;
  quickUnlock: (pin: string) => boolean;
  lockTerminal: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null, // Starts fully logged out
      isLocked: false,

  fullLogin: (username: string, password?: string) => {
    const staffMembers = useStaffStore.getState().staff;
    const user = staffMembers.find(s => s.username === username && s.password === password && s.isActive);
    if (user) {
      set({ currentUser: user, isLocked: false });
      return true;
    }
    return false;
  },

  quickUnlock: (pin: string) => {
    const { currentUser } = get();
    if (currentUser && currentUser.pin === pin) {
      set({ isLocked: false });
      return true;
    }
    return false;
  },

  lockTerminal: () => {
    if (get().currentUser) {
      set({ isLocked: true });
    }
  },

  logout: () => {
    set({ currentUser: null, isLocked: false });
  },
}), { name: 'pos-auth-storage' }));
