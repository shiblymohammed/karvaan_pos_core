import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { emitAction, ActionResult } from '../services/socket';
import { toast } from './useToastStore';
import { createId } from '../services/createId';
import { authorizedFetch } from '../services/authFetch';
import { getActionContext, sameContext } from '../services/offlineQueue';

export type OrderType = 'DINE_IN' | 'PARCEL' | 'DELIVERY';
export type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export interface DeliveryOrder {
  id: string; orderNumber: string; billNumber?: string; orderType: 'PARCEL' | 'DELIVERY';
  customerName: string; customerPhone: string; deliveryAddress?: string; deliveryFee?: number;
  items: Array<{ productId?: string; name: string; quantity: number; price: number; notes?: string; addons?: any[] }>;
  subtotal: number; discount?: number; grandTotal: number; status: DeliveryStatus;
  paymentStatus: 'PENDING' | 'COLLECTED'; paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'PREPAID';
  collectedAmount?: number; deliveryBoyId?: string; deliveryBoyName?: string; waiterName?: string;
  placedAt: string; updatedAt: string; revision?: number; pendingConfirmation?: boolean;
}
interface DeliveryState {
  orders: DeliveryOrder[];
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<DeliveryOrder, 'id' | 'placedAt' | 'updatedAt'> & { stockAuthorization?: string }) => Promise<ActionResult>;
  updateOrderStatus: (id: string, status: DeliveryStatus) => Promise<ActionResult>;
  collectPayment: (id: string, method: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'PREPAID', amount: number, tenders?: Record<string, number>) => Promise<ActionResult>;
  assignDeliveryBoy: (id: string, riderId: string, riderName?: string) => Promise<ActionResult>;
  removeOrder: (id: string) => Promise<ActionResult>;
  removeOrders: (ids: string[]) => Promise<void>;
}

export const useDeliveryStore = create<DeliveryState>()(persist((set, get) => {
  const update = async (id: string, changes: any): Promise<ActionResult> => {
    const row = get().orders.find(row => row.id === id);
    if (!row) return { status: 'ERROR', message: 'Delivery not found' };
    if (row.pendingConfirmation) return { status: 'QUEUED', message: 'Wait for the earlier delivery change to be confirmed.' };
    const payload = { id, ...changes, expectedRevision: row.revision || 0 };
    set({ orders: get().orders.map(item => item.id === id ? { ...item, pendingConfirmation: true } : item) });
    const result = await emitAction('update_delivery', payload);
    if (result.status === 'OK') set({ orders: get().orders.map(item => item.id === id && item.revision === row.revision ? { ...item, ...(changes.status ? { status: changes.status } : {}), ...(changes.riderId !== undefined ? { deliveryBoyId: changes.riderId, deliveryBoyName: changes.riderName } : {}), revision: (row.revision || 0) + 1, pendingConfirmation: false } : item) });
    if (result.status === 'ERROR') set({ orders: get().orders.map(item => item.id === id && item.revision === row.revision ? { ...item, pendingConfirmation: false } : item) });
    if (result.status === 'OK' && changes.archived) set({ orders: get().orders.filter(item => item.id !== id) });
    if (result.status === 'QUEUED') toast.info('Delivery change saved on this device; awaiting confirmation.');
    return result;
  };
  return {
    orders: [],
    fetchOrders: async () => {
      const context = getActionContext();
      const response = await authorizedFetch('/billing/deliveries');
      const rows = await response.json();
      if (!response.ok || !Array.isArray(rows)) throw new Error(rows?.message || 'Delivery board could not be refreshed');
      if (!sameContext(context, getActionContext())) throw new Error('The account changed while refreshing deliveries');
      set({ orders: rows });
    },
    addOrder: async order => {
      const id = get().orders.find(row => row.orderNumber === order.orderNumber)?.id || createId();
      const { stockAuthorization, ...displayOrder } = order;
      const row: DeliveryOrder = { ...displayOrder, id, placedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 0, pendingConfirmation: true, paymentStatus: 'PENDING' };
      set({ orders: [row, ...get().orders.filter(row => row.orderNumber !== order.orderNumber)] });
      const result = await emitAction('create_delivery', { ...order, id, billNumber: order.billNumber || `DEL-${order.orderNumber}` });
      if (result.status === 'ERROR') set({ orders: get().orders.filter(row => row.id !== id) });
      return result;
    },
    updateOrderStatus: (id, status) => update(id, { status }),
    assignDeliveryBoy: (id, riderId, riderName) => update(id, { riderId: riderId || null, riderName: riderName || null, status: riderId ? 'OUT_FOR_DELIVERY' : 'READY' }),
    collectPayment: async (id, method, amount, tenders) => {
      const order = get().orders.find(order => order.id === id);
      if (!order) return { status: 'ERROR', message: 'Delivery not found' };
      const result = await emitAction('collect_delivery_payment', { id, orderNumber: order.orderNumber, paymentMethod: method === 'PREPAID' ? order.paymentMethod || 'UPI' : method, amount, tenders, complete: true });
      if (result.status === 'QUEUED') toast.info('Payment saved on this device; awaiting the server before closing delivery.');
      return result;
    },
    removeOrder: id => update(id, { archived: true }),
    removeOrders: async ids => { for (const id of ids) await get().removeOrder(id); },
  };
}, { name: 'pos-delivery-storage', storage: createJSONStorage(() => tenantStorage) }));
