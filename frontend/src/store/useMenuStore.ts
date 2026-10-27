import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { canEditConfig } from '../services/configSnapshot';
import { authorizedFetch } from '../services/authFetch';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  prepTime: number;
  isAvailable: boolean;
  isArchived?: boolean;
  description?: string;
  imageEmoji?: string; // Quick emoji icon for visual menu
  iconName?: string;   // Lucide icon name
  imageUrl?: string;   // Base64 or Cloudinary URL for product photo
  gstRate?: number;    // GST percentage e.g. 5.0
  isTopSelling?: boolean; // Flag for top selling items
  isFavourite?: boolean; // Flag for user favourites
  isCombo?: boolean;
  comboItems?: string[]; // Array of product IDs included in the combo
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  emoji?: string;      // Legacy emoji field
  iconName?: string;   // Lucide icon name (e.g. 'Coffee', 'Pizza')
  color?: string;      // Optional category color
  imageUrl?: string;   // Base64 or Cloudinary URL for category photo
}

interface MenuState {
  serverRevision: number;
  products: Product[];
  categories: Category[];

  // Network sync
  fetchMenu: () => Promise<void>;

  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'isAvailable'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleAvailability: (id: string) => void;
  toggleFavourite: (id: string) => void;

  // Category actions
  addCategory: (category: Omit<Category, 'id' | 'sortOrder'>) => void;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  reorderCategory: (id: string, direction: 'up' | 'down') => void;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      products: [],
      serverRevision: -1,
      categories: [],

      fetchMenu: async () => {
        try {
          const res = await authorizedFetch('/billing/menu');
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.products) && Array.isArray(data.categories)) {
              set({
                products: data.products.filter((p: Product) => !p.isArchived),
                categories: data.categories,
                serverRevision: typeof data.serverRevision === 'number' ? data.serverRevision : 0,
              });
            }
          }
        } catch (e) {
          console.error('Failed to fetch menu from backend', e);
        }
      },

      // ─── Product Actions ───────────────────────────────────────────────────────

      addProduct: (product) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          products: [
            ...state.products,
            { ...product, id: `prod-${Date.now()}`, isAvailable: true },
          ],
        }));
      },

      updateProduct: (id, updatedFields) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updatedFields } : p
          ),
        }));
      },

      deleteProduct: (id) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      toggleAvailability: (id) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, isAvailable: !p.isAvailable } : p
          ),
        }));
      },

      toggleFavourite: (id) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, isFavourite: !p.isFavourite } : p
          ),
        }));
      },

      // ─── Category Actions ──────────────────────────────────────────────────────

      addCategory: (category) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => ({
          categories: [
            ...state.categories,
            {
              id: `cat-${Date.now()}`,
              sortOrder: state.categories.length,
              ...category,
            },
          ],
        }));
      },

      updateCategory: (id, updates) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => {
          const updatedCategories = state.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          );
          // If name changed, update all products in that category
          const oldCat = state.categories.find((c) => c.id === id);
          if (oldCat && updates.name && oldCat.name !== updates.name) {
            return {
              categories: updatedCategories,
              products: state.products.map((p) =>
                p.category === oldCat.name ? { ...p, category: updates.name! } : p
              ),
            };
          }
          return { categories: updatedCategories };
        });
      },

      deleteCategory: (id) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => {
          const cat = state.categories.find((c) => c.id === id);
          if (!cat || cat.name === 'All') return state; // Cannot delete "All"
          return {
            categories: state.categories.filter((c) => c.id !== id),
            // Products in deleted category move to "Uncategorized" so they're not lost
            products: state.products.map((p) =>
              p.category === cat.name ? { ...p, category: 'Uncategorized' } : p
            ),
          };
        });
      },

      reorderCategory: (id, direction) => {
        if (!canEditConfig(get().serverRevision)) return;
        set((state) => {
          const sorted = [...state.categories].sort((a, b) => a.sortOrder - b.sortOrder);
          const idx = sorted.findIndex((c) => c.id === id);
          if (idx === -1) return state;

          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= sorted.length) return state;

          // Swap sortOrders
          const newSorted = sorted.map((c, i) => {
            if (i === idx) return { ...c, sortOrder: sorted[swapIdx].sortOrder };
            if (i === swapIdx) return { ...c, sortOrder: sorted[idx].sortOrder };
            return c;
          });

          return { categories: newSorted };
        });
      },
    }),
    {
      name: 'karvaan-menu-store',
      storage: createJSONStorage(() => tenantStorage),
      merge: (saved: any, current) => ({ ...current, ...saved, products: (saved?.products || current.products).filter((product: Product) => !product.isArchived) }),
    }
  )
);
