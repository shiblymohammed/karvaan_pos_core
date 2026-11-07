import { receiptLogoBytes } from './receiptLogo';
import { isTauri, printReceipt, buildBillReceipt, buildKotReceipt, printViaRawBT } from './tauriCommands';
import { isCapacitor, getSavedBtPrinter, getSavedBtKotPrinter, printViaBluetoothNative } from './bluetoothPrinter';
import { apiClient } from './apiClient';
import { getPrinterProfile, canBackendPrintLocally } from './printerProfile';
import { printNetworkReceipt } from './tauriCommands';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';
import { printDirectReceiptOnce } from './directPrintGuard';

export async function autoPrintCheckoutReceipt(bill: any, orderType: string = 'DINE_IN'): Promise<boolean> {
  try {
    // Never issue a second original on a terminal when the transaction already queued it.
    if (bill.pendingConfirmation) return false;
    if (bill.checkoutPrint?.receiptJobId) { toast.info('Receipt queued for the restaurant printer.'); return true; }
    // Resolve server ownership before decoding a local logo or opening a direct connection.
    const overview = bill.checkoutPrint ? null : await apiClient.get('/printer/queue');
    if (overview?.destinations?.some((dest: any) => dest.role === 'RECEIPT' && dest.autoPrint !== false)) {
      await apiClient.post('/printer/queue/receipt', { requestId: `auto:${bill.billNumber}`, billNumber: bill.billNumber, reprint: false });
      toast.info('Receipt queued for the restaurant printer.'); return true;
    }
    const {
      receiptName = 'Karvaan POS',
      receiptLogo = '',
      receiptAddress = '',
      receiptPhone = '',
      receiptGstin = '',
      receiptFooterNote = 'Thank you for visiting! Please visit us again.',
    } = useSettingsStore.getState();

    const currentUser = useAuthStore.getState().currentUser;
    const currentProfile = getPrinterProfile();
    const isCapacitorApp = isCapacitor();
    const savedBtPrinter = getSavedBtPrinter();
    const isRawBTMode = !isTauri() && currentProfile.useRawBT;

    const network = currentProfile.printers.find((printer) => printer.id === currentProfile.receiptPrinterId);
    const lineItems = (bill.items || []).map((item: any) => ({
      ...item,
      price: item.price + (item.addons?.reduce((sum: number, addon: any) => sum + addon.price, 0) || 0),
    }));
    const paperWidth = Number(
      isCapacitorApp && savedBtPrinter
        ? savedBtPrinter.paperWidth || 58
        : network?.paperSize === '58mm'
        ? 58
        : currentProfile.browserPaperWidth || 80
    );

    const receipt = buildBillReceipt({
      logoBytes: await receiptLogoBytes(receiptLogo),
      restaurantName: receiptName,
      restaurantAddress: receiptAddress,
      restaurantPhone: receiptPhone,
      gstin: receiptGstin,
      orderType,
      billNumber: bill.billNumber,
      tableName: bill.table || 'Takeaway',
      cashier: bill.cashier || currentUser?.name || 'Staff',
      customerName: bill.customerName || bill.customer?.name,
      customerPhone: bill.customerPhone || bill.customer?.phone,
      items: lineItems.map((item: any) => ({
        name: item.name,
        qty: item.quantity,
        price: item.price,
        notes: item.notes,
        addons: item.addons,
        variant: item.variantName || item.variant,
      })),
      subtotal: bill.subtotal,
      discount: bill.discount || 0,
      gst: (bill.cgst || 0) + (bill.sgst || 0),
      grandTotal: bill.grandTotal,
      paymentMethod: bill.method || 'CASH',
      tenders: bill.tenders,
      deliveryFee: bill.deliveryFee,
      pendingConfirmation: bill.pendingConfirmation,
      paymentPending: bill.paymentPending,
      prebill: false,
      reprint: false,
      time: `${bill.date || new Date().toLocaleDateString()} ${bill.time || new Date().toLocaleTimeString()}`,
      paperWidth,
      footerNote: receiptFooterNote,
    });
    const kitchen = checkoutKitchenBytes(bill, paperWidth);
    const bytes = new Uint8Array(receipt.length + kitchen.length);
    bytes.set(receipt); bytes.set(kitchen, receipt.length);

    // 1. Android Capacitor Native Bluetooth Thermal Printer
    if (isCapacitorApp && savedBtPrinter) {
      await printDirectReceiptOnce(bill.billNumber, () => printViaBluetoothNative(bytes, savedBtPrinter.address));
      toast.success(`Receipt printed via Bluetooth (${savedBtPrinter.name})`);
      return true;
    }

    // 2. Android RawBT Intent
    if (isRawBTMode) {
      await printDirectReceiptOnce(bill.billNumber, async () => { if (!printViaRawBT(bytes)) throw new Error('RawBT could not be opened.'); });
      toast.success('Receipt sent to Bluetooth thermal printer');
      return true;
    }

    // 4. Local Network / ESC-POS printer (Tauri or LAN IP)
    if (isTauri() && network && network.ip) {
      await printDirectReceiptOnce(bill.billNumber, () => printNetworkReceipt(network.ip, Number(network.port || 9100), bytes));
      toast.success(`Receipt sent to network printer (${network.name})`);
      return true;
    }

    if (isTauri() && currentProfile.receiptPort) {
      await printDirectReceiptOnce(bill.billNumber, () => printReceipt(currentProfile.receiptPort!, bytes));
      toast.success('Receipt printed via USB/Serial printer');
      return true;
    }

    if (network && network.ip && canBackendPrintLocally()) {
      await printDirectReceiptOnce(bill.billNumber, async () => { const result = await apiClient.post('/printer/print', {
        ip: network.ip,
        port: Number(network.port || 9100),
        type: 'RECEIPT',
        restaurantName: receiptName,
        orderNumber: bill.orderNumber || bill.billNumber,
        items: lineItems,
        grandTotal: bill.grandTotal,
        data: Array.from(bytes),
      }); if (!result?.success) throw new Error('Printer did not confirm the connection. Check the paper before reprinting.'); });
      toast.success('Receipt sent to printer');
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Auto print failed or printer not configured:', error);
    toast.warning(error instanceof Error ? error.message : 'Printing needs review. The saved sale is unchanged.');
    return false;
  }
}

export function checkoutKitchenBytes(bill: any, paperWidth: number): Uint8Array {
  const copy = !bill.pendingConfirmation && !bill.paymentPending && bill.checkoutPrint?.receiptAndKot ? bill.checkoutPrint.kitchenCopy : null;
  if (!copy?.items?.length) return new Uint8Array();
  return buildKotReceipt({ orderNumber: copy.orderNumber || copy.reference || bill.orderNumber,
    tableName: copy.table || bill.table || 'Takeaway', orderType: copy.orderType, waiter: copy.cashier,
    time: copy.createdAt ? new Date(copy.createdAt).toLocaleString() : bill.time || new Date().toLocaleTimeString(),
    items: copy.items.map((item: any) => ({ name: item.name, qty: item.quantity, notes: item.notes, addons: item.addons, variant: item.variant })), paperWidth });
}

/**
 * Print KOT (Kitchen Order Ticket) directly via configured Bluetooth printer on Capacitor APK
 */
export async function autoPrintKotReceipt(kotData: any): Promise<boolean> {
  try {
    const isCapacitorApp = isCapacitor();
    if (!isCapacitorApp) return false;

    const kotPrinter = getSavedBtKotPrinter();
    const mainPrinter = getSavedBtPrinter();

    // Use dedicated KOT printer if enabled, otherwise fallback to main Bluetooth printer
    const target = (kotPrinter?.enabled && kotPrinter?.address) ? kotPrinter : mainPrinter;
    if (!target?.address) return false;

    const paperWidth = target.paperWidth || 58;
    const bytes = buildKotReceipt({
      orderNumber: kotData.orderNumber || 'KOT',
      tableName: kotData.table || 'Takeaway',
      orderType: kotData.orderType,
      waiter: kotData.waiter,
      items: (kotData.items || []).map((item: any) => ({
        name: item.name,
        qty: item.quantity,
        notes: item.notes,
        addons: item.addons,
        variant: item.variantName || item.variant,
      })),
      time: `${kotData.date || new Date().toLocaleDateString()} ${kotData.time || new Date().toLocaleTimeString()}`,
      paperWidth,
    });

    await printViaBluetoothNative(bytes, target.address);
    toast.success(`Kitchen Ticket printed via Bluetooth (${target.name})`);
    return true;
  } catch (error: any) {
    console.warn('Auto KOT print failed:', error);
    toast.error('Bluetooth KOT print failed: ' + (error?.message || String(error)));
    return false;
  }
}
