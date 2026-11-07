import { useSettingsStore } from '../store/useSettingsStore';
import { printLayoutSample } from '../components/PrintLayoutPreview';

/** Fixed browser/driver layouts for item and bag labels; textContent keeps order text inert. */
export async function printPackagingLabels(kind: 'CUP' | 'BAG', bill: any, width: 58 | 80) {
  if (bill.pendingConfirmation) throw new Error('Wait for the order to be confirmed before printing packaging labels.');
  const brand = useSettingsStore.getState();
  const page = document.createElement('div');
  const groups = kind === 'CUP' ? bill.items.map((item: any) => [item]) : [bill.items];
  for (const items of groups) {
    const article = document.createElement('article');
    article.style.cssText = 'font:13px/1.5 ui-monospace,monospace;color:#000;padding:12px;break-after:page;overflow-wrap:anywhere';
    const add = (text: string, large = false) => { const line = document.createElement(large ? 'h2' : 'p'); line.textContent = text; line.style.cssText = `margin:5px 0;${large ? 'font-size:18px;font-weight:800;' : ''}`; article.appendChild(line); };
    if (brand.receiptLogo) { const logo = document.createElement('img'); logo.src = brand.receiptLogo; logo.alt = 'Restaurant logo'; logo.style.cssText = 'display:block;max-width:160px;max-height:80px;margin:0 auto 8px;object-fit:contain'; article.appendChild(logo); }
    add(brand.receiptName || 'Restaurant', true);
    add(kind === 'CUP' ? 'ITEM LABEL' : 'PACKING CHECKLIST');
    add(`Order: ${bill.orderNumber || bill.billNumber}`, true);
    if (bill.customerName || bill.customer?.name) add(`Customer: ${bill.customerName || bill.customer.name}`);
    if (kind === 'BAG' && (bill.customerPhone || bill.customer?.phone)) add(`Phone: ${bill.customerPhone || bill.customer.phone}`);
    if (bill.table) add(`Table / collection: ${bill.table}`);
    if (bill.date || bill.time) add(`${bill.date || ''} ${bill.time || ''}`.trim());
    add('--------------------------------');
    for (const item of items) {
      add(`${kind === 'BAG' ? '[ ] ' : ''}${item.quantity} x ${item.name}${item.variantName || item.variant ? ` (${item.variantName || item.variant})` : ''}`, true);
      for (const addon of item.addons || []) add(`+ ${addon.name}`);
      if (item.notes) add(`NOTE: ${item.notes}`, true);
    }
    if (kind === 'BAG') { add('--------------------------------'); add('[ ] Items checked    [ ] Cutlery'); add('Packed by: __________________'); }
    if (brand.receiptPhone) add(`Restaurant: ${brand.receiptPhone}`);
    page.appendChild(article);
  }
  if (!groups.length) throw new Error('This order has no items to label.');
  if (page.lastElementChild instanceof HTMLElement) page.lastElementChild.style.breakAfter = 'auto';
  await printLayoutSample(page, width, kind === 'CUP' ? 'Item labels' : 'Bag label');
}
