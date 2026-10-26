import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { useTableStore } from './useTableStore';
import { useKdsStore } from './useKdsStore';
import { useSettingsStore } from './useSettingsStore';
import { useMenuStore } from './useMenuStore';
import { emitAction, ActionResult } from '../services/socket';
import { authorizedFetch } from '../services/authFetch';
import { toast } from './useToastStore';
import { createId } from '../services/createId';
import { getActionContext, contextIsCurrent } from '../services/offlineQueue';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  category?: string;
  addons?: { id: string; name: string; price: number }[];
  status: 'NEW' | 'SENT';
  isCombo?: boolean;
  comboItems?: string[];
}

export interface ParkedOrder {
  revision?: number;
  id: string;
  name: string;
  items: CartItem[];
  tableId?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  discount?: number;
  checkoutBillNumber?: string | null;
  orderVersion?: string | null;
  orderType?: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  orderNumber?: string | null;
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
  currentOrderNumber: string | null;
  checkoutBillNumber: string | null;
  orderVersion: string | null;
  deliveryAddress: string;
  deliveryFee: number;
  deliveryStatus: string | null;
  collectedMethod: string | null;
  
  // UI State
  isMobileCartOpen: boolean;
  isParking: boolean;
  isSendingKot: boolean;
  isResuming: boolean;
  
  // Actions
  setIsMobileCartOpen: (isOpen: boolean) => void;
  addItem: (product: { id: string; name: string; price: number; category?: string }, notes?: string, addons?: { id: string; name: string; price: number }[]) => void;
  removeItemByIndex: (index: number) => void;
  updateQuantityByIndex: (index: number, delta: number) => void;
  updateItemNoteByIndex: (index: number, notes: string) => void;
  updateItemAddonsByIndex: (index: number, addons: { id: string; name: string; price: number }[]) => void;
  setTable: (id: string | null, name: string | null) => void;
  setWaiter: (name: string | null) => void;
  setDiscount: (amount: number) => void;
  setOrderType: (type: 'DINE_IN' | 'PARCEL' | 'DELIVERY') => void;
  setDeliveryAddress: (address: string) => void;
  setDeliveryFee: (fee: number) => void;
  holdCurrentOrder: (label?: string, fromKitchen?: boolean) => Promise<boolean>;
  sendKot: () => Promise<ActionResult | undefined>;
  resumeOrder: (parkedId: string) => Promise<void>;
  clearCart: () => void;
  toggleOffline: () => void;
  setCustomer: (customer: { name: string; phone: string } | null) => void;
  transferCartTable: (fromTableId: string, toTableId: string, toTableName: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      currentOrderNumber: null,
      checkoutBillNumber: null,
      orderVersion: null,
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
      isMobileCartOpen: false,
      isParking: false,
      isSendingKot: false,
      isResuming: false,

      transferCartTable: (fromTableId, toTableId, toTableName) => {
        set((state) => ({
          heldOrders: state.heldOrders.map((o) =>
            o.tableId === fromTableId
              ? { ...o, tableId: toTableId, tableName: `Table ${toTableName}`, name: `Table ${toTableName}` }
              : o
          ),
          selectedTableId: state.selectedTableId === fromTableId ? toTableId : state.selectedTableId,
          selectedTableName: state.selectedTableId === fromTableId ? toTableName : state.selectedTableName,
        }));
      },

      setIsMobileCartOpen: (isOpen) => set({ isMobileCartOpen: isOpen }),

      addItem: (product, notes, addons) => {
    set((state) => {
      let finalNotes = notes || '';
      if ((product as any).isCombo && (product as any).comboItems && (product as any).comboItems.length > 0) {
        const allProducts = useMenuStore.getState().products;
        const comboNames = (product as any).comboItems.map((id: string) => {
          const found = allProducts.find((p) => p.id === id);
          return found ? found.name : 'Unknown Item';
        });
        const comboStr = `[Combo: ${comboNames.join(', ')}]`;
        finalNotes = finalNotes ? `${finalNotes} | ${comboStr}` : comboStr;
      }

      // If there are notes or addons, we treat it as a unique line item so they don't stack directly with standard items
      const hasCustomizations = !!finalNotes || (addons && addons.length > 0);
      
      const existing = state.items.find(
        (i) => i.productId === product.id && i.notes === finalNotes && JSON.stringify(i.addons) === JSON.stringify(addons) && i.status === 'NEW'
      );

      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === product.id && i.notes === finalNotes && JSON.stringify(i.addons) === JSON.stringify(addons) && i.status === 'NEW'
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
            notes: finalNotes || undefined,
            category: product.category,
            addons,
            status: 'NEW',
            isCombo: (product as any).isCombo,
            comboItems: (product as any).comboItems,
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

  updateItemAddonsByIndex: (index, addons) => {
    set((state) => {
      const newItems = [...state.items];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], addons };
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

  holdCurrentOrder: async (label, fromKitchen = false) => {
    const state = get();
    if (!state.items.length || state.isParking || state.isResuming || (state.isSendingKot && !fromKitchen)) return false;
    const context = getActionContext();
    set({ isParking: true });
    try {
      const existing = state.selectedTableId ? state.heldOrders.find(order => order.tableId === state.selectedTableId) : undefined;
      const order: ParkedOrder = {
        id: existing?.id || createId(), name: (typeof label === 'string' && label.trim() ? label : undefined) || state.selectedTableName || state.customer?.name || 'Parked order',
        items: [...state.items], tableId: state.selectedTableId, tableName: state.selectedTableName,
        waiterName: state.selectedWaiter, customerName: state.customer?.name, customerPhone: state.customer?.phone,
        discount: state.discount, checkoutBillNumber: state.checkoutBillNumber, orderVersion: state.orderVersion,
        orderType: state.orderType, orderNumber: state.currentOrderNumber,
        deliveryAddress: state.deliveryAddress, deliveryFee: state.deliveryFee, timestamp: new Date().toISOString(),
      };
      const result = await emitAction('park_order', { order, expectedRevision: existing?.revision || 0 });
      if (!contextIsCurrent(context)) return false;
      if (result.status === 'ERROR') { toast.error(result.message || 'Order was not parked. Your cart is preserved.'); return false; }
      const revision = result.data?.revision || (existing?.revision || 0) + 1;
      set({ heldOrders: [{ ...order, revision }, ...get().heldOrders.filter(row => row.id !== order.id)] });
      if (get().items !== state.items) { toast.info('The earlier cart was parked. Your newer cart edits remain open for review.'); return false; }
      if (state.selectedTableId) useTableStore.getState().setTableStatus(state.selectedTableId, 'OCCUPIED', state.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
      set({ items: [], selectedTableId: null, selectedTableName: null, selectedWaiter: null, customer: null, discount: 0,
        currentOrderNumber: null, checkoutBillNumber: null, orderVersion: null, deliveryAddress: '', deliveryFee: 0,
        deliveryStatus: null, collectedMethod: null });
      if (result.status === 'QUEUED') toast.info('Parked order saved on this device; awaiting server confirmation.');
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Order was not parked'); return false; }
    finally { if (contextIsCurrent(context)) set({ isParking: false }); }
  },

  sendKot: async () => {
    const state = get();
    if (!state.items.length || state.isSendingKot || state.isParking || state.isResuming) return;
    const context = getActionContext();
    set({ isSendingKot: true });
    try {
      const orderNumber = state.currentOrderNumber || useSettingsStore.getState().orderPrefix + '-' + createId();
      set({ currentOrderNumber: orderNumber });
      const newItems = state.items.filter(item => item.status === 'NEW');
      let result: ActionResult = { status: 'OK' };
      if (newItems.length) {
        result = await useKdsStore.getState().addTicket({ id: 'kot-' + createId(), orderNumber, tableId: state.selectedTableId,
          tableNumber: state.orderType === 'DINE_IN' ? state.selectedTableName || 'Takeaway' : state.orderType === 'PARCEL' ? '📦 Parcel' : '🛵 Delivery',
          orderType: state.orderType, customerName: state.customer?.name,
          items: newItems.map(item => ({ ...item, status: 'COOKING' })), firedAt: new Date().toISOString() });
        if (result.status === 'ERROR') { toast.error(result.message || 'Kitchen did not confirm this order. Your cart is preserved.'); return result; }
      }
      if (!contextIsCurrent(context)) return;
      if (get().items !== state.items) { toast.info('The earlier items were submitted. Review your newer cart edits before sending again.'); return result; }
      set({ items: state.items.map(item => ({ ...item, status: 'SENT' })) });
      await get().holdCurrentOrder(undefined, true);
      return result;
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Kitchen order could not be sent'); return { status: 'ERROR' }; }
    finally { if (contextIsCurrent(context)) set({ isSendingKot: false }); }
  },

  resumeOrder: async parkedId => {
    const state = get(), target = state.heldOrders.find(order => order.id === parkedId);
    if (!target || state.isSendingKot || state.isParking || state.isResuming) return;
    const context = getActionContext();
    if (state.items.length && !await get().holdCurrentOrder('Saved before opening another order')) return;
    set({ isResuming: true });
    try {
      let latest: any = null;
      if (target.orderNumber && navigator.onLine) {
        const response = await authorizedFetch('/billing/active-order/' + encodeURIComponent(target.orderNumber) + (target.tableId ? '?tableId=' + encodeURIComponent(target.tableId) : ''), { signal: AbortSignal.timeout(5000) });
        latest = await response.json();
        if (!response.ok) throw new Error(latest.message || 'Latest order could not be loaded');
      }
      if (!contextIsCurrent(context) || get().items.length) return;
      const result = await emitAction('remove_parked_order', { id: target.id, orderNumber: target.orderNumber, tableId: target.tableId, expectedRevision: target.revision || 0 });
      if (result.status === 'ERROR') throw new Error(result.message || 'Order could not be opened. Refresh parked orders.');
      if (!contextIsCurrent(context) || get().items.length) return;
      set({ items: latest ? [...latest.items, ...target.items.filter(item => item.status === 'NEW')] : target.items,
        selectedTableId: target.tableId || null, selectedTableName: target.tableName || null, selectedWaiter: target.waiterName || null,
        customer: target.customerName || target.customerPhone ? { name: target.customerName || '', phone: target.customerPhone || '' } : null,
        discount: target.discount || 0, orderType: target.orderType || 'DINE_IN', currentOrderNumber: latest?.orderNumber || target.orderNumber || null,
        orderVersion: latest?.version || target.orderVersion || null, checkoutBillNumber: target.checkoutBillNumber || null,
        deliveryAddress: target.deliveryAddress || '', deliveryFee: target.deliveryFee || 0,
        deliveryStatus: target.deliveryStatus || null, collectedMethod: target.collectedMethod || null,
        heldOrders: get().heldOrders.filter(order => order.id !== parkedId) });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Order could not be opened'); }
    finally { if (contextIsCurrent(context)) set({ isResuming: false }); }
  },

  clearCart: () => {
    set({ checkoutBillNumber: null, orderVersion: null });
    const state = get();
    if (state.selectedTableId) {
      useTableStore.getState().setTableStatus(state.selectedTableId, 'AVAILABLE');
    }
    
    const kdsTable = state.orderType === 'DINE_IN'
      ? (state.selectedTableName || 'Takeaway')
      : (state.orderType === 'PARCEL' ? '📦 Parcel' : '🛵 Delivery');

    if (state.items.every(item => item.status === 'SENT')) useKdsStore.getState().clearTableTickets(kdsTable);
    set({
      items: [], selectedTableId: null, selectedTableName: null, selectedWaiter: null, customer: null, discount: 0, orderType: 'DINE_IN', currentOrderNumber: null, deliveryAddress: '', deliveryFee: 0, deliveryStatus: null, collectedMethod: null
    });
  },

  toggleOffline: () => {
    set((state) => ({ isOffline: !state.isOffline }));
  },

  setCustomer: (customer) => {
    set({ customer });
  },
}), { name: 'pos-cart-storage', storage: createJSONStorage(() => tenantStorage), partialize: ({ isParking, isSendingKot, isResuming, ...state }) => state }));

// Listen to browser network changes for automatic offline mode toggling
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => useCartStore.setState({ isOffline: true }));
  window.addEventListener('online', () => useCartStore.setState({ isOffline: false }));
}

