import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { emitAction, ActionResult } from '../services/socket';
import { canEditConfig } from '../services/configSnapshot';
import { createId } from '../services/createId';

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
  role: 'ADMIN' | 'REST_ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DELIVERY';
  pin: string;
  isActive: boolean;
  permissions?: StaffPermissions;
}

interface StaffState {
  serverRevision: number;
  staff: StaffMember[];
  addStaff: (staff: Omit<StaffMember, 'id'>) => Promise<ActionResult>;
  updateStaff: (id: string, updates: Partial<StaffMember>) => Promise<ActionResult>;
  deleteStaff: (id: string) => Promise<ActionResult>;
  getActiveWaiters: () => StaffMember[];
  getDeliveryRiders: () => StaffMember[];
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => {
      const save = async (staff: StaffMember[]): Promise<ActionResult> => {
        const previous = get();
        if (!canEditConfig(previous.serverRevision)) return { status: 'ERROR', message: 'Load the current staff roster before editing.' };
        const expectedRevision = previous.serverRevision;
        set({ staff, serverRevision: expectedRevision + 1 });
        const result = await emitAction('sync_staff', { staff, expectedRevision });
        if (result.status === 'ERROR' && get().serverRevision === expectedRevision + 1 && get().staff === staff) set({ staff: previous.staff, serverRevision: expectedRevision });
        return result;
      };
      return {
      serverRevision: -1,
      staff: [],
      
      addStaff: newStaff => save([...get().staff, { ...newStaff, id: `staff-${createId()}` }]),
      updateStaff: (id, updates) => save(get().staff.map(staff => staff.id === id ? { ...staff, ...updates } : staff)),
      deleteStaff: id => save(get().staff.filter(staff => staff.id !== id)),

      getActiveWaiters: () => get().staff.filter(s => s.role === 'WAITER' && s.isActive),

      getDeliveryRiders: () => get().staff.filter(s => s.role === 'DELIVERY' && s.isActive),
    }; },
    { name: 'pos-staff-storage', storage: createJSONStorage(() => tenantStorage), partialize: state => ({ serverRevision: state.serverRevision, staff: state.staff.map(({ password, pin, ...member }) => ({ ...member, pin: '' })) }) }
  )
);

