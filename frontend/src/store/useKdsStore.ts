import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket } from '../services/socket';

export interface KdsTicket {
  id: string;
  orderNumber: string;
  tableNumber: string;
  orderType?: 'DINE_IN' | 'PARCEL' | 'DELIVERY';
  customerName?: string;
  items: Array<{ name: string; quantity: number; notes?: string; status: string }>;
  firedAt: string;
  status: 'COOKING' | 'READY' | 'SERVED';
  elapsedMinutes: number;
}

const MOCK_INITIAL_TICKETS: KdsTicket[] = [
  {
    id: 'kot-101',
    orderNumber: 'KORD-1042',
    tableNumber: 'T1',
    items: [
      { name: 'Margherita Pepperoni Pizza', quantity: 1, notes: 'Extra crispy crust', status: 'COOKING' },
      { name: 'Belgian Chocolate Shake', quantity: 2, status: 'COOKING' },
    ],
    firedAt: new Date(Date.now() - 6 * 60000).toISOString(),
    status: 'COOKING',
    elapsedMinutes: 6,
  },
  {
    id: 'kot-102',
    orderNumber: 'KORD-1043',
    tableNumber: 'VIP-1',
    items: [
      { name: 'Four Cheese Truffle Pizza', quantity: 2, notes: 'No garlic oil', status: 'COOKING' },
      { name: 'Smoked Chicken Burger', quantity: 3, status: 'COOKING' },
      { name: 'Hazelnut Cold Coffee', quantity: 3, status: 'COOKING' },
    ],
    firedAt: new Date(Date.now() - 12 * 60000).toISOString(),
    status: 'COOKING',
    elapsedMinutes: 12,
  },
];

interface KdsState {
  tickets: KdsTicket[];
  addTicket: (ticket: Omit<KdsTicket, 'status' | 'elapsedMinutes'>) => void;
  updateTicketStatus: (id: string, status: 'COOKING' | 'READY' | 'SERVED') => void;
  updateElapsedTimes: () => void;
  clearTableTickets: (tableName: string) => void;
}

export const useKdsStore = create<KdsState>()(
  persist(
    (set) => ({
      tickets: MOCK_INITIAL_TICKETS,

  addTicket: (ticket) => {
    set((state) => ({
      tickets: [
        {
          ...ticket,
          status: 'COOKING',
          elapsedMinutes: 0,
        },
        ...state.tickets,
      ],
    }));
    // Broadcast to all other devices
    socket.emit('fire_order', { ...ticket, status: 'COOKING', elapsedMinutes: 0 });
  },

  updateTicketStatus: (id, status) => {
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
    // Broadcast to all other devices
    socket.emit('update_kds_status', { orderId: id, status });
  },

  updateElapsedTimes: () => {
    set((state) => {
      const now = new Date();
      return {
        tickets: state.tickets.map((t) => {
          if (t.status === 'READY' || t.status === 'SERVED') return t;
          const fired = new Date(t.firedAt);
          const elapsed = Math.floor((now.getTime() - fired.getTime()) / 60000);
          return { ...t, elapsedMinutes: elapsed };
        }),
      };
    });
  },

  clearTableTickets: (tableName) => {
    set((state) => ({
      tickets: state.tickets.filter((t) => {
        if (tableName.includes('Takeaway') || tableName === 'Walk-in' || tableName.includes('Delivery') || tableName.includes('Parcel') || t.orderType === 'DELIVERY' || t.orderType === 'PARCEL') {
          return !(t.tableNumber === tableName && t.status === 'SERVED');
        }
        return t.tableNumber !== tableName;
      }),
    }));
    // Broadcast to all other devices
    socket.emit('clear_table_tickets', { tableName });
  },
}), { name: 'pos-kds-storage' }));
