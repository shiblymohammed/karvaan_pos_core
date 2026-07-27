import { create } from 'zustand';

export interface PaidAddon {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface AddonState {
  addons: PaidAddon[];
  addAddon: (addon: Omit<PaidAddon, 'id'>) => void;
  updateAddon: (id: string, updates: Partial<PaidAddon>) => void;
  deleteAddon: (id: string) => void;
  getActiveAddons: () => PaidAddon[];
}

export const useAddonStore = create<AddonState>((set, get) => ({
  addons: [
    { id: 'a1', name: 'Extra Mayonnaise', price: 20, isActive: true },
    { id: 'a2', name: 'Extra Cheese Slice', price: 30, isActive: true },
    { id: 'a3', name: 'Peri Peri Dip', price: 15, isActive: true },
    { id: 'a4', name: 'Double Patty', price: 120, isActive: true },
    { id: 'a5', name: 'Hazelnut Syrup', price: 40, isActive: true },
  ],
  
  addAddon: (newAddon) => set((state) => ({
    addons: [...state.addons, { ...newAddon, id: `addon-${Date.now()}` }]
  })),

  updateAddon: (id, updates) => set((state) => ({
    addons: state.addons.map(a => a.id === id ? { ...a, ...updates } : a)
  })),

  deleteAddon: (id) => set((state) => ({
    addons: state.addons.filter(a => a.id !== id)
  })),

  getActiveAddons: () => get().addons.filter(a => a.isActive)
}));
