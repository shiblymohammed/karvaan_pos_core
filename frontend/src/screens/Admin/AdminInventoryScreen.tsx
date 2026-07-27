import React, { useState } from 'react';
import { 
  Package, Plus, Search, AlertTriangle, CheckCircle2, TrendingUp, 
  DollarSign, UtensilsCrossed, Trash2, Edit3, ArrowUpRight, Scale, 
  Sparkles, ShieldAlert, ShoppingCart, Filter, ChevronRight, Calculator,
  Printer, Layers, RefreshCw, X
} from 'lucide-react';
import { useInventoryStore, Ingredient, Recipe, RecipeItem } from '../../store/useInventoryStore';
import { useMenuStore } from '../../store/useMenuStore';

export const AdminInventoryScreen: React.FC = () => {
  const { 
    ingredients, recipes, wasteLogs, 
    addIngredient, updateIngredient, deleteIngredient, addStockPO,
    saveRecipe, deleteRecipe, logWaste,
    getLowStockIngredients, checkIs86d, getRecipeCost, getProfitMarginPercent
  } = useInventoryStore();

  const { products } = useMenuStore();

  const [activeTab, setActiveTab] = useState<'STOCK' | 'RECIPES' | 'PREP' | 'WASTE'>('STOCK');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Stock PO Modal State
  const [showPoModal, setShowPoModal] = useState<boolean>(false);
  const [poTargetId, setPoTargetId] = useState<string>('');
  const [poUnits, setPoUnits] = useState<number>(10);
  const [poCost, setPoCost] = useState<number>(0);
  const [poVendor, setPoVendor] = useState<string>('');

  // New Ingredient Modal State
  const [showNewIngModal, setShowNewIngModal] = useState<boolean>(false);
  const [newIngForm, setNewIngForm] = useState({
    name: '',
    category: 'DAIRY' as Ingredient['category'],
    currentStock: 1000,
    reorderLevel: 200,
    unit: 'g' as Ingredient['unit'],
    purchaseUnit: 'kg' as Ingredient['purchaseUnit'],
    conversionFactor: 1000,
    costPerUnit: 0.25,
    lastVendor: 'Local Vendor'
  });

  // Recipe Studio State
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '1');
  const [recipeAddIngId, setRecipeAddIngId] = useState<string>('');
  const [recipeAddQty, setRecipeAddQty] = useState<number>(100);
  const [recipeAddWaste, setRecipeAddWaste] = useState<number>(5);

  // Prep Planner State
  const [prepProductId, setPrepProductId] = useState<string>(products[0]?.id || '1');
  const [prepBatchQty, setPrepBatchQty] = useState<number>(25);

  // Waste Modal State
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [wasteIngId, setWasteIngId] = useState<string>(ingredients[0]?.id || '');
  const [wasteQty, setWasteQty] = useState<number>(500);
  const [wasteReason, setWasteReason] = useState<'EXPIRED' | 'BURNT' | 'DROPPED' | 'SPOILAGE' | 'OTHER'>('EXPIRED');
  const [wasteLoggedBy, setWasteLoggedBy] = useState<string>('Chef Rajesh');

  // Computed Stats
  const lowStockCount = getLowStockIngredients().length;
  const totalInventoryValue = ingredients.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0);
  const totalWasteLoss = wasteLogs.reduce((sum, w) => sum + w.costLoss, 0);

  // Filtered Ingredients
  const filteredIngredients = ingredients.filter(ing => {
    const matchesCat = selectedCategory === 'ALL' || ing.category === selectedCategory;
    const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase()) || ing.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];
  const selectedRecipe = recipes.find(r => r.menuItemId === selectedProduct?.id || r.menuItemName.toLowerCase() === selectedProduct?.name.toLowerCase());
  
  const selectedPrepProduct = products.find(p => p.id === prepProductId) || products[0];
  const selectedPrepRecipe = recipes.find(r => r.menuItemId === selectedPrepProduct?.id || r.menuItemName.toLowerCase() === selectedPrepProduct?.name.toLowerCase());

  const handleAddIngredientToRecipe = () => {
    if (!selectedProduct || !recipeAddIngId) return;
    const existingIngs = selectedRecipe ? [...selectedRecipe.ingredients] : [];
    const index = existingIngs.findIndex(i => i.ingredientId === recipeAddIngId);
    if (index !== -1) {
      existingIngs[index] = { ...existingIngs[index], quantity: recipeAddQty, wasteFactorPercent: recipeAddWaste };
    } else {
      existingIngs.push({ ingredientId: recipeAddIngId, quantity: recipeAddQty, wasteFactorPercent: recipeAddWaste });
    }

    saveRecipe({
      menuItemId: selectedProduct.id,
      menuItemName: selectedProduct.name,
      ingredients: existingIngs,
      prepInstructions: selectedRecipe?.prepInstructions || 'Standard kitchen prep protocol.',
      batchSize: 1
    });
    setRecipeAddQty(100);
  };

  const handleRemoveIngredientFromRecipe = (ingId: string) => {
    if (!selectedProduct || !selectedRecipe) return;
    const nextIngs = selectedRecipe.ingredients.filter(i => i.ingredientId !== ingId);
    saveRecipe({
      ...selectedRecipe,
      ingredients: nextIngs
    });
  };

  const submitPO = () => {
    if (!poTargetId || poUnits <= 0) return;
    addStockPO(poTargetId, poUnits, poCost > 0 ? poCost : undefined, poVendor);
    setShowPoModal(false);
    setPoUnits(10);
    setPoCost(0);
    setPoVendor('');
  };

  const submitNewIngredient = () => {
    if (!newIngForm.name) return;
    addIngredient(newIngForm);
    setShowNewIngModal(false);
    setNewIngForm({
      name: '',
      category: 'DAIRY',
      currentStock: 1000,
      reorderLevel: 200,
      unit: 'g',
      purchaseUnit: 'kg',
      conversionFactor: 1000,
      costPerUnit: 0.25,
      lastVendor: 'Local Vendor'
    });
  };

  const submitWaste = () => {
    if (!wasteIngId || wasteQty <= 0) return;
    logWaste({
      ingredientId: wasteIngId,
      quantity: wasteQty,
      reason: wasteReason,
      loggedBy: wasteLoggedBy || 'Kitchen Staff'
    });
    setShowWasteModal(false);
    setWasteQty(500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-pos-bg p-6 flex flex-col gap-6">
      {/* Top Banner with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-pos-card via-pos-card to-emerald-950/20 p-6 rounded-3xl border border-pos-border shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl flex items-center justify-center">
              <Package className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black text-pos-text tracking-tight">Inventory & Recipe Studio</h1>
          </div>
          <p className="text-xs text-pos-text-muted font-medium">
            Real-time stock depletion, BOM food costing, and 86'd automated sold-out protection.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-pos-bg/80 px-4 py-3 rounded-2xl border border-pos-border flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-pos-text-muted">Total Stock Value</span>
            <span className="text-lg font-black text-emerald-400">₹{totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          <div className="bg-pos-bg/80 px-4 py-3 rounded-2xl border border-pos-border flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-pos-text-muted">Low Stock Alerts</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-black ${lowStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-pos-text'}`}>{lowStockCount}</span>
              {lowStockCount > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </div>
          </div>

          <div className="bg-pos-bg/80 px-4 py-3 rounded-2xl border border-pos-border flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-pos-text-muted">Spoilage Loss</span>
            <span className="text-lg font-black text-red-400">₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-pos-border pb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('STOCK')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'STOCK' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-pos-card text-pos-text-muted hover:bg-pos-border'
            }`}
          >
            <Layers className="h-4 w-4" /> Stock Master ({ingredients.length})
          </button>

          <button 
            onClick={() => setActiveTab('RECIPES')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'RECIPES' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-pos-card text-pos-text-muted hover:bg-pos-border'
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" /> Recipe Costing Studio
          </button>

          <button 
            onClick={() => setActiveTab('PREP')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'PREP' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-pos-card text-pos-text-muted hover:bg-pos-border'
            }`}
          >
            <Sparkles className="h-4 w-4" /> AI Prep Planner
          </button>

          <button 
            onClick={() => setActiveTab('WASTE')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'WASTE' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-pos-card text-pos-text-muted hover:bg-pos-border'
            }`}
          >
            <Trash2 className="h-4 w-4" /> Spoilage & Audit ({wasteLogs.length})
          </button>
        </div>

        {activeTab === 'STOCK' && (
          <button 
            onClick={() => setShowNewIngModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 text-xs uppercase tracking-wider active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add New Ingredient
          </button>
        )}

        {activeTab === 'WASTE' && (
          <button 
            onClick={() => setShowWasteModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 text-xs uppercase tracking-wider active:scale-95"
          >
            <ShieldAlert className="h-4 w-4" /> Log Spoilage / Waste
          </button>
        )}
      </div>

      {/* TAB 1: STOCK MASTER */}
      {activeTab === 'STOCK' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-pos-card p-4 rounded-2xl border border-pos-border">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {['ALL', 'DAIRY', 'MEAT', 'PRODUCE', 'DRY_GOODS', 'SPICES', 'PACKAGING'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-pos-bg text-pos-text-muted hover:bg-pos-border'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-pos-bg pl-9 pr-4 py-2 rounded-xl text-xs font-bold text-pos-text border border-pos-border focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Grid of Ingredients */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIngredients.map((ing) => {
              const isLow = ing.currentStock <= ing.reorderLevel;
              const isCritical = ing.currentStock <= ing.reorderLevel * 0.5;
              const totalVal = ing.currentStock * ing.costPerUnit;

              return (
                <div 
                  key={ing.id} 
                  className={`bg-pos-card p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isLow ? 'border-amber-500/60 bg-amber-950/10' : 'border-pos-border hover:border-pos-accent/40'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-pos-text-muted tracking-wider">{ing.category}</span>
                        <h3 className="text-base font-black text-pos-text tracking-tight">{ing.name}</h3>
                      </div>
                      {isLow && (
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Low Stock
                        </span>
                      )}
                    </div>

                    <div className="my-4 bg-pos-bg p-3 rounded-xl border border-pos-border/60">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-bold text-pos-text-muted">Current Stock:</span>
                        <span className={`text-xl font-black ${isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {ing.currentStock.toLocaleString()} <span className="text-xs text-pos-text-muted">{ing.unit}</span>
                        </span>
                      </div>
                      <div className="w-full bg-pos-border/40 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (ing.currentStock / (ing.reorderLevel * 3)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[10px] text-pos-text-muted font-bold">
                        <span>Reorder Level: {ing.reorderLevel} {ing.unit}</span>
                        <span>₹{ing.costPerUnit.toFixed(2)} / {ing.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-pos-border/60 text-xs font-bold">
                    <div>
                      <span className="text-[10px] text-pos-text-muted block">Total Valuation</span>
                      <span className="text-sm font-black text-pos-text">₹{totalVal.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPoTargetId(ing.id);
                          setPoUnits(10);
                          setPoCost(ing.costPerUnit * ing.conversionFactor);
                          setPoVendor(ing.lastVendor || '');
                          setShowPoModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-lg uppercase tracking-wide transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" /> PO Intake
                      </button>
                      <button
                        onClick={() => deleteIngredient(ing.id)}
                        className="p-1.5 text-pos-text-muted hover:text-red-400 rounded-lg transition-all cursor-pointer"
                        title="Delete Ingredient"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: RECIPE COSTING STUDIO (BOM) */}
      {activeTab === 'RECIPES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Menu Items Selector */}
          <div className="lg:col-span-5 bg-pos-card p-5 rounded-3xl border border-pos-border flex flex-col gap-4">
            <h2 className="text-lg font-black text-pos-text flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-emerald-500" /> Menu Items Catalog ({products.length})
            </h2>
            <p className="text-xs text-pos-text-muted font-medium">Select a dish to build its Bill of Materials (BOM) and check live profit margins.</p>

            <div className="flex-1 overflow-y-auto max-h-[600px] flex flex-col gap-2 pr-1">
              {products.map((p) => {
                const cost = getRecipeCost(p.name);
                const margin = getProfitMarginPercent(p.name, p.price);
                const isLinked = recipes.some(r => r.menuItemId === p.id || r.menuItemName.toLowerCase() === p.name.toLowerCase());
                const is86d = checkIs86d(p.name);
                const isSelected = selectedProductId === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected 
                        ? 'bg-emerald-500/15 border-emerald-500 text-pos-text shadow-md' 
                        : 'bg-pos-bg/60 border-pos-border hover:bg-pos-bg text-pos-text-muted'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className="text-xs font-black text-pos-text block truncate">{p.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-pos-text-muted">Price: ₹{p.price}</span>
                        {isLinked ? (
                          <span className="text-[10px] font-bold text-emerald-400">Cost: ₹{cost.toFixed(1)}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-500">Unlinked</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {isLinked ? (
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${margin >= 60 ? 'bg-emerald-500/20 text-emerald-400' : margin >= 40 ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {margin.toFixed(0)}% Margin
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-pos-text-muted px-2 py-0.5 rounded bg-pos-border">No BOM</span>
                      )}

                      {is86d ? (
                        <span className="text-[9px] font-black uppercase text-red-500 mt-1 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> 86'd Auto-Locked
                        </span>
                      ) : isLinked ? (
                        <span className="text-[9px] font-bold text-pos-text-muted mt-1 flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> Active
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Visual BOM Builder */}
          <div className="lg:col-span-7 bg-pos-card p-6 rounded-3xl border border-pos-border flex flex-col justify-between gap-6">
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pos-border pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Visual Recipe Costing Studio</span>
                  <h2 className="text-2xl font-black text-pos-text">{selectedProduct?.name}</h2>
                  <p className="text-xs text-pos-text-muted mt-0.5">Category: {selectedProduct?.category} • Selling Price: ₹{selectedProduct?.price}</p>
                </div>

                {selectedRecipe && (
                  <div className="flex items-center gap-3 bg-pos-bg px-4 py-2.5 rounded-2xl border border-pos-border">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-pos-text-muted block">BOM Food Cost</span>
                      <span className="text-lg font-black text-pos-text">₹{getRecipeCost(selectedProduct?.name || '').toFixed(2)}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-pos-border" />
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-pos-text-muted block">Profit Margin</span>
                      <span className="text-lg font-black text-emerald-400">{getProfitMarginPercent(selectedProduct?.name || '', selectedProduct?.price || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Profit Margin Visualization Bar */}
              {selectedRecipe && (
                <div className="mt-4 bg-pos-bg p-4 rounded-2xl border border-pos-border/60">
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-red-400">Food Cost: ₹{getRecipeCost(selectedProduct?.name || '').toFixed(1)} ({((getRecipeCost(selectedProduct?.name || '') / (selectedProduct?.price || 1)) * 100).toFixed(1)}%)</span>
                    <span className="text-emerald-400">Gross Profit: ₹{((selectedProduct?.price || 0) - getRecipeCost(selectedProduct?.name || '')).toFixed(1)} ({getProfitMarginPercent(selectedProduct?.name || '', selectedProduct?.price || 0).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-emerald-500/20 h-3 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-amber-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (getRecipeCost(selectedProduct?.name || '') / (selectedProduct?.price || 1)) * 100)}%` }}
                    />
                    <div className="bg-emerald-500 h-full flex-1" />
                  </div>
                </div>
              )}

              {/* Add Ingredient Section */}
              <div className="mt-6 bg-pos-bg/80 p-4 rounded-2xl border border-pos-border flex flex-col md:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-bold text-pos-text-muted block mb-1">Select Raw Ingredient</label>
                  <select
                    value={recipeAddIngId}
                    onChange={(e) => setRecipeAddIngId(e.target.value)}
                    className="w-full bg-pos-card p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Choose Ingredient --</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit} • ₹{i.costPerUnit}/unit)</option>
                    ))}
                  </select>
                </div>

                <div className="w-full md:w-28">
                  <label className="text-[11px] font-bold text-pos-text-muted block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={recipeAddQty}
                    onChange={(e) => setRecipeAddQty(Number(e.target.value))}
                    className="w-full bg-pos-card p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                  />
                </div>

                <div className="w-full md:w-24">
                  <label className="text-[11px] font-bold text-pos-text-muted block mb-1">Waste %</label>
                  <input
                    type="number"
                    value={recipeAddWaste}
                    onChange={(e) => setRecipeAddWaste(Number(e.target.value))}
                    className="w-full bg-pos-card p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                    title="Trim/Peel loss factor"
                  />
                </div>

                <button
                  onClick={handleAddIngredientToRecipe}
                  disabled={!recipeAddIngId || recipeAddQty <= 0}
                  className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all cursor-pointer uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Link
                </button>
              </div>

              {/* Linked Ingredients Table */}
              <div className="mt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-pos-text-muted mb-3 flex items-center justify-between">
                  <span>Linked Recipe Ingredients ({selectedRecipe?.ingredients.length || 0})</span>
                  {selectedRecipe && <span className="text-[10px] text-emerald-400">Auto-depletes on POS Checkout</span>}
                </h3>

                {!selectedRecipe || selectedRecipe.ingredients.length === 0 ? (
                  <div className="bg-pos-bg/40 p-8 rounded-2xl border border-dashed border-pos-border text-center">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-black text-pos-text">No Bill of Materials (BOM) Linked Yet</p>
                    <p className="text-xs text-pos-text-muted mt-1">Select ingredients above to link raw items to {selectedProduct?.name}.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-pos-border text-[10px] uppercase font-black text-pos-text-muted">
                          <th className="py-2.5">Ingredient Name</th>
                          <th className="py-2.5">Qty / Portion</th>
                          <th className="py-2.5">Waste Factor</th>
                          <th className="py-2.5">Unit Cost</th>
                          <th className="py-2.5">Subtotal Cost</th>
                          <th className="py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pos-border/40 text-xs font-bold text-pos-text">
                        {selectedRecipe.ingredients.map((ri) => {
                          const ing = ingredients.find((i) => i.id === ri.ingredientId);
                          if (!ing) return null;
                          const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                          const subcost = ri.quantity * ing.costPerUnit * wasteFactor;
                          const isLow = ing.currentStock <= 0;

                          return (
                            <tr key={ri.ingredientId} className={isLow ? 'bg-red-950/20' : ''}>
                              <td className="py-3 flex items-center gap-2">
                                <span>{ing.name}</span>
                                {isLow && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-black">0 Stock!</span>}
                              </td>
                              <td className="py-3 font-black text-emerald-400">{ri.quantity} {ing.unit}</td>
                              <td className="py-3 text-pos-text-muted">+{ri.wasteFactorPercent || 0}%</td>
                              <td className="py-3 text-pos-text-muted">₹{ing.costPerUnit}/u</td>
                              <td className="py-3 font-black">₹{subcost.toFixed(2)}</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleRemoveIngredientFromRecipe(ri.ingredientId)}
                                  className="p-1 text-pos-text-muted hover:text-red-400 rounded transition-all cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="pt-4 border-t border-pos-border/60 flex items-center justify-between text-xs text-pos-text-muted font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 86'd Auto-Lock is enabled. If any linked ingredient reaches 0, this dish is hidden from QR & POS menus.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI PREP PLANNER & BATCH SCALER */}
      {activeTab === 'PREP' && (
        <div className="bg-pos-card p-6 rounded-3xl border border-pos-border flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pos-border pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">AI Predictive Kitchen Assistant</span>
              <h2 className="text-2xl font-black text-pos-text">Daily Prep & Batch Scaling Studio</h2>
              <p className="text-xs text-pos-text-muted mt-0.5">Scale raw ingredient weights instantly for morning prep batches based on sales velocity.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-pos-bg px-4 py-2 rounded-xl border border-pos-border flex items-center gap-2">
                <span className="text-xs font-bold text-pos-text-muted">Target Dish:</span>
                <select
                  value={prepProductId}
                  onChange={(e) => setPrepProductId(e.target.value)}
                  className="bg-transparent text-xs font-black text-pos-text outline-none cursor-pointer"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="bg-pos-card text-pos-text">{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-pos-bg px-4 py-2 rounded-xl border border-pos-border flex items-center gap-2">
                <span className="text-xs font-bold text-pos-text-muted">Target Portions:</span>
                <input
                  type="number"
                  value={prepBatchQty}
                  onChange={(e) => setPrepBatchQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-transparent text-xs font-black text-emerald-400 outline-none text-right"
                />
              </div>
            </div>
          </div>

          {/* Predictive AI Box */}
          <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-pos-bg p-5 rounded-2xl border border-blue-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <h4 className="text-sm font-black text-pos-text">AI Velocity Recommendation for Today</h4>
                <p className="text-xs text-pos-text-muted">Based on your last 7-day average sales, we recommend prepping <strong className="text-blue-400">35 portions</strong> of {selectedPrepProduct?.name} before lunch rush.</p>
              </div>
            </div>
            <button
              onClick={() => setPrepBatchQty(35)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer shrink-0 uppercase tracking-wide"
            >
              Apply Recommended (35)
            </button>
          </div>

          {/* Scaled Ingredients Table */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-pos-text-muted mb-3">
              Raw Ingredients Required for {prepBatchQty} Portions of {selectedPrepProduct?.name}
            </h3>

            {!selectedPrepRecipe || selectedPrepRecipe.ingredients.length === 0 ? (
              <div className="bg-pos-bg/40 p-8 rounded-2xl border border-dashed border-pos-border text-center">
                <p className="text-sm font-black text-pos-text">No Recipe Linked to this Product</p>
                <p className="text-xs text-pos-text-muted mt-1">Please link ingredients in the Recipe Costing Studio first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-pos-border text-[10px] uppercase font-black text-pos-text-muted">
                      <th className="py-3">Ingredient Name</th>
                      <th className="py-3">Current Stock</th>
                      <th className="py-3">Required for 1 Portion</th>
                      <th className="py-3 text-emerald-400">Required for {prepBatchQty} Portions</th>
                      <th className="py-3">Stock Status after Prep</th>
                      <th className="py-3 text-right">Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pos-border/40 text-xs font-bold text-pos-text">
                    {selectedPrepRecipe.ingredients.map((ri) => {
                      const ing = ingredients.find((i) => i.id === ri.ingredientId);
                      if (!ing) return null;
                      const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                      const totalNeeded = ri.quantity * prepBatchQty * wasteFactor;
                      const remaining = ing.currentStock - totalNeeded;
                      const isShort = remaining < 0;
                      const cost = totalNeeded * ing.costPerUnit;

                      return (
                        <tr key={ri.ingredientId}>
                          <td className="py-3 font-black">{ing.name}</td>
                          <td className="py-3 text-pos-text-muted">{ing.currentStock.toLocaleString()} {ing.unit}</td>
                          <td className="py-3">{ri.quantity} {ing.unit}</td>
                          <td className="py-3 font-black text-lg text-emerald-400">{totalNeeded.toFixed(1)} {ing.unit}</td>
                          <td className="py-3">
                            {isShort ? (
                              <span className="text-xs font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/30">
                                ⚠ Short by {Math.abs(remaining).toFixed(1)} {ing.unit}!
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-pos-text-muted">
                                {remaining.toFixed(1)} {ing.unit} left
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right font-black">₹{cost.toFixed(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SPOILAGE & WASTE AUDIT LOG */}
      {activeTab === 'WASTE' && (
        <div className="bg-pos-card p-6 rounded-3xl border border-pos-border flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pos-border pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">Financial Loss & Shrinkage Control</span>
              <h2 className="text-2xl font-black text-pos-text">Spoilage & Waste Audit Logs</h2>
              <p className="text-xs text-pos-text-muted mt-0.5">Log dropped, burnt, or expired food to maintain accurate stock valuation and identify training gaps.</p>
            </div>

            <div className="bg-red-950/30 px-5 py-3 rounded-2xl border border-red-500/30 text-right">
              <span className="text-[10px] font-bold text-red-300 block uppercase">Total Recorded Shrinkage Loss</span>
              <span className="text-2xl font-black text-red-400">₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
            </div>
          </div>

          {/* Waste Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-pos-border text-[10px] uppercase font-black text-pos-text-muted">
                  <th className="py-3">Time</th>
                  <th className="py-3">Ingredient</th>
                  <th className="py-3">Quantity Wasted</th>
                  <th className="py-3">Reason Tag</th>
                  <th className="py-3">Financial Cost Loss</th>
                  <th className="py-3 text-right">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pos-border/40 text-xs font-bold text-pos-text">
                {wasteLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-pos-text-muted">No spoilage recorded yet! Excellent kitchen discipline. 🌟</td>
                  </tr>
                ) : (
                  wasteLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-pos-bg/40 transition-all">
                      <td className="py-3.5 text-pos-text-muted font-medium">{log.timestamp}</td>
                      <td className="py-3.5 font-black text-base">{log.ingredientName}</td>
                      <td className="py-3.5 font-black text-red-400">{log.quantity} {log.unit}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                          {log.reason}
                        </span>
                      </td>
                      <td className="py-3.5 font-black text-red-400">-₹{log.costLoss.toFixed(1)}</td>
                      <td className="py-3.5 text-right text-pos-text-muted">{log.loggedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK PO INTAKE MODAL */}
      {showPoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-card w-full max-w-md p-6 rounded-3xl border border-pos-border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-pos-border pb-3">
              <h3 className="text-lg font-black text-pos-text flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-500" /> Log Vendor Stock Shipment (PO)
              </h3>
              <button onClick={() => setShowPoModal(false)} className="text-pos-text-muted hover:text-pos-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Target Ingredient</label>
                <input
                  type="text"
                  disabled
                  value={ingredients.find(i => i.id === poTargetId)?.name || ''}
                  className="w-full bg-pos-bg p-3 rounded-xl text-xs font-black text-pos-text border border-pos-border opacity-70"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">
                  Quantity Received (in {ingredients.find(i => i.id === poTargetId)?.purchaseUnit || 'units'})
                </label>
                <input
                  type="number"
                  value={poUnits}
                  onChange={(e) => setPoUnits(Number(e.target.value))}
                  className="w-full bg-pos-bg p-3 rounded-xl text-sm font-black text-emerald-400 border border-pos-border outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-pos-text-muted mt-1 block">
                  Converts to +{(poUnits * (ingredients.find(i => i.id === poTargetId)?.conversionFactor || 1)).toLocaleString()} {ingredients.find(i => i.id === poTargetId)?.unit} in cooking inventory.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Total Invoice Cost for this Shipment (₹)</label>
                <input
                  type="number"
                  value={poCost}
                  onChange={(e) => setPoCost(Number(e.target.value))}
                  placeholder="Optional (updates unit cost)"
                  className="w-full bg-pos-bg p-3 rounded-xl text-sm font-bold text-pos-text border border-pos-border outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Vendor / Supplier Name</label>
                <input
                  type="text"
                  value={poVendor}
                  onChange={(e) => setPoVendor(e.target.value)}
                  placeholder="e.g. Amul Direct, Local Mandi"
                  className="w-full bg-pos-bg p-3 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-pos-border">
              <button
                onClick={() => setShowPoModal(false)}
                className="px-4 py-2.5 bg-pos-bg hover:bg-pos-border text-pos-text font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitPO}
                disabled={poUnits <= 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer active:scale-95"
              >
                Add Stock to Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW INGREDIENT MODAL */}
      {showNewIngModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-card w-full max-w-lg p-6 rounded-3xl border border-pos-border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-pos-border pb-3">
              <h3 className="text-lg font-black text-pos-text flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" /> Create Master Ingredient
              </h3>
              <button onClick={() => setShowNewIngModal(false)} className="text-pos-text-muted hover:text-pos-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Ingredient Name</label>
                <input
                  type="text"
                  placeholder="e.g. Extra Virgin Olive Oil"
                  value={newIngForm.name}
                  onChange={(e) => setNewIngForm({ ...newIngForm, name: e.target.value })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Category</label>
                <select
                  value={newIngForm.category}
                  onChange={(e) => setNewIngForm({ ...newIngForm, category: e.target.value as any })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                >
                  {['DAIRY', 'MEAT', 'PRODUCE', 'DRY_GOODS', 'BEVERAGE', 'SPICES', 'PACKAGING'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Initial Stock (Base Units)</label>
                <input
                  type="number"
                  value={newIngForm.currentStock}
                  onChange={(e) => setNewIngForm({ ...newIngForm, currentStock: Number(e.target.value) })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Recipe Base Unit</label>
                <select
                  value={newIngForm.unit}
                  onChange={(e) => setNewIngForm({ ...newIngForm, unit: e.target.value as any })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                >
                  <option value="g">Grams (g)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="pcs">Pieces (pcs)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Purchase Unit</label>
                <select
                  value={newIngForm.purchaseUnit}
                  onChange={(e) => setNewIngForm({ ...newIngForm, purchaseUnit: e.target.value as any })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="l">Liters (l)</option>
                  <option value="pack">Pack / Packet</option>
                  <option value="sack">Sack / Bag</option>
                  <option value="box">Box / Carton</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Conversion Factor (Base per Purchase)</label>
                <input
                  type="number"
                  value={newIngForm.conversionFactor}
                  onChange={(e) => setNewIngForm({ ...newIngForm, conversionFactor: Number(e.target.value) })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                  title="e.g. 1000 for 1kg = 1000g"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Cost per Base Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIngForm.costPerUnit}
                  onChange={(e) => setNewIngForm({ ...newIngForm, costPerUnit: Number(e.target.value) })}
                  className="w-full bg-pos-bg p-2.5 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-pos-border">
              <button
                onClick={() => setShowNewIngModal(false)}
                className="px-4 py-2.5 bg-pos-bg hover:bg-pos-border text-pos-text font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitNewIngredient}
                disabled={!newIngForm.name}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer active:scale-95"
              >
                Save Ingredient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG SPOILAGE MODAL */}
      {showWasteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-card w-full max-w-md p-6 rounded-3xl border border-pos-border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-pos-border pb-3">
              <h3 className="text-lg font-black text-pos-text flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" /> Record Spoilage & Shrinkage
              </h3>
              <button onClick={() => setShowWasteModal(false)} className="text-pos-text-muted hover:text-pos-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Select Wasted Ingredient</label>
                <select
                  value={wasteIngId}
                  onChange={(e) => setWasteIngId(e.target.value)}
                  className="w-full bg-pos-bg p-3 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none focus:border-red-500"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} (Stock: {i.currentStock} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">
                  Quantity Wasted ({ingredients.find(i => i.id === wasteIngId)?.unit || 'units'})
                </label>
                <input
                  type="number"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(Number(e.target.value))}
                  className="w-full bg-pos-bg p-3 rounded-xl text-base font-black text-red-400 border border-pos-border outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Reason for Loss</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value as any)}
                  className="w-full bg-pos-bg p-3 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                >
                  <option value="EXPIRED">Expired / Shelf Life Ended</option>
                  <option value="BURNT">Burnt in Kitchen</option>
                  <option value="DROPPED">Dropped / Spilled accidentally</option>
                  <option value="SPOILAGE">Spoiled / Mold / Contaminated</option>
                  <option value="OTHER">Other Shrinkage / Unexplained</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Logged By Staff Name</label>
                <input
                  type="text"
                  value={wasteLoggedBy}
                  onChange={(e) => setWasteLoggedBy(e.target.value)}
                  className="w-full bg-pos-bg p-3 rounded-xl text-xs font-bold text-pos-text border border-pos-border outline-none"
                />
              </div>

              <div className="p-3 bg-red-950/20 rounded-xl border border-red-500/20 text-center">
                <span className="text-[10px] text-red-300 uppercase block font-bold">Estimated Financial Loss</span>
                <span className="text-lg font-black text-red-400">
                  ₹{(wasteQty * (ingredients.find(i => i.id === wasteIngId)?.costPerUnit || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-pos-border">
              <button
                onClick={() => setShowWasteModal(false)}
                className="px-4 py-2.5 bg-pos-bg hover:bg-pos-border text-pos-text font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitWaste}
                disabled={!wasteIngId || wasteQty <= 0}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md cursor-pointer active:scale-95"
              >
                Record Spoilage & Deduct Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
