import { isTauri, printReceipt, buildBillReceipt, buildKotReceipt, printViaRawBT } from './tauriCommands';
import { isCapacitor, getSavedBtPrinter, getSavedBtKotPrinter, printViaBluetoothNative } from './bluetoothPrinter';
import { apiClient } from './apiClient';
import { getPrinterProfile, canBackendPrintLocally } from './printerProfile';
import { printNetworkReceipt } from './tauriCommands';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';

export async function autoPrintCheckoutReceipt(bill: any, orderType: string = 'DINE_IN'): Promise<boolean> {
  try {
    const { receiptName = 'Karvaan POS', receiptAddress = '', receiptGstin = '' } = useSettingsStore.getState();
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

    const bytes = buildBillReceipt({
      restaurantName: receiptName,
      restaurantAddress: receiptAddress,
      gstin: receiptGstin,
      orderType,
      billNumber: bill.billNumber,
      tableName: bill.table || 'Takeaway',
      cashier: bill.cashier || currentUser?.name || 'Staff',
      items: lineItems.map((item: any) => ({
        name: item.name,
        qty: item.quantity,
        price: item.price,
        notes: item.notes,
        addons: item.addons,
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
    });

    // 1. Android Capacitor Native Bluetooth Thermal Printer
    if (isCapacitorApp && savedBtPrinter) {
      await printViaBluetoothNative(bytes, savedBtPrinter.address);
      toast.success(`Receipt printed via Bluetooth (${savedBtPrinter.name})`);
      return true;
    }

    // 2. Android RawBT Intent
    if (isRawBTMode) {
      printViaRawBT(bytes);
      toast.success('Receipt sent to Bluetooth thermal printer');
      return true;
    }

    // 3. Cloud/Server Print Queue
    try {
      const response = await apiClient.get('/printer/queue');
      if (response?.destinations?.some((dest: any) => dest.role === 'RECEIPT' && dest.autoPrint !== false)) {
        await apiClient.post('/printer/queue/receipt', {
          requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          billNumber: bill.billNumber,
          reprint: false,
          confirmed: false,
          reason: '',
        });
        toast.success('Receipt queued for counter printer');
        return true;
      }
    } catch {
      // Continue to local/network printer fallback
    }

    // 4. Local Network / ESC-POS printer (Tauri or LAN IP)
    if (isTauri() && network && network.ip) {
      await printNetworkReceipt(network.ip, Number(network.port || 9100), bytes);
      toast.success(`Receipt sent to network printer (${network.name})`);
      return true;
    }

    if (isTauri() && currentProfile.receiptPort) {
      await printReceipt(currentProfile.receiptPort, bytes);
      toast.success('Receipt printed via USB/Serial printer');
      return true;
    }

    if (network && network.ip && canBackendPrintLocally()) {
      const result = await apiClient.post('/printer/print', {
        ip: network.ip,
        port: Number(network.port || 9100),
        type: 'RECEIPT',
        restaurantName: receiptName,
        orderNumber: bill.orderNumber || bill.billNumber,
        items: lineItems,
        grandTotal: bill.grandTotal,
        data: Array.from(bytes),
      });
      if (result?.success) {
        toast.success('Receipt sent to printer');
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('Auto print failed or printer not configured:', error);
    return false;
  }
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
      items: (kotData.items || []).map((item: any) => ({
        name: item.name,
        qty: item.quantity,
        notes: item.notes,
        addons: item.addons,
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
