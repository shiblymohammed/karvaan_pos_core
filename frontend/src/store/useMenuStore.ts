import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  prepTime: number;
  isAvailable: boolean;
  description?: string;
  imageEmoji?: string; // Quick emoji icon for visual menu
  gstRate?: number;    // GST percentage e.g. 5.0
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  emoji?: string;      // e.g. "☕", "🍕", "🍔"
  color?: string;      // Accent color token e.g. "emerald", "amber"
}

interface MenuState {
  products: Product[];
  categories: Category[];

  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'isAvailable'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleAvailability: (id: string) => void;

  // Category actions
  addCategory: (category: Omit<Category, 'id' | 'sortOrder'>) => void;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  reorderCategory: (id: string, direction: 'up' | 'down') => void;
}

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-all', name: 'All', sortOrder: 0, emoji: '🍽️', color: 'slate' },
  { id: 'cat-1', name: 'Hot Beverages', sortOrder: 1, emoji: '☕', color: 'amber' },
  { id: 'cat-2', name: 'Cold Coffee & Shakes', sortOrder: 2, emoji: '🧋', color: 'cyan' },
  { id: 'cat-3', name: 'Artisan Burgers & Wraps', sortOrder: 3, emoji: '🍔', color: 'orange' },
  { id: 'cat-4', name: 'Wood-Fired Pizzas', sortOrder: 4, emoji: '🍕', color: 'red' },
  { id: 'cat-5', name: 'Main Course & Biryani', sortOrder: 5, emoji: '🍛', color: 'yellow' },
  { id: 'cat-6', name: 'Desserts & Bakery', sortOrder: 6, emoji: '🍰', color: 'pink' },
];

const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Caramel Macchiato', price: 180, category: 'Hot Beverages', prepTime: 5, isAvailable: true, gstRate: 5, imageEmoji: '☕' },
  { id: '2', name: 'Masala Chai Pot', price: 120, category: 'Hot Beverages', prepTime: 6, isAvailable: true, gstRate: 5, imageEmoji: '🍵' },
  { id: '3', name: 'Hazelnut Cold Coffee', price: 220, category: 'Cold Coffee & Shakes', prepTime: 7, isAvailable: true, gstRate: 5, imageEmoji: '🧋' },
  { id: '4', name: 'Belgian Chocolate Shake', price: 250, category: 'Cold Coffee & Shakes', prepTime: 8, isAvailable: true, gstRate: 5, imageEmoji: '🥤' },
  { id: '5', name: 'Smoked Chicken Burger', price: 290, category: 'Artisan Burgers & Wraps', prepTime: 12, isAvailable: true, gstRate: 5, imageEmoji: '🍔' },
  { id: '6', name: 'Paneer Tikka Wrap', price: 240, category: 'Artisan Burgers & Wraps', prepTime: 10, isAvailable: true, gstRate: 5, imageEmoji: '🌯' },
  { id: '7', name: 'Margherita Pepperoni Pizza', price: 480, category: 'Wood-Fired Pizzas', prepTime: 15, isAvailable: true, gstRate: 5, imageEmoji: '🍕' },
  { id: '8', name: 'Four Cheese Truffle Pizza', price: 520, category: 'Wood-Fired Pizzas', prepTime: 16, isAvailable: true, gstRate: 5, imageEmoji: '🍕' },
  { id: '9', name: 'Hyderabadi Chicken Biryani', price: 380, category: 'Main Course & Biryani', prepTime: 14, isAvailable: true, gstRate: 5, imageEmoji: '🍛' },
  { id: '10', name: 'Dal Makhani with Garlic Naan', price: 320, category: 'Main Course & Biryani', prepTime: 12, isAvailable: true, gstRate: 5, imageEmoji: '🫕' },
  { id: '11', name: 'New York Cheesecake', price: 260, category: 'Desserts & Bakery', prepTime: 3, isAvailable: true, gstRate: 5, imageEmoji: '🍰' },
  { id: '12', name: 'Warm Chocolate Lava Cake', price: 210, category: 'Desserts & Bakery', prepTime: 6, isAvailable: true, gstRate: 5, imageEmoji: '🍫' },
];

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,

      // ─── Product Actions ───────────────────────────────────────────────────────

      addProduct: (product) => {
        set((state) => ({
          products: [
            ...state.products,
            { ...product, id: `prod-${Date.now()}`, isAvailable: true },
          ],
        }));
      },

      updateProduct: (id, updatedFields) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...updatedFields } : p
          ),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
      },

      toggleAvailability: (id) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, isAvailable: !p.isAvailable } : p
          ),
        }));
      },

      // ─── Category Actions ──────────────────────────────────────────────────────

      addCategory: (category) => {
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
    }
  )
);
