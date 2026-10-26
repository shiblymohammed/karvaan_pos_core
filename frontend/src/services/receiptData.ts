/** Invoice snapshots already include add-on prices. The preview accepts a base price. */
export function receiptItemsFromSnapshot(lines: any[]): any[] {
  return lines.map(line => {
    const addons = Array.isArray(line.addons) ? line.addons : [];
    return { ...line, name: line.name || line.product?.name || 'Item', addons, price: line.price - addons.reduce((sum, addon) => sum + Number(addon.price || 0), 0) };
  });
}
