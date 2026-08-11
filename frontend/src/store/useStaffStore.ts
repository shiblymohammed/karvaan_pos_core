import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket, emitAction } from '../services/socket';

export interface StaffPermissions {
  canVoid: boolean;
  canDiscount: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  password?: string;
  email?: string;
  phone?: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DELIVERY';
  pin: string;
  isActive: boolean;
  permissions?: StaffPermissions;
}

interface StaffState {
  staff: StaffMember[];
  addStaff: (staff: Omit<StaffMember, 'id'>) => void;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaff: (id: string) => void;
  getActiveWaiters: () => StaffMember[];
  getDeliveryRiders: () => StaffMember[];
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => ({
      staff: [
        { id: 'admin-1', name: 'Super Admin', username: 'admin', password: 'admin123', email: 'admin@karvaan.com', role: 'ADMIN', pin: '9999', isActive: true, permissions: { canVoid: true, canDiscount: true } },
        { id: 's1', name: 'John Doe', username: 'john_cashier', password: 'password123', phone: '9876543210', role: 'CASHIER', pin: '1234', isActive: true, permissions: { canVoid: false, canDiscount: true } },
        { id: 's2', name: 'Sarah (Waiter)', username: 'sarah_w', password: 'password123', phone: '9876543211', role: 'WAITER', pin: '1111', isActive: true },
        { id: 's3', name: 'Alex (Waiter)', username: 'alex_w', password: 'password123', phone: '9876543212', role: 'WAITER', pin: '2222', isActive: true },
      ],
      
      addStaff: (newStaff) => {
        set((state) => ({
          staff: [...state.staff, { ...newStaff, id: `staff-${Date.now()}` }]
        }));
        emitAction('sync_staff', get().staff);
      },

      updateStaff: (id, updates) => {
        set((state) => ({
          staff: state.staff.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
        emitAction('sync_staff', get().staff);
      },

      deleteStaff: (id) => {
        set((state) => ({
          staff: state.staff.filter(s => s.id !== id)
        }));
        emitAction('sync_staff', get().staff);
      },

      getActiveWaiters: () => get().staff.filter(s => s.role === 'WAITER' && s.isActive),

      getDeliveryRiders: () => get().staff.filter(s => s.role === 'DELIVERY' && s.isActive),
    }),
    { name: 'pos-staff-storage' }
  )
);

