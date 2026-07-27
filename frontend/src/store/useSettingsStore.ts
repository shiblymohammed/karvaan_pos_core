import { create } from 'zustand';

export interface PredefinedNote {
  id: string;
  label: string;
  icon?: string;
}

export interface PredefinedDiscount {
  id: string;
  label: string;
  amount: number;
  type: 'PERCENTAGE' | 'FLAT';
}

interface SettingsState {
  notes: PredefinedNote[];
  discounts: PredefinedDiscount[];
  
  addNote: (note: Omit<PredefinedNote, 'id'>) => void;
  deleteNote: (id: string) => void;
  
  addDiscount: (discount: Omit<PredefinedDiscount, 'id'>) => void;
  deleteDiscount: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  notes: [
    { id: 'n1', label: 'Extra Spicy', icon: '🔥' },
    { id: 'n2', label: 'Less Spicy', icon: '🌶️' },
    { id: 'n3', label: 'No Onion/Garlic', icon: '🚫' },
    { id: 'n4', label: 'Less Ice', icon: '🧊' },
    { id: 'n5', label: 'Extra Cheese', icon: '🧀' },
    { id: 'n6', label: 'Jain Prep', icon: '🌱' },
  ],
  discounts: [
    { id: 'd1', label: 'Staff Discount (10%)', amount: 10, type: 'PERCENTAGE' },
    { id: 'd2', label: 'VIP (15%)', amount: 15, type: 'PERCENTAGE' },
    { id: 'd3', label: 'Manager Comp (100%)', amount: 100, type: 'PERCENTAGE' },
    { id: 'd4', label: 'Zomato Gold (₹100 Flat)', amount: 100, type: 'FLAT' },
  ],

  addNote: (newNote) => set((state) => ({
    notes: [...state.notes, { ...newNote, id: `note-${Date.now()}` }]
  })),

  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter(n => n.id !== id)
  })),

  addDiscount: (newDiscount) => set((state) => ({
    discounts: [...state.discounts, { ...newDiscount, id: `discount-${Date.now()}` }]
  })),

  deleteDiscount: (id) => set((state) => ({
    discounts: state.discounts.filter(d => d.id !== id)
  }))
}));
