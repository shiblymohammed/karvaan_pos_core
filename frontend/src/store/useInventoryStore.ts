import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { emitAction, ActionResult } from '../services/socket';
import { normalizeInventoryItem } from '../services/inventoryData';

export interface Ingredient {
  stockNeedsReview?: boolean;
  revision?: number;
  id: string;
  name: string;
  category: 'DAIRY' | 'MEAT' | 'PRODUCE' | 'DRY_GOODS' | 'BEVERAGE' | 'SPICES' | 'PACKAGING';
  currentStock: number; // in cooking/recipe unit (e.g., g, ml, pcs)
  reorderLevel: number;
  unit: 'g' | 'ml' | 'pcs' | 'kg' | 'l'; // base unit used in recipes
  purchaseUnit: 'kg' | 'l' | 'pack' | 'sack' | 'box' | 'g' | 'ml' | 'pcs';
  conversionFactor: number; // e.g., 1 kg = 1000 g -> factor is 1000
  costPerUnit: number; // cost per base unit (e.g., ₹0.45 per g)
  lastVendor?: string;
  updatedAt: string;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number; // required units per 1 portion of menu item
  wasteFactorPercent?: number; // e.g., 5% trimming loss
}

export interface Recipe {
  menuItemId: string; // Product ID or unique name
  menuItemName: string;
  ingredients: RecipeItem[];
  prepInstructions?: string;
  batchSize?: number; // Default prep batch quantity
}

export interface WasteLog {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  reason: 'EXPIRED' | 'BURNT' | 'DROPPED' | 'SPOILAGE' | 'OTHER';
  costLoss: number;
  loggedBy: string;
  timestamp: string;
}

interface InventoryState {
  ingredients: Ingredient[];
  recipes: Recipe[];
  wasteLogs: WasteLog[];

  // Ingredient Actions
  addIngredient: (ing: Omit<Ingredient, 'id' | 'updatedAt'>) => boolean;
  updateIngredient: (id: string, updates: Partial<Ingredient>) => void;
  deleteIngredient: (id: string) => void;
  addStockPO: (id: string, addedPurchaseUnits: number, totalInvoiceCost?: number, vendorName?: string) => Promise<ActionResult>;

  // Recipe Actions
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (menuItemName: string) => void;

  // Waste Actions
  logWaste: (log: Omit<WasteLog, 'id' | 'timestamp' | 'costLoss' | 'ingredientName' | 'unit'>) => void;

  // Auto-Depletion & Return Engine
  depleteForOrder: (items: { name: string; quantity: number }[], orderType?: string) => void;
  restockForOrder: (items: { name: string; quantity: number }[], orderType?: string, action?: 'RESTOCK' | 'WASTE', reason?: string, loggedBy?: string) => void;

  // Helper Getters
  getLowStockIngredients: () => Ingredient[];
  checkIs86d: (menuItemName: string) => boolean;
  getRecipeCost: (menuItemName: string) => number;
  getProfitMarginPercent: (menuItemName: string, sellingPrice: number) => number;
}

const INITIAL_INGREDIENTS: Ingredient[] = [
  // Dairy
  { id: 'ing-1', name: 'Fresh Whole Milk', category: 'DAIRY', currentStock: 18000, reorderLevel: 5000, unit: 'ml', purchaseUnit: 'l', conversionFactor: 1000, costPerUnit: 0.06, lastVendor: 'Amul Direct', updatedAt: new Date().toISOString() },
  { id: 'ing-2', name: 'Mozzarella Cheese', category: 'DAIRY', currentStock: 8500, reorderLevel: 2500, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.55, lastVendor: 'Dlecta Foods', updatedAt: new Date().toISOString() },
  { id: 'ing-3', name: 'Truffle Cheese Blend', category: 'DAIRY', currentStock: 3200, reorderLevel: 1000, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 1.40, lastVendor: 'Gourmet Imports', updatedAt: new Date().toISOString() },
  { id: 'ing-4', name: 'Amul Butter', category: 'DAIRY', currentStock: 6000, reorderLevel: 1500, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.50, lastVendor: 'Amul Direct', updatedAt: new Date().toISOString() },
  
  // Meat
  { id: 'ing-5', name: 'Chicken Thigh & Breast', category: 'MEAT', currentStock: 14500, reorderLevel: 4000, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.28, lastVendor: 'Venky Chicken', updatedAt: new Date().toISOString() },
  { id: 'ing-6', name: 'Italian Pepperoni Slices', category: 'MEAT', currentStock: 4200, reorderLevel: 1200, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.95, lastVendor: 'Gourmet Imports', updatedAt: new Date().toISOString() },
  { id: 'ing-7', name: 'Smoked Chicken Burger Patty', category: 'MEAT', currentStock: 45, reorderLevel: 15, unit: 'pcs', purchaseUnit: 'pack', conversionFactor: 10, costPerUnit: 65.0, lastVendor: 'Venky Chicken', updatedAt: new Date().toISOString() },

  // Produce
  { id: 'ing-8', name: 'Aged Basmati Rice', category: 'PRODUCE', currentStock: 22000, reorderLevel: 6000, unit: 'g', purchaseUnit: 'sack', conversionFactor: 25000, costPerUnit: 0.14, lastVendor: 'Daawat Mills', updatedAt: new Date().toISOString() },
  { id: 'ing-9', name: 'Fresh Onions & Garlic', category: 'PRODUCE', currentStock: 15000, reorderLevel: 4000, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.04, lastVendor: 'Local Mandi', updatedAt: new Date().toISOString() },
  { id: 'ing-10', name: 'San Marzano Tomato Puree', category: 'PRODUCE', currentStock: 9500, reorderLevel: 3000, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.18, lastVendor: 'Mutti Imports', updatedAt: new Date().toISOString() },

  // Dry Goods & Bakery
  { id: 'ing-11', name: 'Arabica Espresso Beans', category: 'DRY_GOODS', currentStock: 5400, reorderLevel: 1500, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 1.20, lastVendor: 'Blue Tokai Roasters', updatedAt: new Date().toISOString() },
  { id: 'ing-12', name: 'Assam Tea Leaves & Spice', category: 'DRY_GOODS', currentStock: 4000, reorderLevel: 1000, unit: 'g', purchaseUnit: 'kg', conversionFactor: 1000, costPerUnit: 0.40, lastVendor: 'Tata Tea Direct', updatedAt: new Date().toISOString() },
  { id: 'ing-13', name: 'Artisan Burger Bun', category: 'DRY_GOODS', currentStock: 60, reorderLevel: 20, unit: 'pcs', purchaseUnit: 'pack', conversionFactor: 6, costPerUnit: 18.0, lastVendor: 'City Bakery', updatedAt: new Date().toISOString() },
  { id: 'ing-14', name: 'Sourdough Pizza Dough Ball 12"', category: 'DRY_GOODS', currentStock: 38, reorderLevel: 12, unit: 'pcs', purchaseUnit: 'box', conversionFactor: 10, costPerUnit: 42.0, lastVendor: 'City Bakery', updatedAt: new Date().toISOString() },

  // Packaging
  { id: 'ing-15', name: 'Takeaway Meal Box (Corrugated)', category: 'PACKAGING', currentStock: 350, reorderLevel: 100, unit: 'pcs', purchaseUnit: 'box', conversionFactor: 50, costPerUnit: 12.0, lastVendor: 'Packmate India', updatedAt: new Date().toISOString() },
  { id: 'ing-16', name: 'Wood-Fired Pizza Box 12"', category: 'PACKAGING', currentStock: 180, reorderLevel: 50, unit: 'pcs', purchaseUnit: 'box', conversionFactor: 50, costPerUnit: 16.0, lastVendor: 'Packmate India', updatedAt: new Date().toISOString() },
  { id: 'ing-17', name: 'Beverage Cup with Lid 350ml', category: 'PACKAGING', currentStock: 420, reorderLevel: 100, unit: 'pcs', purchaseUnit: 'box', conversionFactor: 100, costPerUnit: 6.5, lastVendor: 'Packmate India', updatedAt: new Date().toISOString() },
];

const INITIAL_RECIPES: Recipe[] = [
  {
    menuItemId: '1',
    menuItemName: 'Caramel Macchiato',
    prepInstructions: 'Extract 18g espresso shot into 220ml steamed whole milk. Top with caramel drizzle.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-11', quantity: 18, wasteFactorPercent: 5 }, // Espresso Beans (g)
      { ingredientId: 'ing-1', quantity: 220, wasteFactorPercent: 2 }, // Milk (ml)
    ],
  },
  {
    menuItemId: '2',
    menuItemName: 'Masala Chai Pot',
    prepInstructions: 'Boil Assam tea leaves with crushed cardamom/ginger in 150ml milk + 100ml water.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-12', quantity: 12, wasteFactorPercent: 0 }, // Tea Leaves (g)
      { ingredientId: 'ing-1', quantity: 150, wasteFactorPercent: 2 }, // Milk (ml)
    ],
  },
  {
    menuItemId: '5',
    menuItemName: 'Smoked Chicken Burger',
    prepInstructions: 'Toast artisan bun with butter. Grill smoked patty and assemble with lettuce/sauce.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-13', quantity: 1, wasteFactorPercent: 0 }, // Bun (pcs)
      { ingredientId: 'ing-7', quantity: 1, wasteFactorPercent: 0 }, // Patty (pcs)
      { ingredientId: 'ing-4', quantity: 15, wasteFactorPercent: 5 }, // Butter (g)
    ],
  },
  {
    menuItemId: '7',
    menuItemName: 'Margherita Pepperoni Pizza',
    prepInstructions: 'Stretch 12" sourdough ball. Spread 90g tomato puree, top with 140g Mozzarella and 60g Pepperoni.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-14', quantity: 1, wasteFactorPercent: 0 }, // Dough Ball (pcs)
      { ingredientId: 'ing-10', quantity: 90, wasteFactorPercent: 5 }, // Tomato Puree (g)
      { ingredientId: 'ing-2', quantity: 140, wasteFactorPercent: 5 }, // Mozzarella (g)
      { ingredientId: 'ing-6', quantity: 60, wasteFactorPercent: 2 }, // Pepperoni (g)
    ],
  },
  {
    menuItemId: '8',
    menuItemName: 'Four Cheese Truffle Pizza',
    prepInstructions: 'Stretch sourdough ball. Spread tomato base, top with 100g Mozzarella and 80g Truffle cheese blend.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-14', quantity: 1, wasteFactorPercent: 0 }, // Dough Ball (pcs)
      { ingredientId: 'ing-10', quantity: 80, wasteFactorPercent: 5 }, // Tomato Puree (g)
      { ingredientId: 'ing-2', quantity: 100, wasteFactorPercent: 5 }, // Mozzarella (g)
      { ingredientId: 'ing-3', quantity: 80, wasteFactorPercent: 2 }, // Truffle Blend (g)
    ],
  },
  {
    menuItemId: '9',
    menuItemName: 'Hyderabadi Chicken Biryani',
    prepInstructions: 'Layer marinated chicken thighs (250g) with half-cooked basmati rice (180g) and onions/garlic.',
    batchSize: 1,
    ingredients: [
      { ingredientId: 'ing-5', quantity: 250, wasteFactorPercent: 5 }, // Chicken (g)
      { ingredientId: 'ing-8', quantity: 180, wasteFactorPercent: 2 }, // Basmati Rice (g)
      { ingredientId: 'ing-9', quantity: 60, wasteFactorPercent: 10 }, // Onions/Garlic (g)
      { ingredientId: 'ing-4', quantity: 25, wasteFactorPercent: 0 }, // Butter/Ghee (g)
    ],
  },
];

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      ingredients: INITIAL_INGREDIENTS,
      recipes: INITIAL_RECIPES,
      wasteLogs: [
        {
          id: 'waste-101',
          ingredientId: 'ing-2',
          ingredientName: 'Mozzarella Cheese',
          quantity: 450,
          unit: 'g',
          reason: 'EXPIRED',
          costLoss: 450 * 0.55,
          loggedBy: 'Chef Rajesh',
          timestamp: new Date(Date.now() - 3600000 * 4).toLocaleTimeString(),
        },
      ],

      addIngredient: (ing) => {
        if (!ing.name.trim() || ![ing.currentStock, ing.reorderLevel, ing.costPerUnit].every(value => Number.isFinite(value) && value >= 0) || !Number.isFinite(ing.conversionFactor) || ing.conversionFactor <= 0) return false;
        const newIng: Ingredient = {
          ...ing,
          id: `ing-${crypto.randomUUID()}`,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ ingredients: [newIng, ...state.ingredients] }));
        return true;
      },

      updateIngredient: (id, updates) => {
        set((state) => ({
          ingredients: state.ingredients.map((i) =>
            i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
          ),
        }));
      },

      deleteIngredient: (id) => {
        set((state) => ({
          ingredients: state.ingredients.filter((i) => i.id !== id),
          recipes: state.recipes.map((r) => ({
            ...r,
            ingredients: r.ingredients.filter((item) => item.ingredientId !== id),
          })),
        }));
        emitAction('sync_recipes', get().recipes);
      },

      addStockPO: async (id, addedPurchaseUnits, totalInvoiceCost, vendorName) => {
        const row = get().ingredients.find(item => item.id === id);
        if (!row || row.stockNeedsReview) return { status: 'ERROR', message: 'Reload this ingredient from the server before receiving stock.' };
        if (!Number.isFinite(addedPurchaseUnits) || addedPurchaseUnits <= 0 || !Number.isFinite(row.conversionFactor) || row.conversionFactor <= 0 || (totalInvoiceCost !== undefined && (!Number.isFinite(totalInvoiceCost) || totalInvoiceCost < 0))) return { status: 'ERROR', message: 'Enter a valid received quantity, conversion, and invoice total.' };
        return emitAction('receive_inventory_purchase', { id, purchaseUnits: addedPurchaseUnits, purchaseUnit: row.purchaseUnit, conversionFactor: row.conversionFactor, invoiceCost: totalInvoiceCost, vendor: vendorName });
      },

      saveRecipe: (recipe) => {
        set((state) => {
          const exists = state.recipes.some((r) => r.menuItemName.toLowerCase() === recipe.menuItemName.toLowerCase());
          if (exists) {
            return {
              recipes: state.recipes.map((r) =>
                r.menuItemName.toLowerCase() === recipe.menuItemName.toLowerCase() ? recipe : r
              ),
            };
          }
          return { recipes: [recipe, ...state.recipes] };
        });
        emitAction('sync_recipes', get().recipes);
      },

      deleteRecipe: (menuItemName) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.menuItemName.toLowerCase() !== menuItemName.toLowerCase()),
        }));
        emitAction('sync_recipes', get().recipes);
      },

      logWaste: (log) => {
        const ing = get().ingredients.find((i) => i.id === log.ingredientId);
        if (!ing) return;
        const costLoss = log.quantity * ing.costPerUnit;
        const newLog: WasteLog = {
          ...log,
          id: `waste-${Date.now()}`,
          ingredientName: ing.name,
          unit: ing.unit,
          costLoss,
          timestamp: new Date().toLocaleTimeString(),
        };

        set((state) => ({
          ingredients: state.ingredients.map((i) =>
            i.id === log.ingredientId
              ? { ...i, currentStock: Math.max(0, i.currentStock - log.quantity), updatedAt: new Date().toISOString() }
              : i
          ),
          wasteLogs: [newLog, ...state.wasteLogs],
        }));
        emitAction('sync_waste', get().wasteLogs);
      },

      depleteForOrder: (items, orderType) => {
        const { ingredients, recipes } = get();
        const updatedIngredients = [...ingredients];

        items.forEach((item) => {
          const recipe = recipes.find(
            (r) => r.menuItemName.toLowerCase() === item.name.toLowerCase() || r.menuItemId === item.name
          );

          if (recipe) {
            recipe.ingredients.forEach((ri) => {
              const ingIndex = updatedIngredients.findIndex((i) => i.id === ri.ingredientId);
              if (ingIndex !== -1) {
                const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                const totalNeeded = ri.quantity * item.quantity * wasteFactor;
                updatedIngredients[ingIndex] = {
                  ...updatedIngredients[ingIndex],
                  currentStock: Math.max(0, updatedIngredients[ingIndex].currentStock - totalNeeded),
                  updatedAt: new Date().toISOString(),
                };
              }
            });
          }

          // Automatically deduct packaging for PARCEL / DELIVERY
          if (orderType === 'PARCEL' || orderType === 'DELIVERY') {
            let pkgId = 'ing-15'; // Default Meal Box
            if (item.name.toLowerCase().includes('pizza')) pkgId = 'ing-16'; // Pizza Box
            if (item.name.toLowerCase().includes('coffee') || item.name.toLowerCase().includes('chai') || item.name.toLowerCase().includes('shake') || item.name.toLowerCase().includes('macchiato')) pkgId = 'ing-17'; // Beverage Cup

            const pkgIndex = updatedIngredients.findIndex((i) => i.id === pkgId);
            if (pkgIndex !== -1) {
              updatedIngredients[pkgIndex] = {
                ...updatedIngredients[pkgIndex],
                currentStock: Math.max(0, updatedIngredients[pkgIndex].currentStock - item.quantity),
                updatedAt: new Date().toISOString(),
              };
            }
          }
        });

        set({ ingredients: updatedIngredients });
      },

      restockForOrder: (items, orderType, action = 'RESTOCK', reason = 'CUSTOMER_RETURN', loggedBy = 'Cashier Staff') => {
        const { ingredients, recipes, logWaste } = get();
        const updatedIngredients = [...ingredients];

        items.forEach((item) => {
          const recipe = recipes.find(
            (r) => r.menuItemName.toLowerCase() === item.name.toLowerCase() || r.menuItemId === item.name
          );

          if (recipe) {
            recipe.ingredients.forEach((ri) => {
              const ingIndex = updatedIngredients.findIndex((i) => i.id === ri.ingredientId);
              if (ingIndex !== -1) {
                const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                const totalNeeded = ri.quantity * item.quantity * wasteFactor;

                if (action === 'RESTOCK') {
                  // Add stock back to inventory
                  updatedIngredients[ingIndex] = {
                    ...updatedIngredients[ingIndex],
                    currentStock: updatedIngredients[ingIndex].currentStock + totalNeeded,
                    updatedAt: new Date().toISOString(),
                  };
                } else if (action === 'WASTE') {
                  // Log return spoilage
                  logWaste({
                    ingredientId: ri.ingredientId,
                    quantity: Number(totalNeeded.toFixed(2)),
                    reason: 'SPOILAGE',
                    loggedBy: `${loggedBy} (${reason})`,
                  });
                }
              }
            });
          }

          // Handle packaging restocking/spoilage for PARCEL / DELIVERY
          if (orderType === 'PARCEL' || orderType === 'DELIVERY') {
            let pkgId = 'ing-15'; // Default Meal Box
            if (item.name.toLowerCase().includes('pizza')) pkgId = 'ing-16'; // Pizza Box
            if (item.name.toLowerCase().includes('coffee') || item.name.toLowerCase().includes('chai') || item.name.toLowerCase().includes('shake') || item.name.toLowerCase().includes('macchiato')) pkgId = 'ing-17'; // Beverage Cup

            const pkgIndex = updatedIngredients.findIndex((i) => i.id === pkgId);
            if (pkgIndex !== -1) {
              if (action === 'RESTOCK') {
                updatedIngredients[pkgIndex] = {
                  ...updatedIngredients[pkgIndex],
                  currentStock: updatedIngredients[pkgIndex].currentStock + item.quantity,
                  updatedAt: new Date().toISOString(),
                };
              } else if (action === 'WASTE') {
                logWaste({
                  ingredientId: pkgId,
                  quantity: item.quantity,
                  reason: 'SPOILAGE',
                  loggedBy: `${loggedBy} (${reason} - Packaging)`,
                });
              }
            }
          }
        });

        if (action === 'RESTOCK') {
          set({ ingredients: updatedIngredients });
        }
      },

      getLowStockIngredients: () => {
        return get().ingredients.filter((i) => i.currentStock <= i.reorderLevel);
      },

      checkIs86d: (menuItemName) => {
        const recipe = get().recipes.find(
          (r) => r.menuItemName.toLowerCase() === menuItemName.toLowerCase() || r.menuItemId === menuItemName
        );
        if (!recipe || recipe.ingredients.length === 0) return false;

        return recipe.ingredients.some((ri) => {
          const ing = get().ingredients.find((i) => i.id === ri.ingredientId);
          return !ing || ing.currentStock <= 0;
        });
      },

      getRecipeCost: (menuItemName) => {
        const recipe = get().recipes.find(
          (r) => r.menuItemName.toLowerCase() === menuItemName.toLowerCase() || r.menuItemId === menuItemName
        );
        if (!recipe) return 0;

        return recipe.ingredients.reduce((total, ri) => {
          const ing = get().ingredients.find((i) => i.id === ri.ingredientId);
          if (!ing) return total;
          const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
          return total + ri.quantity * ing.costPerUnit * wasteFactor;
        }, 0);
      },

      getProfitMarginPercent: (menuItemName, sellingPrice) => {
        if (!sellingPrice || sellingPrice <= 0) return 0;
        const cost = get().getRecipeCost(menuItemName);
        if (cost === 0) return 100;
        return ((sellingPrice - cost) / sellingPrice) * 100;
      },
    }),
    { name: 'pos-inventory-storage', storage: createJSONStorage(() => tenantStorage), merge: (saved: any, current) => ({ ...current, ...saved, ingredients: (saved?.ingredients || current.ingredients).map((row: any) => normalizeInventoryItem(row)) }) }
  )
);


let inventorySyncEnabled = false;
let applyingInventorySnapshot = false;
export function suspendInventorySync() { inventorySyncEnabled = false; }
export function initializeInventorySync() { inventorySyncEnabled = true; }
export function applyInventorySnapshot(rows: any[]) {
  applyingInventorySnapshot = true;
  try {
    const previous = new Map(useInventoryStore.getState().ingredients.map(row => [row.id, row]));
    useInventoryStore.setState({ ingredients: rows.filter(row => row.isActive !== false).map(row => normalizeInventoryItem(row, previous.get(row.id))) });
  }
  finally { applyingInventorySnapshot = false; }
}
const inventoryDetails = (row: Ingredient) => ({ name: row.name, category: row.category, unit: row.unit, minThreshold: row.reorderLevel ?? 0, costPrice: row.costPerUnit ?? 0, purchaseUnit: row.purchaseUnit, conversionFactor: row.conversionFactor, lastVendor: row.lastVendor || '' });
useInventoryStore.subscribe((state, previous) => {
  if (!inventorySyncEnabled || applyingInventorySnapshot || state.ingredients === previous.ingredients) return;
  const before = new Map(previous.ingredients.map(row => [row.id, row]));
  const after = new Map(state.ingredients.map(row => [row.id, row]));
  const changes: any[] = [];
  for (const row of state.ingredients) {
    const old = before.get(row.id);
    const delta = Number((row.currentStock - (old?.currentStock || 0)).toFixed(6));
    const detailsChanged = !old || JSON.stringify(inventoryDetails(old)) !== JSON.stringify(inventoryDetails(row));
    if (delta || detailsChanged) changes.push({ id: row.id, delta, expectedRevision: old?.revision || 0, ...(detailsChanged ? { metadata: inventoryDetails(row) } : {}) });
  }
  for (const row of previous.ingredients) if (!after.has(row.id)) changes.push({ id: row.id, expectedRevision: row.revision || 0, remove: true });
  if (!changes.length) return;
  applyingInventorySnapshot = true;
  useInventoryStore.setState({ ingredients: state.ingredients.map(row => changes.some(change => change.id === row.id) ? { ...row, revision: (row.revision || 0) + 1 } : row) });
  applyingInventorySnapshot = false;
  void emitAction('apply_inventory_changes', { changes });
});
