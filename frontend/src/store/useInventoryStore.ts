import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tenantStorage } from './tenantStorage';
import { canEditConfig } from '../services/configSnapshot';
import { emitAction, ActionResult } from '../services/socket';
import { normalizeInventoryItem, normalizeWasteLog } from '../services/inventoryData';
import { createId } from '../services/createId';

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
  costLoss: number | null;
  loggedBy: string;
  timestamp: string;
}

interface InventoryState {
  ingredients: Ingredient[];
  recipes: Recipe[];
  recipeRevision: number;
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
  logWaste: (log: Omit<WasteLog, 'id' | 'timestamp' | 'costLoss' | 'ingredientName' | 'unit' | 'loggedBy'>) => Promise<ActionResult>;

  // Auto-Depletion & Return Engine

  // Helper Getters
  getLowStockIngredients: () => Ingredient[];
  checkIs86d: (menuItemName: string) => boolean;
  getRecipeCost: (menuItemName: string) => number;
  getProfitMarginPercent: (menuItemName: string, sellingPrice: number) => number;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      ingredients: [],
      recipes: [],
      recipeRevision: -1,
      wasteLogs: [],

      addIngredient: (ing) => {
        if (!ing.name.trim() || ![ing.currentStock, ing.reorderLevel, ing.costPerUnit].every(value => Number.isFinite(value) && value >= 0) || !Number.isFinite(ing.conversionFactor) || ing.conversionFactor <= 0) return false;
        const newIng: Ingredient = {
          ...ing,
          id: `ing-${createId()}`,
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
      },

      addStockPO: async (id, addedPurchaseUnits, totalInvoiceCost, vendorName) => {
        const row = get().ingredients.find(item => item.id === id);
        if (!row || row.stockNeedsReview) return { status: 'ERROR', message: 'Reload this ingredient from the server before receiving stock.' };
        if (!Number.isFinite(addedPurchaseUnits) || addedPurchaseUnits <= 0 || !Number.isFinite(row.conversionFactor) || row.conversionFactor <= 0 || (totalInvoiceCost !== undefined && (!Number.isFinite(totalInvoiceCost) || totalInvoiceCost < 0))) return { status: 'ERROR', message: 'Enter a valid received quantity, conversion, and invoice total.' };
        return emitAction('receive_inventory_purchase', { id, purchaseUnits: addedPurchaseUnits, purchaseUnit: row.purchaseUnit, conversionFactor: row.conversionFactor, invoiceCost: totalInvoiceCost, vendor: vendorName });
      },

      saveRecipe: (recipe) => {
        if (!canEditConfig(get().recipeRevision)) return;
        const expectedRevision = get().recipeRevision;
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
        set({ recipeRevision: expectedRevision + 1 });
        void emitAction('sync_recipes', { recipes: get().recipes, expectedRevision });
      },

      deleteRecipe: (menuItemName) => {
        if (!canEditConfig(get().recipeRevision)) return;
        const expectedRevision = get().recipeRevision;
        set((state) => ({
          recipes: state.recipes.filter((r) => r.menuItemName.toLowerCase() !== menuItemName.toLowerCase()),
        }));
        set({ recipeRevision: expectedRevision + 1 });
        void emitAction('sync_recipes', { recipes: get().recipes, expectedRevision });
      },

      logWaste: async (log) => {
        const ing = get().ingredients.find((i) => i.id === log.ingredientId);
        if (!ing || ing.stockNeedsReview || !Number.isFinite(log.quantity) || log.quantity <= 0 || log.quantity > ing.currentStock) return { status: 'ERROR', message: 'Enter a valid waste quantity within recorded stock, or reload stock for review.' };
        return emitAction('record_inventory_waste', { ingredientId: log.ingredientId, quantity: log.quantity, reason: log.reason });
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
          return !ing || ing.currentStock < ri.quantity * (1 + (ri.wasteFactorPercent || 0) / 100);
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
    { name: 'pos-inventory-storage', storage: createJSONStorage(() => tenantStorage), merge: (saved: any, current) => ({ ...current, ...saved, ingredients: (saved?.ingredients || current.ingredients).map((row: any) => normalizeInventoryItem(row)), wasteLogs: (saved?.wasteLogs || []).map(normalizeWasteLog) }) }
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
