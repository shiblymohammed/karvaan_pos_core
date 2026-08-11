import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket, emitAction } from '../services/socket';

export type OrderType = 'DINE_IN' | 'PARCEL' | 'DELIVERY';
export type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  isAvailable: boolean;
  totalDeliveries: number;
  activeOrderId?: string;
}

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
  paymentMethod?: 'CASH' | 'UPI' | 'CARD'; // collected at delivery
  collectedAmount?: number;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  waiterName?: string;
  placedAt: string;
  updatedAt: string;
}

interface DeliveryState {
  deliveryBoys: DeliveryBoy[];
  orders: DeliveryOrder[];

  // Delivery Boy management
  addDeliveryBoy: (boy: Omit<DeliveryBoy, 'id' | 'totalDeliveries' | 'isAvailable'>) => void;
  updateDeliveryBoy: (id: string, data: Partial<DeliveryBoy>) => void;
  toggleDeliveryBoyActive: (id: string) => void;

  // Order management
  addOrder: (order: Omit<DeliveryOrder, 'id' | 'orderNumber' | 'placedAt' | 'updatedAt'>) => DeliveryOrder;
  updateOrderStatus: (id: string, status: DeliveryStatus) => void;
  collectPayment: (id: string, method: 'CASH' | 'UPI' | 'CARD', amount: number) => void;
  assignDeliveryBoy: (orderId: string, deliveryBoyId: string, deliveryBoyName?: string) => void;
  removeOrder: (id: string) => void;
}

const INITIAL_DELIVERY_BOYS: DeliveryBoy[] = [
  { id: 'db-1', name: 'Rahul Kumar', phone: '9876543210', isActive: true, isAvailable: true, totalDeliveries: 47 },
  { id: 'db-2', name: 'Ajay Singh', phone: '9876543211', isActive: true, isAvailable: true, totalDeliveries: 32 },
  { id: 'db-3', name: 'Ravi Verma', phone: '9876543212', isActive: true, isAvailable: true, totalDeliveries: 18 },
];

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      deliveryBoys: INITIAL_DELIVERY_BOYS,
      orders: [],

      addDeliveryBoy: (boy) => {
        const newBoy: DeliveryBoy = {
          ...boy,
          id: `db-${Date.now()}`,
          isAvailable: true,
          totalDeliveries: 0,
        };
        set((state) => ({ deliveryBoys: [newBoy, ...state.deliveryBoys] }));
      },

      updateDeliveryBoy: (id, data) => {
        set((state) => ({
          deliveryBoys: state.deliveryBoys.map((b) => b.id === id ? { ...b, ...data } : b),
        }));
      },

      toggleDeliveryBoyActive: (id) => {
        set((state) => ({
          deliveryBoys: state.deliveryBoys.map((b) =>
            b.id === id ? { ...b, isActive: !b.isActive } : b
          ),
        }));
      },

      addOrder: (orderData) => {
        const orderNum = `ORD-${Date.now().toString().slice(-5)}`;
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

        const order = get().orders.find((o) => o.id === id);
        if (order) {
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
        const boy = get().deliveryBoys.find((b) => b.id === deliveryBoyId);
        const name = deliveryBoyName || boy?.name || 'Assigned Rider';

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, deliveryBoyId, deliveryBoyName: name, status: 'OUT_FOR_DELIVERY', updatedAt: new Date().toISOString() }
              : o
          ),
          deliveryBoys: state.deliveryBoys.map((b) =>
            b.id === deliveryBoyId
              ? { ...b, isAvailable: false, activeOrderId: orderId }
              : b
          ),
        }));
        emitAction('sync_delivery_orders', get().orders);
      },

      removeOrder: (id) => {
        // Free up the delivery boy if assigned
        const order = get().orders.find((o) => o.id === id);
        if (order?.deliveryBoyId) {
          set((state) => ({
            deliveryBoys: state.deliveryBoys.map((b) =>
              b.id === order.deliveryBoyId
                ? { ...b, isAvailable: true, activeOrderId: undefined, totalDeliveries: b.totalDeliveries + 1 }
                : b
            ),
          }));
        }
        set((state) => ({ orders: state.orders.filter((o) => o.id !== id) }));
        emitAction('sync_delivery_orders', get().orders);
      },
    }),
    { name: 'pos-delivery-storage' }
  )
);

