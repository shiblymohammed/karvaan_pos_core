const numeric = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function purchaseDefaults(unit: string) {
  if (unit === 'g') return { purchaseUnit: 'kg', conversionFactor: 1000 };
  if (unit === 'ml') return { purchaseUnit: 'l', conversionFactor: 1000 };
  return { purchaseUnit: unit || 'pcs', conversionFactor: 1 };
}

export function normalizeInventoryItem(row: any, previous?: any) {
  const defaults = purchaseDefaults(row.unit);
  const conversion = row.conversionFactor ?? previous?.conversionFactor;
  const validConversion = typeof conversion === 'number' && Number.isFinite(conversion) && conversion > 0;
  return {
    ...row, currentStock: numeric(row.currentStock),
    reorderLevel: numeric(row.minThreshold ?? row.reorderLevel),
    costPerUnit: numeric(row.costPrice ?? row.costPerUnit), unit: row.unit || 'pcs',
    purchaseUnit: validConversion ? row.purchaseUnit || previous?.purchaseUnit || defaults.purchaseUnit : defaults.purchaseUnit,
    conversionFactor: validConversion ? conversion : defaults.conversionFactor,
    lastVendor: row.lastVendor ?? previous?.lastVendor ?? '',
    stockNeedsReview: Boolean(row.stockNeedsReview) || typeof row.currentStock !== 'number' || !Number.isFinite(row.currentStock),
  };
}

export function normalizeWasteLog(row: any) {
  return { ...row, ingredientId: row.ingredientId || '', ingredientName: row.itemName || row.ingredientName || 'Unknown item', costLoss: Number.isFinite(row.costLoss) && row.costLoss >= 0 ? row.costLoss : null, loggedBy: row.loggedBy || 'Recorded staff', timestamp: row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : row.timestamp || '' };
}
