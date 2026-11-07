import type { Category, Product } from '../store/useMenuStore';
import type { Ingredient, Recipe } from '../store/useInventoryStore';

export function filterMenuProducts(products: Product[], category: string, query = '') {
  const search = query.trim().toLowerCase();
  return products.filter(product => {
    if (!product.isAvailable || product.isArchived) return false;
    const matchesCategory = category === 'All'
      || (category === 'Favourites' ? product.isFavourite : (product.category || 'Uncategorised') === category);
    return matchesCategory && product.name.toLowerCase().includes(search);
  });
}

export function menuCategoryTiles(categories: Category[], products: Product[]): (Category & { itemCount: number })[] {
  const visible = filterMenuProducts(products, 'All');
  const counts = new Map<string, number>();
  let favourites = 0;
  for (const product of visible) {
    const name = product.category || 'Uncategorised';
    counts.set(name, (counts.get(name) || 0) + 1);
    if (product.isFavourite) favourites++;
  }
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const names = new Set(sorted.map(category => category.name));
  for (const product of visible) {
    const name = product.category || 'Uncategorised';
    if (!names.has(name)) {
      sorted.push({ id: `menu-category:${name}`, name, sortOrder: sorted.length });
      names.add(name);
    }
  }
  return [
    { id: 'favourites', name: 'Favourites', sortOrder: -1, iconName: 'Star' },
    ...sorted,
  ].map(category => ({ ...category, itemCount: category.name === 'All' ? visible.length
    : category.name === 'Favourites' ? favourites : counts.get(category.name) || 0 }));
}

// Build once when recipes/stock change, then resolve each card in constant time.
// Keep the first matching recipe, including legacy name and ID matching semantics.
export function createMenuStockLookup(recipes: Recipe[], ingredients: Ingredient[]) {
  const stock = new Map<string, Ingredient>();
  for (const ingredient of ingredients) {
    if (!stock.has(ingredient.id)) stock.set(ingredient.id, ingredient);
  }
  type Result = { index: number; short: boolean };
  const names = new Map<string, Result>();
  const ids = new Map<string, Result>();
  recipes.forEach((recipe, index) => {
    const result = { index, short: recipe.ingredients.some(item => {
      const ingredient = stock.get(item.ingredientId);
      return !ingredient || ingredient.currentStock < item.quantity * (1 + (item.wasteFactorPercent || 0) / 100);
    }) };
    const name = recipe.menuItemName.toLowerCase();
    if (!names.has(name)) names.set(name, result);
    if (!ids.has(recipe.menuItemId)) ids.set(recipe.menuItemId, result);
  });
  return (name: string) => {
    const byName = names.get(name.toLowerCase());
    const byId = ids.get(name);
    return (byName && byId ? (byName.index < byId.index ? byName : byId) : byName || byId)?.short ?? false;
  };
}
