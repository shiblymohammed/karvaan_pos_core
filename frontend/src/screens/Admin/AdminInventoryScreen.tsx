import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Plus, Search, AlertTriangle, CheckCircle2, TrendingUp, 
  DollarSign, UtensilsCrossed, Trash2, Edit3, ArrowUpRight, Scale, 
  Sparkles, ShieldAlert, ShoppingCart, Filter, ChevronRight, Calculator,
  Printer, Layers, RefreshCw, X, ArrowLeft, LayoutGrid, AlertCircle, ChevronDown
} from 'lucide-react';
import { useInventoryStore, Ingredient, Recipe, RecipeItem } from '../../store/useInventoryStore';
import { useMenuStore } from '../../store/useMenuStore';
import CustomSelect from '../../components/shared/CustomSelect';

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
  const totalInventoryValue = ingredients.reduce((sum, i) => sum + (i.currentStock * (i.costPerUnit || 0)), 0);
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
    <div className="flex-1 overflow-y-auto p-3 sm:px-4 flex flex-col gap-3 pb-24 sm:pb-6 relative">
      {/* Top Banner with Stats */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white/70 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-white/60 shadow-md">
        <div className="flex flex-row items-center gap-2 sm:gap-3">
          <div className="bg-violet-100 text-violet-700 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex items-center justify-center border border-violet-200">
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight">
              Inventory <span className="hidden sm:inline">& Recipe Studio</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
              Stock, recipes, and <span className="hidden sm:inline">automated </span>86'd protection.
            </p>
          </div>
        </div>

        {/* Swipeable Stats Carousel on Mobile */}
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:pb-0 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 gap-3 scrollbar-hide snap-x">
          <div className="snap-center shrink-0 w-[45%] sm:w-auto bg-white/80 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-white/60 shadow-sm flex flex-col justify-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-slate-400">Total Stock Value</span>
            <span className="text-base sm:text-lg font-black text-emerald-600 truncate">₹{totalInventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          <div className="snap-center shrink-0 w-[45%] sm:w-auto bg-white/80 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-white/60 shadow-sm flex flex-col justify-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-slate-400">Low Stock Alerts</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-base sm:text-lg font-black ${lowStockCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-700'}`}>{lowStockCount}</span>
              {lowStockCount > 0 && <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />}
            </div>
          </div>

          <div className="snap-center shrink-0 w-[45%] sm:w-auto bg-white/80 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-white/60 shadow-sm flex flex-col justify-center">
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold text-slate-400">Spoilage Loss</span>
            <span className="text-base sm:text-lg font-black text-rose-500 truncate">₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Swipeable on Mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x w-full sm:w-auto">
          {(['STOCK', 'RECIPES', 'PREP', 'WASTE'] as const).map((tab) => {
            const labels: Record<string, string> = {
              STOCK: 'Stock Master',
              RECIPES: 'Recipe Studio',
              PREP: 'Prep Planner',
              WASTE: `Spoilage (${wasteLogs.length})`,
            };
            const icons: Record<string, React.ReactNode> = {
              STOCK: <Layers className="h-4 w-4 shrink-0" />,
              RECIPES: <UtensilsCrossed className="h-4 w-4 shrink-0" />,
              PREP: <Sparkles className="h-4 w-4 shrink-0" />,
              WASTE: <Trash2 className="h-4 w-4 shrink-0" />,
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`snap-center shrink-0 relative px-5 py-2 rounded-full font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer z-10 ${
                  activeTab === tab 
                    ? 'text-white border-transparent' 
                    : 'bg-white/50 text-slate-600 border border-white/60 hover:bg-white/80'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="inventoryTab"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full shadow-md z-0"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-2">
                  {icons[tab]}
                  <span className="whitespace-nowrap">{labels[tab]}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Floating Action Buttons on Mobile, Inline on Desktop */}
        <div className="fixed sm:static bottom-[90px] right-6 sm:bottom-auto sm:right-auto z-40 flex flex-col sm:flex-row gap-3 items-end sm:items-center pointer-events-none">
          {activeTab === 'STOCK' && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewIngModal(true)}
              className="px-5 py-3.5 sm:py-2.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] font-black rounded-full sm:rounded-[14px] transition-all cursor-pointer shadow-xl sm:shadow-md shadow-slate-300/50 flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto"
            >
              <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Ingredient</span>
            </motion.button>
          )}

          {activeTab === 'WASTE' && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowWasteModal(true)}
              className="px-5 py-3.5 sm:py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black rounded-full sm:rounded-[14px] transition-all cursor-pointer shadow-xl sm:shadow-md shadow-rose-200 flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto"
            >
              <ShieldAlert className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Log Spoilage</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* TAB 1: STOCK MASTER */}
      {activeTab === 'STOCK' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white/70 backdrop-blur-xl p-3.5 rounded-2xl border border-white/60 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
                {['ALL', 'DAIRY', 'MEAT', 'PRODUCE', 'DRY_GOODS', 'SPICES', 'PACKAGING'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] tracking-wider transition-all cursor-pointer shrink-0 uppercase ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-[#b5ef85] shadow-md'
                        : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800'
                    }`}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/80 pl-11 pr-4 py-2.5 rounded-xl text-sm font-bold text-slate-800 border border-slate-200/60 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all shadow-sm placeholder-slate-400"
                />
              </div>
            </div>

          {/* Grid of Ingredients */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIngredients.map((ing, index) => {
              const isLow = ing.currentStock <= ing.reorderLevel;
              const pct = Math.min(100, (ing.currentStock / (ing.reorderLevel * 3)) * 100);
              const isCritical = pct < 33;
              const isWarning = pct >= 33 && pct < 66;
              const totalVal = ing.currentStock * (ing.costPerUnit || 0);

              const barColor = isCritical ? 'bg-gradient-to-r from-rose-500 to-pink-500' : isWarning ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400';
              const textColor = isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600';
              const bgAccent = isCritical ? 'bg-rose-50/90 border-rose-200 shadow-rose-100/50' : isWarning ? 'bg-amber-50/90 border-amber-200 shadow-amber-100/50' : 'bg-white/80 border-white/60 shadow-slate-200/50';

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
                  key={ing.id} 
                  className={`group backdrop-blur-2xl p-5 rounded-[32px] border shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between gap-5 ${bgAccent}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-2 ${
                          isCritical ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                          isWarning ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-slate-100/80 text-slate-500 border border-slate-200/80'
                        }`}>
                          {ing.category.replace('_', ' ')}
                        </span>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight">{ing.name}</h3>
                      </div>
                      {isLow && (
                        <motion.span 
                          animate={{ opacity: [1, 0.6, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="shrink-0 text-[10px] font-black bg-rose-500 text-white px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-md shadow-rose-200"
                        >
                          <AlertTriangle className="h-3 w-3" /> LOW
                        </motion.span>
                      )}
                    </div>

                    <div className="space-y-2.5 bg-white/40 p-4 rounded-2xl border border-white/50">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Current Stock</span>
                        <span className={`text-3xl font-black tracking-tighter leading-none ${textColor}`}>
                          {(ing.currentStock || 0).toLocaleString()} <span className="text-xs text-slate-400 tracking-normal">{ing.unit}</span>
                        </span>
                      </div>
                      <div className="relative w-full bg-slate-200/60 h-2.5 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: index * 0.1 }}
                          className={`absolute left-0 top-0 bottom-0 rounded-full ${barColor} shadow-[inset_0_1px_rgba(255,255,255,0.3)]`}
                        />
                        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400/80 rounded-full z-10" style={{ left: '33%' }} />
                      </div>
                      <div className="flex justify-between items-center px-0.5 text-[10px] text-slate-400 font-bold">
                        <span>Reorder Level: {ing.reorderLevel} {ing.unit}</span>
                        <span>₹{(ing.costPerUnit || 0).toFixed(2)} / {ing.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Total Valuation</span>
                      <span className="text-base font-black text-slate-800">₹{totalVal.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setPoTargetId(ing.id);
                          setPoUnits(10);
                          setPoCost((ing.costPerUnit || 0) * ing.conversionFactor);
                          setPoVendor(ing.lastVendor || '');
                          setShowPoModal(true);
                        }}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] font-black text-[11px] rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-slate-300/50"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" /> PO Intake
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => deleteIngredient(ing.id)}
                        className="p-2.5 bg-white/60 hover:bg-rose-50 border border-slate-200/80 text-slate-400 hover:text-rose-500 rounded-xl transition-all cursor-pointer shadow-sm"
                        title="Delete Ingredient"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: RECIPE COSTING STUDIO (BOM) */}
      {activeTab === 'RECIPES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
          {/* Left Column: Menu Items Selector */}
          <div className={`lg:col-span-5 bg-white/60 backdrop-blur-xl p-5 sm:p-6 rounded-[32px] border border-white/80 shadow-xl flex-col gap-4 ${selectedProductId ? 'hidden lg:flex' : 'flex'}`}>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1">
                <div className="p-1.5 sm:p-2 bg-emerald-100/50 rounded-xl">
                  <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
                Menu Catalog
                <span className="text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full shadow-sm ml-1">{products.length}</span>
              </h2>
              <p className="text-xs text-slate-500 font-bold ml-12">Select a dish to build its BOM and track live margins.</p>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[600px] flex flex-col gap-3 pr-1 mt-4 scrollbar-hide">
              {products.map((p) => {
                const cost = getRecipeCost(p.name);
                const margin = getProfitMarginPercent(p.name, p.price);
                const isLinked = recipes.some(r => r.menuItemId === p.id || r.menuItemName.toLowerCase() === p.name.toLowerCase());
                const is86d = checkIs86d(p.name);
                const isSelected = selectedProductId === p.id;

                return (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`p-4 rounded-[24px] border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-lg shadow-slate-300' 
                        : 'bg-white/80 border-white hover:bg-white hover:shadow-md'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className={`text-sm font-black block truncate ${isSelected ? 'text-[#b5ef85]' : 'text-slate-800'}`}>{p.name}</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Price: ₹{p.price}</span>
                        {isLinked ? (
                          <span className={`text-[10px] font-black ${isSelected ? 'text-[#8cc63f]' : 'text-emerald-600'}`}>Cost: ₹{cost.toFixed(1)}</span>
                        ) : (
                          <span className={`text-[10px] font-black ${isSelected ? 'text-amber-400' : 'text-amber-500'}`}>Unlinked</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {isLinked ? (
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl shadow-sm border ${
                          margin >= 60 ? (isSelected ? 'bg-[#8cc63f]/20 text-[#b5ef85] border-transparent' : 'bg-emerald-50 text-emerald-600 border-emerald-200') : 
                          margin >= 40 ? (isSelected ? 'bg-blue-500/20 text-blue-300 border-transparent' : 'bg-blue-50 text-blue-600 border-blue-200') : 
                          (isSelected ? 'bg-amber-500/20 text-amber-300 border-transparent' : 'bg-amber-50 text-amber-600 border-amber-200')
                        }`}>
                          {margin.toFixed(0)}% Margin
                        </span>
                      ) : (
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-xl border ${isSelected ? 'text-slate-400 bg-slate-800/50 border-slate-700' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>No BOM</span>
                      )}

                      {is86d ? (
                        <span className={`text-[9px] font-black uppercase tracking-wider mt-2 flex items-center gap-1 ${isSelected ? 'text-rose-400' : 'text-rose-500'}`}>
                          <AlertTriangle className="h-3 w-3" /> 86'd Locked
                        </span>
                      ) : isLinked ? (
                        <span className={`text-[9px] font-black uppercase tracking-wider mt-2 flex items-center gap-1 ${isSelected ? 'text-[#8cc63f]' : 'text-emerald-500'}`}>
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : null}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Visual BOM Builder */}
          <div className={`lg:col-span-7 bg-white/60 backdrop-blur-xl p-4 sm:p-7 rounded-[24px] sm:rounded-[32px] border border-white/80 shadow-xl flex-col justify-between gap-5 sm:gap-6 ${selectedProductId ? 'flex' : 'hidden lg:flex'}`}>
            <div>
              {/* Mobile Back Button */}
              <button 
                onClick={() => setSelectedProductId(null)}
                className="lg:hidden flex items-center gap-1.5 text-[11px] sm:text-xs font-extrabold text-slate-500 hover:text-slate-800 mb-4 bg-white/80 border border-white px-3 sm:px-4 py-2 rounded-xl shadow-sm w-fit active:scale-95 transition-transform"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Menu
              </button>

              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-slate-200/60 pb-4 sm:pb-5">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#6da12c] tracking-widest bg-[#8cc63f]/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-[#8cc63f]/30 shadow-sm inline-block mb-2 sm:mb-3">Recipe Costing Studio</span>
                  <h2 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">{selectedProduct?.name || 'Select an item'}</h2>
                  {selectedProduct && (
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider bg-white/50 px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-100 inline-flex items-center gap-1.5 flex-wrap">
                      <LayoutGrid className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> {selectedProduct.category} 
                      <span className="mx-1 text-slate-300">|</span> 
                      Price: ₹{selectedProduct.price}
                    </p>
                  )}
                </div>

                {selectedRecipe && (
                  <div className="flex items-center justify-between xl:justify-end gap-3 sm:gap-4 bg-white shadow-sm px-4 sm:px-5 py-3 sm:py-4 rounded-[20px] sm:rounded-[24px] border border-slate-100 w-full xl:w-auto mt-2 xl:mt-0">
                    <div className="text-left xl:text-right">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-widest">BOM Cost</span>
                      <span className="text-lg sm:text-xl font-black text-slate-800">₹{getRecipeCost(selectedProduct?.name || '').toFixed(2)}</span>
                    </div>
                    <div className="h-8 sm:h-10 w-[1px] bg-slate-200" />
                    <div className="text-right">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-widest">Profit Margin</span>
                      <span className="text-lg sm:text-xl font-black text-[#8cc63f]">{getProfitMarginPercent(selectedProduct?.name || '', selectedProduct?.price || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Profit Margin Visualization Bar */}
              {selectedRecipe && (
                <div className="mt-5 sm:mt-6 bg-white/70 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-white shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between gap-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-3">
                    <span className="text-rose-500 bg-rose-50 px-2.5 py-1.5 sm:py-1 rounded-lg border border-rose-100 flex justify-between sm:inline-block">
                      <span>Cost</span>
                      <span className="sm:ml-1">₹{getRecipeCost(selectedProduct?.name || '').toFixed(1)} ({((getRecipeCost(selectedProduct?.name || '') / (selectedProduct?.price || 1)) * 100).toFixed(1)}%)</span>
                    </span>
                    <span className="text-[#6da12c] bg-[#8cc63f]/10 px-2.5 py-1.5 sm:py-1 rounded-lg border border-[#8cc63f]/20 flex justify-between sm:inline-block">
                      <span>Profit</span>
                      <span className="sm:ml-1">₹{((selectedProduct?.price || 0) - getRecipeCost(selectedProduct?.name || '')).toFixed(1)} ({getProfitMarginPercent(selectedProduct?.name || '', selectedProduct?.price || 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-[#8cc63f]/20 h-3 sm:h-4 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-700 ease-out shadow-[2px_0_10px_rgba(244,63,94,0.5)]"
                      style={{ width: `${Math.min(100, (getRecipeCost(selectedProduct?.name || '') / (selectedProduct?.price || 1)) * 100)}%` }}
                    />
                    <div className="bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] h-full flex-1 shadow-[inset_0_2px_10px_rgba(181,239,133,0.3)]" />
                  </div>
                </div>
              )}

              {/* Add Ingredient Section */}
              <div className="mt-5 sm:mt-6 bg-white/80 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-white shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 items-end">
                  <div className="col-span-2 md:col-span-5">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5 sm:mb-2">Select Ingredient</label>
                    <CustomSelect
                      value={recipeAddIngId}
                      onChange={(val) => setRecipeAddIngId(val)}
                      options={[
                        { value: '', label: '-- Choose --' },
                        ...ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit} • ₹${i.costPerUnit})` }))
                      ]}
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5 sm:mb-2">Quantity</label>
                    <input
                      type="number"
                      value={recipeAddQty === 0 ? '' : recipeAddQty}
                      onChange={(e) => setRecipeAddQty(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full bg-white/60 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-700 border border-slate-200/80 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5 sm:mb-2 flex items-center gap-1" title="Trim/Peel loss factor">
                      Waste % <AlertCircle className="h-3 w-3 text-slate-300 hidden sm:inline-block" />
                    </label>
                    <input
                      type="number"
                      value={recipeAddWaste === 0 ? '' : recipeAddWaste}
                      onChange={(e) => setRecipeAddWaste(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full bg-white/60 px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-700 border border-slate-200/80 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAddIngredientToRecipe}
                      disabled={!recipeAddIngId || recipeAddQty <= 0}
                      className="w-full px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl transition-all cursor-pointer uppercase tracking-wider shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Link
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Linked Ingredients Table */}
              <div className="mt-5 sm:mt-8 bg-white/70 p-2 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-white shadow-sm">
                <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-2">
                  <span>Linked Ingredients ({selectedRecipe?.ingredients.length || 0})</span>
                  {selectedRecipe && <span className="text-[9px] sm:text-[10px] font-bold text-[#8cc63f] bg-[#8cc63f]/20 px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl shadow-sm border border-[#8cc63f]/30 self-start sm:self-auto w-fit">Auto-depletes on POS</span>}
                </h3>

                {!selectedRecipe || selectedRecipe.ingredients.length === 0 ? (
                  <div className="bg-white/50 p-6 sm:p-10 rounded-2xl sm:rounded-[24px] border-2 border-dashed border-slate-300/60 text-center shadow-inner mx-1">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-slate-100">
                      <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300" />
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-700 tracking-tight">No BOM Linked</p>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1.5 sm:mt-2">Link raw ingredients to track live costs.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mx-1">
                    {selectedRecipe.ingredients.map((ri) => {
                      const ing = ingredients.find((i) => i.id === ri.ingredientId);
                      if (!ing) return null;
                      const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                      const subcost = ri.quantity * ing.costPerUnit * wasteFactor;
                      const isLow = ing.currentStock <= 0;

                      return (
                        <div key={ri.ingredientId} className={`p-4 rounded-[20px] border shadow-sm flex flex-col gap-3 transition-colors ${isLow ? 'bg-rose-50/80 border-rose-200' : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="font-black text-slate-800 text-sm">{ing.name}</span>
                              {isLow && <span className="text-[9px] w-fit bg-rose-500 text-white px-2 py-0.5 rounded-full font-black shadow-sm tracking-wider uppercase mt-1">0 Stock!</span>}
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleRemoveIngredientFromRecipe(ri.ingredientId)}
                              className="p-1.5 bg-white text-slate-400 hover:text-rose-500 rounded-lg shadow-sm border border-slate-200 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </motion.button>
                          </div>

                          <div className="flex items-end justify-between mt-auto border-t border-slate-100 pt-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Qty & Waste</span>
                              <span className="font-black text-emerald-600 text-sm">{ri.quantity} <span className="text-[10px] font-bold text-slate-400">{ing.unit}</span> <span className="text-slate-300 mx-1">|</span> <span className="text-slate-400 text-[10px]">+{ri.wasteFactorPercent || 0}% w</span></span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Subtotal</span>
                              <span className="font-black text-slate-800 text-sm">₹{subcost.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="pt-4 border-t border-white/60 flex items-center justify-between text-[11px] text-slate-400 font-extrabold uppercase tracking-widest mt-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 86'd Auto-Lock Enabled
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI PREP PLANNER & BATCH SCALER */}
      {activeTab === 'PREP' && (
        <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-7 rounded-[32px] border border-white/60 shadow-xl flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-slate-200/60 pb-6">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest bg-blue-100/50 px-2.5 py-1 rounded-lg inline-block mb-3">AI Predictive Kitchen Assistant</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Daily Prep & Batch Scaling Studio</h2>
              <p className="text-xs text-slate-500 mt-2 font-medium">Scale raw ingredient weights instantly for morning prep batches based on sales velocity.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="bg-white/90 px-4 py-3 sm:py-2.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Dish:</span>
                <div className="w-full sm:w-48">
                  <CustomSelect
                    value={prepProductId}
                    onChange={(val) => setPrepProductId(val)}
                    options={products.map((p) => ({ value: p.id, label: p.name }))}
                  />
                </div>
              </div>

              <div className="bg-white/90 px-4 py-3 sm:py-2.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Portions:</span>
                <input
                  type="number"
                  value={prepBatchQty === 0 ? '' : prepBatchQty}
                  onChange={(e) => setPrepBatchQty(e.target.value === '' ? 0 : Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-transparent text-sm sm:text-lg font-black text-emerald-600 outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Predictive AI Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white/60 p-5 sm:p-6 rounded-[24px] border border-blue-100/60 shadow-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <span className="p-3 bg-blue-600 shadow-md shadow-blue-300/50 text-white rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div>
                <h4 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">AI Velocity Recommendation for Today</h4>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Based on your last 7-day average sales, we recommend prepping <strong className="text-blue-600 bg-blue-50 px-1 rounded">35 portions</strong> of {selectedPrepProduct?.name} before lunch rush.</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPrepBatchQty(35)}
              className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 text-white font-black text-[11px] rounded-[14px] transition-all cursor-pointer shrink-0 uppercase tracking-wider"
            >
              Apply Recommended (35)
            </motion.button>
          </div>

          {/* Scaled Ingredients Table */}
          <div className="bg-white/60 p-2 sm:p-6 rounded-[24px] border border-white/80 shadow-sm overflow-hidden">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 px-2">
              Raw Ingredients Required for <span className="text-emerald-600">{prepBatchQty} Portions</span> of {selectedPrepProduct?.name}
            </h3>

            {!selectedPrepRecipe || selectedPrepRecipe.ingredients.length === 0 ? (
              <div className="bg-white/80 p-10 rounded-2xl border border-dashed border-slate-300 text-center shadow-sm">
                <UtensilsCrossed className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-black text-slate-800">No Recipe Linked to this Product</p>
                <p className="text-xs font-bold text-slate-400 mt-1">Please link ingredients in the Recipe Costing Studio first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-2">
                {selectedPrepRecipe.ingredients.map((ri) => {
                  const ing = ingredients.find((i) => i.id === ri.ingredientId);
                  if (!ing) return null;
                  const wasteFactor = 1 + (ri.wasteFactorPercent || 0) / 100;
                  const totalNeeded = ri.quantity * prepBatchQty * wasteFactor;
                  const remaining = ing.currentStock - totalNeeded;
                  const isShort = remaining < 0;
                  const cost = totalNeeded * ing.costPerUnit;

                  return (
                    <div key={ri.ingredientId} className={`p-4 rounded-[20px] border shadow-sm flex flex-col gap-3 transition-colors ${isShort ? 'bg-rose-50/80 border-rose-200' : 'bg-white/80 border-slate-200/80 hover:bg-white'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-sm">{ing.name}</span>
                          <span className="text-[10px] font-extrabold text-slate-400 mt-0.5">Stock: {ing.currentStock.toLocaleString()} {ing.unit}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Req / Port</span>
                          <span className="text-slate-500 font-bold text-xs">{ri.quantity} {ing.unit}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-t border-slate-100 pt-3 mt-auto">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Total Required</span>
                          <span className="font-black text-emerald-600 bg-emerald-50/50 px-2.5 py-1 rounded-lg text-lg border border-emerald-100 shadow-[inset_0_1px_2px_rgba(255,255,255,1)]">{totalNeeded.toFixed(1)} <span className="text-xs text-emerald-500/70">{ing.unit}</span></span>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-1.5">
                          {isShort ? (
                            <span className="text-[10px] font-black text-rose-600 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                              <AlertTriangle className="h-3 w-3" /> Short by {Math.abs(remaining).toFixed(1)} {ing.unit}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {remaining.toFixed(1)} {ing.unit} left
                            </span>
                          )}
                          <span className="text-[10px] font-extrabold text-slate-400 mt-1">Cost: ₹{cost.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SPOILAGE & WASTE AUDIT LOG */}
      {activeTab === 'WASTE' && (
        <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-7 rounded-[32px] border border-white/60 shadow-xl flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-slate-200/60 pb-6">
            <div>
              <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest bg-rose-100/50 px-2.5 py-1 rounded-lg inline-block mb-3">Financial Loss & Shrinkage Control</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Spoilage & Waste Audit Logs</h2>
              <p className="text-xs text-slate-500 mt-2 font-medium">Log dropped, burnt, or expired food to maintain accurate stock valuation and identify training gaps.</p>
            </div>

            <div className="bg-white/90 px-6 py-4 rounded-2xl border border-rose-200 shadow-sm text-right flex flex-col justify-center">
              <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-widest mb-0.5">Total Recorded Shrinkage Loss</span>
              <span className="text-2xl sm:text-3xl font-black text-rose-500 tracking-tighter">₹{totalWasteLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
            </div>
          </div>

          {/* Waste Logs Table */}
          <div className="bg-white/60 p-2 sm:p-6 rounded-[24px] border border-white/80 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-2">
              {wasteLogs.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white/50 rounded-2xl border-2 border-dashed border-slate-300/60 shadow-inner">
                  <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-base font-black text-slate-800">No spoilage recorded yet!</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">Excellent kitchen discipline. 🌟</p>
                </div>
              ) : (
                wasteLogs.map((log) => (
                  <div key={log.id} className="p-4 rounded-[20px] bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-sm">{log.ingredientName}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{log.timestamp}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 border border-rose-200 shadow-sm">
                        {log.reason}
                      </span>
                    </div>

                    <div className="flex items-end justify-between border-t border-slate-100 pt-3 mt-auto">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Wasted</span>
                        <span className="font-black text-rose-500 text-lg">{log.quantity} <span className="text-xs font-bold text-rose-400/70">{log.unit}</span></span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Loss</span>
                        <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">-₹{(log.costLoss || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* STOCK PO INTAKE MODAL */}
      <AnimatePresence>
      {showPoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPoModal(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-white rounded-[32px] border border-white/80 p-6 sm:p-8 space-y-6 shadow-[0_32px_80px_rgba(0,0,0,0.15)] z-10 max-h-[90vh] overflow-y-auto hide-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-violet-100 rounded-xl"><ShoppingCart className="h-5 w-5 text-violet-600" /></div> Vendor PO Intake
              </h3>
              <button onClick={() => setShowPoModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Target Ingredient</label>
                <input
                  type="text"
                  disabled
                  value={ingredients.find(i => i.id === poTargetId)?.name || ''}
                  className="w-full px-4 py-3.5 bg-slate-100/50 border border-slate-200 rounded-2xl text-slate-500 text-sm font-bold shadow-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">
                  Qty Received ({ingredients.find(i => i.id === poTargetId)?.purchaseUnit || 'units'})
                </label>
                <input
                  type="number"
                  value={poUnits === 0 ? '' : poUnits}
                  onChange={(e) => setPoUnits(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-4 py-3.5 bg-violet-50/30 border border-violet-200 rounded-2xl text-violet-900 text-lg font-black focus:bg-white focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="mt-2 flex items-center gap-2 pl-1">
                  <ArrowUpRight className="h-4 w-4 text-violet-500" />
                  <span className="text-[11px] font-bold text-slate-500">
                    Adds <span className="text-violet-600 font-black">+{(poUnits * (ingredients.find(i => i.id === poTargetId)?.conversionFactor || 1)).toLocaleString()}</span> {ingredients.find(i => i.id === poTargetId)?.unit} to cooking stock
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Total Invoice Cost (₹)</label>
                <input
                  type="number"
                  value={poCost === 0 ? '' : poCost}
                  onChange={(e) => setPoCost(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="Optional (updates unit cost)"
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/20 shadow-sm transition-all placeholder-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Vendor / Supplier</label>
                <input
                  type="text"
                  value={poVendor}
                  onChange={(e) => setPoVendor(e.target.value)}
                  placeholder="e.g. Amul Direct, Local Mandi"
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/20 shadow-sm transition-all placeholder-slate-400"
                />
              </div>
            </div>

            <div className="pt-6 mt-2 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
              <button
                onClick={() => setShowPoModal(false)}
                className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={submitPO}
                disabled={poUnits <= 0}
                className="flex-[2] py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black text-sm rounded-2xl shadow-md shadow-violet-200 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Add to Stock
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* NEW INGREDIENT MODAL */}
      <AnimatePresence>
      {showNewIngModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewIngModal(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-2xl bg-white rounded-[32px] border border-white/80 p-6 sm:p-8 space-y-6 shadow-[0_32px_80px_rgba(0,0,0,0.15)] z-10 max-h-[90vh] overflow-y-auto hide-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-emerald-100 rounded-xl"><Plus className="h-5 w-5 text-emerald-600" /></div> Create Master Ingredient
              </h3>
              <button onClick={() => setShowNewIngModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Ingredient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Extra Virgin Olive Oil"
                  value={newIngForm.name}
                  onChange={(e) => setNewIngForm({ ...newIngForm, name: e.target.value })}
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Category</label>
                <CustomSelect 
                  value={newIngForm.category}
                  onChange={(val) => setNewIngForm({ ...newIngForm, category: val as any })}
                  options={[
                    { value: 'DAIRY', label: 'DAIRY' },
                    { value: 'MEAT', label: 'MEAT' },
                    { value: 'PRODUCE', label: 'PRODUCE' },
                    { value: 'DRY_GOODS', label: 'DRY GOODS' },
                    { value: 'BEVERAGE', label: 'BEVERAGE' },
                    { value: 'SPICES', label: 'SPICES' },
                    { value: 'PACKAGING', label: 'PACKAGING' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Initial Stock</label>
                <input
                  type="number"
                  value={newIngForm.currentStock === 0 ? '' : newIngForm.currentStock}
                  onChange={(e) => setNewIngForm({ ...newIngForm, currentStock: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Recipe Base Unit</label>
                <CustomSelect 
                  value={newIngForm.unit}
                  onChange={(val) => setNewIngForm({ ...newIngForm, unit: val as any })}
                  options={[
                    { value: 'g', label: 'Grams (g)' },
                    { value: 'ml', label: 'Milliliters (ml)' },
                    { value: 'pcs', label: 'Pieces (pcs)' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Purchase Unit</label>
                <CustomSelect 
                  value={newIngForm.purchaseUnit}
                  onChange={(val) => setNewIngForm({ ...newIngForm, purchaseUnit: val as any })}
                  options={[
                    { value: 'kg', label: 'Kilograms (kg)' },
                    { value: 'l', label: 'Liters (l)' },
                    { value: 'pack', label: 'Pack / Packet' },
                    { value: 'sack', label: 'Sack / Bag' },
                    { value: 'box', label: 'Box / Carton' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Conversion Factor</label>
                <input
                  type="number"
                  value={newIngForm.conversionFactor === 0 ? '' : newIngForm.conversionFactor}
                  onChange={(e) => setNewIngForm({ ...newIngForm, conversionFactor: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  title="e.g. 1000 for 1kg = 1000g"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1">Cost per Base Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newIngForm.costPerUnit === 0 ? '' : newIngForm.costPerUnit}
                  onChange={(e) => setNewIngForm({ ...newIngForm, costPerUnit: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:bg-white focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 shadow-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="pt-6 mt-2 flex flex-col sm:flex-row gap-3 border-t border-slate-100">
              <button
                onClick={() => setShowNewIngModal(false)}
                className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={submitNewIngredient}
                disabled={!newIngForm.name}
                className="flex-[2] py-3.5 bg-slate-800 hover:bg-slate-900 text-[#b5ef85] disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 font-black text-sm rounded-2xl shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Save Ingredient
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

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
                <CustomSelect
                  value={wasteIngId}
                  onChange={(val) => setWasteIngId(val)}
                  options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (Stock: ${i.currentStock} ${i.unit})` }))}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">
                  Quantity Wasted ({ingredients.find(i => i.id === wasteIngId)?.unit || 'units'})
                </label>
                <input
                  type="number"
                  value={wasteQty === 0 ? '' : wasteQty}
                  onChange={(e) => setWasteQty(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full bg-pos-bg p-3 rounded-xl text-base font-black text-red-400 border border-pos-border outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-pos-text-muted block mb-1">Reason for Loss</label>
                <CustomSelect
                  value={wasteReason}
                  onChange={(val) => setWasteReason(val as any)}
                  options={[
                    { value: 'EXPIRED', label: 'Expired / Shelf Life Ended' },
                    { value: 'BURNT', label: 'Burnt in Kitchen' },
                    { value: 'DROPPED', label: 'Dropped / Spilled accidentally' },
                    { value: 'SPOILAGE', label: 'Spoiled / Mold / Contaminated' },
                    { value: 'OTHER', label: 'Other Shrinkage / Unexplained' }
                  ]}
                />
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
