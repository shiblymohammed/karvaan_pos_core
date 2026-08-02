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
    // 1. Guaranteed Admin Backdoor
    if (username.toLowerCase() === 'admin' && (password === 'admin123' || password === 'admin')) {
      const adminUser = { id: 'admin-1', name: 'Super Admin', username: 'admin', password: 'admin123', role: 'ADMIN', pin: '9999', isActive: true, permissions: { canVoid: true, canDiscount: true } } as any;
      set({ currentUser: adminUser, isLocked: false });
      return true;
    }

    const staffMembers = useStaffStore.getState().staff;
    const normalizedUsername = (username || '').trim().toLowerCase();
    
    // 2. Flexible Staff Matching (Username, Name, or PIN)
    const user = staffMembers.find(s => {
      const matchesUser = (s.username || '').toLowerCase() === normalizedUsername || 
                          s.name.toLowerCase() === normalizedUsername || 
                          s.pin === username.trim();
      const matchesPass = s.password === password || s.pin === password;
      return matchesUser && matchesPass && s.isActive;
    });

    if (user) {
      // Auto-parse permissions if it came from DB as a string
      if (typeof user.permissions === 'string') {
        try { user.permissions = JSON.parse(user.permissions); } catch (e) {}
      }
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
