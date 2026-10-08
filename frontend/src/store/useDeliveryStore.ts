import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { socket, emitAction } from '../services/socket';
import { useSettingsStore } from './useSettingsStore';

export type OrderType = 'DINE_IN' | 'PARCEL' | 'DELIVERY';
export type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';



export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  orderType: 'PARCEL' | 'DELIVERY';
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
  subtotal: number;
  grandTotal: number;
  status: DeliveryStatus;
  paymentStatus: 'PENDING' | 'COLLECTED';  // COD = PENDING until collected at door
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'PREPAID'; // collected at delivery
  collectedAmount?: number;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  waiterName?: string;
  placedAt: string;
  updatedAt: string;
}

interface DeliveryState {
  orders: DeliveryOrder[];

  // Order management
  addOrder: (order: Omit<DeliveryOrder, 'id' | 'placedAt' | 'updatedAt'> & { orderNumber?: string }) => DeliveryOrder;
  updateOrderStatus: (id: string, status: DeliveryStatus) => void;
  collectPayment: (id: string, method: 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'PREPAID', amount: number) => void;
  assignDeliveryBoy: (orderId: string, deliveryBoyId: string, deliveryBoyName?: string) => void;
  removeOrder: (id: string) => void;
  removeOrders: (ids: string[]) => void;
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      orders: [],

      addOrder: (orderData) => {
        const prefix = useSettingsStore.getState().orderPrefix;
        const orderNum = orderData.orderNumber || `${prefix}-${Date.now().toString().slice(-5)}`;
        const newOrder: DeliveryOrder = {
          ...orderData,
          id: `dord-${Date.now()}`,
          orderNumber: orderNum,
          placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ orders: [newOrder, ...state.orders] }));
        emitAction('sync_delivery_orders', get().orders);
        return newOrder;
      },

      updateOrderStatus: (id, status) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o
          ),
        }));
        emitAction('sync_delivery_orders', get().orders);
      },

      collectPayment: (id, method, amount) => {
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id
              ? { ...o, paymentStatus: 'COLLECTED', paymentMethod: method, collectedAmount: amount, status: 'DELIVERED', updatedAt: new Date().toISOString() }
              : o
          ),
        }));
        emitAction('sync_delivery_orders', get().orders);

        // Build a "completed" parked entry so FOH can see it settled
        const order = get().orders.find((o) => o.id === id);
        if (order) {
          import('./useKdsStore').then(({ useKdsStore }) => {
            useKdsStore.getState().clearTableTickets(order.orderNumber);
          });
          import('./cartStore').then(({ useCartStore }) => {
            const currentHeld = useCartStore.getState().heldOrders;
            const completedParked = {
              id: `park-del-${order.id}`,
              name: `${order.orderNumber} (Delivery)`,
              items: order.items.map((i, idx) => ({
                productId: `prod-del-${idx}`,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                status: 'SENT' as const,
              })),
              tableId: null,
              tableName: '🛵 Delivery Completed',
              customerName: order.customerName,
              orderType: 'DELIVERY' as const,
              deliveryAddress: order.deliveryAddress,
              deliveryFee: order.deliveryFee,
              timestamp: order.placedAt || new Date().toLocaleTimeString(),
              deliveryStatus: 'COLLECTED',
              collectedMethod: method,
            };
            const nextHeld = [completedParked, ...currentHeld.filter(o => o.id !== `park-del-${order.id}`)];
            useCartStore.setState({ heldOrders: nextHeld });
            emitAction('sync_parked_orders', nextHeld);
          });
        }
      },

      assignDeliveryBoy: (orderId, deliveryBoyId, deliveryBoyName?: string) => {
        const name = deliveryBoyName || 'Assigned Rider';

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, deliveryBoyId, deliveryBoyName: name, status: 'OUT_FOR_DELIVERY', updatedAt: new Date().toISOString() }
              : o
          ),
        }));
        emitAction('sync_delivery_orders', get().orders);
      },

      removeOrder: (id) => {
        set((state) => ({ orders: state.orders.filter((o) => o.id !== id) }));
        emitAction('sync_delivery_orders', get().orders);
      },

      removeOrders: (ids) => {
        set((state) => ({ orders: state.orders.filter((o) => !ids.includes(o.id)) }));
        emitAction('sync_delivery_orders', get().orders);
      },
    }),
    { name: 'pos-delivery-storage', storage: createJSONStorage(() => tenantStorage) }
  )
);

