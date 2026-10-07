import { create } from 'zustand';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'INFO') => {
    const id = Date.now().toString() + Math.random().toString();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
}));

// Helper export for easy usage anywhere in the app (even outside React components)
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast(msg, 'SUCCESS'),
  error: (msg: string) => useToastStore.getState().addToast(msg, 'ERROR'),
  info: (msg: string) => useToastStore.getState().addToast(msg, 'INFO'),
  warning: (msg: string) => useToastStore.getState().addToast(msg, 'WARNING'),
};
