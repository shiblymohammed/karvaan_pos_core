import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useTableStore } from './useTableStore';
import { useKdsStore } from './useKdsStore';
import { socket } from '../services/socket';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  category?: string;
  addons?: { id: string; name: string; price: number }[];
  status: 'NEW' | 'SENT';
}

export interface ParkedOrder {
  id: string;
  name: string;
  items: CartItem[];
  tableId?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  orderType?: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  deliveryAddress?: string;
  deliveryFee?: number;
  timestamp: string;
  deliveryStatus?: string | null;
  collectedMethod?: string | null;
}

interface CartState {
  items: CartItem[];
  selectedTableId: string | null;
  selectedTableName: string | null;
  selectedWaiter: string | null;
  discount: number;
  heldOrders: ParkedOrder[];
  isOffline: boolean;
  customer: { name: string; phone: string } | null;
  orderType: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  deliveryAddress: string;
  deliveryFee: number;
  deliveryStatus: string | null;
  collectedMethod: string | null;
  
  // Actions
  addItem: (product: { id: string; name: string; price: number; category?: string }, notes?: string, addons?: { id: string; name: string; price: number }[]) => void;
  removeItemByIndex: (index: number) => void;
  updateQuantityByIndex: (index: number, delta: number) => void;
  updateItemNoteByIndex: (index: number, notes: string) => void;
  setTable: (id: string | null, name: string | null) => void;
  setWaiter: (name: string | null) => void;
  setDiscount: (amount: number) => void;
  setOrderType: (type: 'DINE_IN' | 'PARCEL' | 'DELIVERY') => void;
  setDeliveryAddress: (address: string) => void;
  setDeliveryFee: (fee: number) => void;
  holdCurrentOrder: (label?: string) => void;
  sendKot: () => void;
  resumeOrder: (parkedId: string) => void;
  clearCart: () => void;
  toggleOffline: () => void;
  setCustomer: (customer: { name: string; phone: string } | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedTableId: null,
      selectedTableName: null,
      selectedWaiter: null,
      discount: 0,
      heldOrders: [],
      isOffline: !navigator.onLine,
      customer: null,
      orderType: 'DINE_IN' as const,
      deliveryAddress: '',
      deliveryFee: 0,
      deliveryStatus: null,
      collectedMethod: null,

  addItem: (product, notes, addons) => {
    set((state) => {
      // If there are notes or addons, we treat it as a unique line item so they don't stack directly with standard items
      const hasCustomizations = !!notes || (addons && addons.length > 0);
      
      const existing = state.items.find(
        (i) => i.productId === product.id && i.notes === notes && JSON.stringify(i.addons) === JSON.stringify(addons) && i.status === 'NEW'
      );

      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id && i.notes === notes && JSON.stringify(i.addons) === JSON.stringify(addons) && i.status === 'NEW'
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            notes,
            category: product.category,
            addons,
            status: 'NEW',
          },
        ],
      };
    });
  },

  removeItemByIndex: (index) => {
    set((state) => ({
      items: state.items.filter((_, idx) => idx !== index),
    }));
  },

  updateQuantityByIndex: (index, delta) => {
    set((state) => {
      const updated = state.items
        .map((item, idx) => {
          if (idx === index) {
            return { ...item, quantity: item.quantity + delta };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
      return { items: updated };
    });
  },

  updateItemNoteByIndex: (index, notes) => {
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], notes };
      }
      return { items: newItems };
    });
  },

  setTable: (id, name) => {
    set({ selectedTableId: id, selectedTableName: name });
  },

  setWaiter: (name) => {
    set({ selectedWaiter: name });
  },

  setDiscount: (amount) => {
    set({ discount: Math.max(0, amount) });
  },

  setOrderType: (type) => {
    set({ orderType: type, selectedTableId: null, selectedTableName: null });
  },

  setDeliveryAddress: (address) => {
    set({ deliveryAddress: address });
  },

  setDeliveryFee: (fee) => {
    set({ deliveryFee: fee });
  },

  holdCurrentOrder: (label) => {
    const state = get();
    if (state.items.length === 0) return;

    const subtotal = state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (state.selectedTableId) {
      useTableStore.getState().setTableStatus(state.selectedTableId, 'OCCUPIED', subtotal);
    }

    const newParked: ParkedOrder = {
      id: `PARK-${Date.now()}`,
      name: label || state.selectedTableName || `Order #${state.heldOrders.length + 1}`,
      items: [...state.items],
      tableId: state.selectedTableId,
      tableName: state.selectedTableName,
      waiterName: state.selectedWaiter,
      customerName: state.customer?.name,
      orderType: state.orderType,
      deliveryAddress: state.deliveryAddress,
      deliveryFee: state.deliveryFee,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHeldOrders = [newParked, ...state.heldOrders.filter(o => o.tableId !== state.selectedTableId || !state.selectedTableId)];

    set({
      heldOrders: nextHeldOrders,
      items: [],
      selectedTableId: null,
      selectedTableName: null,
      selectedWaiter: null,
      customer: null,
      discount: 0,
    });

    // Broadcast parked orders to all other devices
    socket.emit('sync_parked_orders', nextHeldOrders);
  },

  sendKot: () => {
    const state = get();
    if (state.items.length === 0) return;

    const newItems = state.items.filter(i => i.status === 'NEW');
    if (newItems.length > 0) {
      useKdsStore.getState().addTicket({
        id: `kot-${Date.now()}`,
        orderNumber: `KOT-${Math.floor(Math.random() * 9000)}`,
        tableNumber: state.orderType === 'DINE_IN'
          ? (state.selectedTableName || 'Takeaway')
          : (state.orderType === 'PARCEL' ? '📦 Parcel' : '🛵 Delivery'),
        orderType: state.orderType,
        customerName: state.customer?.name,
        items: newItems.map(i => {
          const addonText = i.addons && i.addons.length > 0 ? ` [Add: ${i.addons.map(a => a.name).join(', ')}]` : '';
          return { name: i.name, quantity: i.quantity, notes: (i.notes || '') + addonText, status: 'COOKING' };
        }),
        firedAt: new Date().toISOString()
      });
    }

    // Mark all items as sent and hold the order
    set({
      items: state.items.map(i => ({ ...i, status: 'SENT' }))
    });

    get().holdCurrentOrder();
  },

  resumeOrder: (parkedId) => {
    const state = get();
    const target = state.heldOrders.find((o) => o.id === parkedId);
    if (!target) return;

    // If current cart has items, hold them first
    if (state.items.length > 0) {
      state.holdCurrentOrder('Auto Parked');
    }

    const nextHeldOrders = state.heldOrders.filter((o) => o.id !== parkedId);

    set({
      items: target.items,
      selectedTableId: target.tableId || null,
      selectedTableName: target.tableName || null,
      selectedWaiter: target.waiterName || null,
      customer: target.customerName ? { name: target.customerName, phone: '' } : null,
      orderType: target.orderType || 'DINE_IN',
      deliveryAddress: target.deliveryAddress || '',
      deliveryFee: target.deliveryFee || 0,
      deliveryStatus: target.deliveryStatus || null,
      collectedMethod: target.collectedMethod || null,
      heldOrders: nextHeldOrders,
    });

    // Broadcast that this order is no longer parked
    socket.emit('sync_parked_orders', nextHeldOrders);
  },

  clearCart: () => {
    set((state) => {
      useKdsStore.getState().clearTableTickets(state.selectedTableName || 'Takeaway');
      return { items: [], selectedTableId: null, selectedTableName: null, selectedWaiter: null, customer: null, discount: 0, orderType: 'DINE_IN', deliveryAddress: '', deliveryFee: 0, deliveryStatus: null, collectedMethod: null };
    });
  },

  toggleOffline: () => {
    set((state) => ({ isOffline: !state.isOffline }));
  },

  setCustomer: (customer) => {
    set({ customer });
  },
}), { name: 'pos-cart-storage' }));

// Listen to browser network changes for automatic offline mode toggling
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => useCartStore.setState({ isOffline: true }));
  window.addEventListener('online', () => useCartStore.setState({ isOffline: false }));
}
