import React, { useState, useEffect } from 'react';
import {
  Printer,
  Check,
  AlertCircle,
  Loader2,
  Zap,
  ChevronDown,
  Bluetooth,
  Smartphone,
  ExternalLink,
  Store,
  Save,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { isTauri, listSerialPorts, kickCashDrawer, buildBillReceipt, printReceipt, printViaRawBT, isAndroid } from '../services/tauriCommands';
import { getPrinterProfile, savePrinterProfile } from '../services/printerProfile';
import {
  isCapacitor,
  listPairedBluetoothPrinters,
  getSavedBtPrinter,
  setSavedBtPrinter,
  clearSavedBtPrinter,
  testBluetoothNativePrint,
  BluetoothDevice,
} from '../services/bluetoothPrinter';
import { useSettingsStore } from '../store/useSettingsStore';
import { toast } from '../store/useToastStore';
import { ReceiptLogoUploader } from './ReceiptLogoUploader';

interface PrinterSettingsProps {
  restaurantName: string;
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({ restaurantName }) => {
  const { receiptName = '', receiptAddress = '', receiptGstin = '', receiptLogo = '', receiptFooterNote = '' } = useSettingsStore();
  const [name, setName] = useState(receiptName || restaurantName || '');
  const [address, setAddress] = useState(receiptAddress || '');
  const [gstin, setGstin] = useState(receiptGstin || '');
  const [logo, setLogo] = useState<string | undefined>(receiptLogo);
  const [footerNote, setFooterNote] = useState(receiptFooterNote || 'Thank you! Visit again.');

  useEffect(() => {
    if (receiptName) setName(receiptName);
    if (receiptAddress) setAddress(receiptAddress);
    if (receiptGstin) setGstin(receiptGstin);
  }, [receiptName, receiptAddress, receiptGstin]);

  const saveBranding = () => {
    useSettingsStore.setState({
      receiptName: name.trim(),
      receiptAddress: address.trim(),
      receiptGstin: gstin.trim(),
    });
    toast.success('Receipt header saved! Receipts will now print with "' + (name.trim() || 'your restaurant name') + '"');
  };

  const isDesktop = isTauri();
  const isCap = isCapacitor();

  // Desktop COM Ports state
  const [ports, setPorts] = useState<string[]>([]);
  const [receiptPort, setReceiptPort] = useState(getPrinterProfile().receiptPort || '');
  const [drawerPort, setDrawerPort] = useState(getPrinterProfile().drawerPort || '');
  const [scanning, setScanning] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Paper roll width & RawBT state (Web/Browser fallback)
  const [paperWidth, setPaperWidth] = useState<58 | 80>(() => getPrinterProfile().browserPaperWidth || 80);
  const [useRawBT, setUseRawBT] = useState<boolean>(() => !!getPrinterProfile().useRawBT);

  // Native Bluetooth state (Capacitor APK)
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [selectedBtAddress, setSelectedBtAddress] = useState<string>('');
  const [savedBt, setSavedBt] = useState<{ address: string; name: string } | null>(null);
  const [scanningBt, setScanningBt] = useState(false);
  const [testingBt, setTestingBt] = useState(false);

  // Initialize Native Bluetooth for Capacitor
  useEffect(() => {
    if (isCap) {
      const saved = getSavedBtPrinter();
      setSavedBt(saved);
      if (saved?.address) {
        setSelectedBtAddress(saved.address);
      }
      loadBluetoothDevices();
    }
  }, [isCap]);

  const loadBluetoothDevices = async () => {
    if (!isCap) return;
    setScanningBt(true);
    try {
      const devices = await listPairedBluetoothPrinters();
      setBtDevices(devices);
      if (devices.length > 0 && !selectedBtAddress) {
        const saved = getSavedBtPrinter();
        const initial = saved?.address || devices[0].address;
        setSelectedBtAddress(initial);
      }
    } catch (err: any) {
      console.warn('Could not scan Bluetooth printers:', err);
    } finally {
      setScanningBt(false);
    }
  };

  const handleSaveBluetoothPrinter = () => {
    if (!selectedBtAddress) {
      toast.error('Please select a paired Bluetooth printer');
      return;
    }
    const match = btDevices.find(d => d.address === selectedBtAddress);
    const devName = match?.name || 'Bluetooth Thermal Printer';
    setSavedBtPrinter(selectedBtAddress, devName);
    setSavedBt({ address: selectedBtAddress, name: devName });
    toast.success(`Bluetooth printer saved: ${devName}! All receipts will now print directly.`);
  };

  const handleClearBluetoothPrinter = () => {
    clearSavedBtPrinter();
    setSavedBt(null);
    setSelectedBtAddress('');
    toast.info('Bluetooth printer disconnected');
  };

  const handleTestBluetoothPrint = async () => {
    if (!selectedBtAddress) {
      toast.error('Please select a Bluetooth printer first');
      return;
    }
    setTestingBt(true);
    try {
      await testBluetoothNativePrint(selectedBtAddress, name.trim() || restaurantName || 'Karvaan POS', paperWidth);
      toast.success('Test receipt printed successfully via Bluetooth!');
    } catch (err: any) {
      toast.error('Bluetooth test failed: ' + (err.message || String(err)));
    } finally {
      setTestingBt(false);
    }
  };

  const scanPorts = async () => {
    setScanning(true);
    const found = await listSerialPorts();
    setPorts(found);
    setScanning(false);
  };

  useEffect(() => {
    if (isDesktop) scanPorts();
  }, [isDesktop]);

  const savePorts = () => {
    savePrinterProfile({ ...getPrinterProfile(), receiptPort, drawerPort, useRawBT, browserPaperWidth: paperWidth });
    toast.success('Printer settings saved!');
  };

  const handleRawBTToggle = (enabled: boolean) => {
    setUseRawBT(enabled);
    savePrinterProfile({ ...getPrinterProfile(), useRawBT: enabled, browserPaperWidth: paperWidth });
    toast.info(enabled ? 'RawBT Bluetooth printing enabled' : 'RawBT printing disabled; using browser print dialog');
  };

  const handlePaperWidthChange = (width: 58 | 80) => {
    setPaperWidth(width);
    savePrinterProfile({ ...getPrinterProfile(), browserPaperWidth: width, useRawBT });
    toast.info(`Receipt width set to ${width}mm`);
  };

  const testRawBTPrint = () => {
    try {
      const bytes = buildBillReceipt({
        restaurantName: name.trim() || restaurantName || 'Karvaan POS',
        restaurantAddress: address.trim(),
        gstin: gstin.trim(),
        billNumber: 'TEST-BT01',
        orderType: 'RAWBT TEST',
        tableName: 'Test Table',
        items: [
          { name: 'Bluetooth Test Item', qty: 1, price: 100 },
          { name: 'Thermal Roll Check', qty: 2, price: 50 },
        ],
        subtotal: 200,
        discount: 0,
        gst: 10,
        grandTotal: 210,
        paymentMethod: 'CASH',
        cashier: 'Admin',
        time: new Date().toLocaleTimeString(),
        paperWidth,
      });
      printViaRawBT(bytes);
      toast.success('Test receipt sent to RawBT!');
    } catch (err: any) {
      toast.error('Failed to trigger RawBT: ' + (err.message || String(err)));
    }
  };

  const testPrint = async () => {
    if (!receiptPort) { alert('Select a receipt printer port first'); return; }
    setTestStatus('idle');
    try {
      const bytes = buildBillReceipt({
        restaurantName: name.trim() || restaurantName || 'Karvaan POS',
        billNumber: 'TEST-001',
        orderType: 'TEST PRINT',
        items: [
          { name: 'Test Item 1', qty: 1, price: 100 },
          { name: 'Test Item 2', qty: 2, price: 50 },
        ],
        subtotal: 200,
        discount: 0,
        gst: 10,
        grandTotal: 210,
        paymentMethod: 'CASH',
        cashier: 'Admin',
        time: new Date().toLocaleTimeString(),
      });
      const result = await printReceipt(receiptPort, bytes);
      setTestStatus('ok');
      setTestMsg(result);
    } catch (e: any) {
      setTestStatus('fail');
      setTestMsg(e.message || String(e));
    }
  };

  const testDrawer = async () => {
    if (!drawerPort) { alert('Select a cash drawer port first'); return; }
    try {
      await kickCashDrawer(drawerPort);
      alert('Cash drawer triggered successfully!');
    } catch (e: any) {
      alert(`Cash drawer error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Receipt Branding Card (Universal for all platforms) */}
      <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-pos-text">Receipt Header & Business Info</h3>
            <p className="text-xs font-bold text-pos-text-muted">Printed at the very top of thermal customer receipts</p>
          </div>
        </div>

        <div className="space-y-4">
          <ReceiptLogoUploader logo={logo} onChange={(newLogo) => setLogo(newLogo || undefined)} />
          <div>
            <label className="block text-xs font-black text-pos-text-muted uppercase mb-1">
              Restaurant / Business Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Restaurant & Cafe"
              className="w-full bg-pos-bg border border-pos-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-accent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-pos-text-muted uppercase mb-1">
                Address / Tagline
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. 123 Main Street, City"
                className="w-full bg-pos-bg border border-pos-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-pos-text-muted uppercase mb-1">
                GSTIN / Phone / Tax ID
              </label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value)}
                placeholder="e.g. GSTIN: 32AAAAA0000A1Z5 | Ph: 9876543210"
                className="w-full bg-pos-bg border border-pos-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-accent"
              />
            </div>
          </div>

          <div>
              <label className="block text-xs font-black text-pos-text-muted uppercase mb-1">
                Receipt Footer Note / Tagline
              </label>
              <input
                type="text"
                value={footerNote}
                onChange={e => setFooterNote(e.target.value)}
                placeholder="e.g. Thank you for dining with us! Follow us @karvaan"
                className="w-full bg-pos-bg border border-pos-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-pos-text focus:outline-none focus:ring-2 focus:ring-pos-accent"
              />
            </div>

            <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveBranding}
              className="px-4 py-2 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" /> Save Receipt Header
            </button>
          </div>
        </div>
      </div>

      {/* 2. CAPACITOR APK ONLY: Native Bluetooth Thermal Printer Setup */}
      {isCap && (
        <div className="bg-pos-card rounded-2xl border-2 border-emerald-500/30 p-5 space-y-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider flex items-center gap-1 shadow-sm">
            <Sparkles className="h-3 w-3" /> Capacitor APK Native
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <Bluetooth className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-pos-text">Native Bluetooth Thermal Printer</h3>
              <p className="text-xs font-bold text-pos-text-muted">
                Direct in-app ESC/POS printing with zero external apps and no popups
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-pos-bg border border-pos-border space-y-4">
            {/* Status indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-pos-border">
              <div>
                <p className="text-xs font-black text-pos-text">Configured Printer</p>
                <p className="text-[11px] font-bold text-pos-text-muted">
                  {savedBt ? (
                    <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 inline" /> {savedBt.name} ({savedBt.address})
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold">No Bluetooth printer selected</span>
                  )}
                </p>
              </div>
              {savedBt && (
                <button
                  type="button"
                  onClick={handleClearBluetoothPrinter}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* Paired Device Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-pos-text-muted uppercase tracking-wider">
                  Select Paired Bluetooth Device
                </label>
                <button
                  type="button"
                  onClick={loadBluetoothDevices}
                  disabled={scanningBt}
                  className="flex items-center gap-1.5 text-xs font-black text-pos-accent hover:text-emerald-600 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${scanningBt ? 'animate-spin' : ''}`} />
                  {scanningBt ? 'Scanning...' : 'Refresh Devices'}
                </button>
              </div>

              <div className="relative">
                <select
                  value={selectedBtAddress}
                  onChange={e => setSelectedBtAddress(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-10 py-2.5 bg-pos-card border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pos-accent cursor-pointer"
                >
                  <option value="">— Select a paired printer —</option>
                  {btDevices.map(d => (
                    <option key={d.address} value={d.address}>
                      {d.name} ({d.address})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
              </div>

              {btDevices.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-700">
                  No paired Bluetooth devices detected. Make sure your printer is powered on and paired inside your tablet's <strong>Android Settings → Bluetooth</strong>, then tap <strong>Refresh Devices</strong> above.
                </div>
              )}
            </div>

            {/* Roll paper width selection */}
            <div className="flex items-center justify-between pt-2 border-t border-pos-border">
              <div>
                <p className="text-xs font-black text-pos-text">Thermal Paper Roll Width</p>
                <p className="text-[11px] font-bold text-pos-text-muted">Standard mobile printers use 58mm (2-inch)</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(58)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${paperWidth === 58 ? 'bg-pos-accent text-white shadow-sm' : 'bg-pos-card border border-pos-border text-pos-text-muted hover:text-pos-text cursor-pointer'}`}
                >
                  58mm (2-inch)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(80)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${paperWidth === 80 ? 'bg-pos-accent text-white shadow-sm' : 'bg-pos-card border border-pos-border text-pos-text-muted hover:text-pos-text cursor-pointer'}`}
                >
                  80mm (3-inch)
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleSaveBluetoothPrinter}
                disabled={!selectedBtAddress}
                className="px-4 py-2.5 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Save as POS Printer
              </button>
              <button
                type="button"
                onClick={handleTestBluetoothPrint}
                disabled={!selectedBtAddress || testingBt}
                className="px-4 py-2.5 bg-pos-card border border-pos-border hover:bg-pos-bg text-pos-text font-black text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testingBt ? <Loader2 className="h-4 w-4 animate-spin text-pos-accent" /> : <Printer className="h-4 w-4 text-pos-accent" />}
                {testingBt ? 'Printing…' : 'Test Direct Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. WEB BROWSER / PWA (NON-CAPACITOR, NON-DESKTOP) Fallback */}
      {!isCap && !isDesktop && (
        <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                <Bluetooth className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-pos-text">Bluetooth & USB Printing (Web Browser / PWA)</h3>
                  {isAndroid() && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Android Detected
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-pos-text-muted">
                  Web browsers require the RawBT print service. In the Karvaan APK, printing is 100% native.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-pos-bg/80 border border-pos-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-pos-text">Use RawBT Printing Service</p>
                <p className="text-[11px] font-bold text-pos-text-muted">Sends ESC/POS data directly to your paired printer</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRawBT}
                  onChange={e => handleRawBTToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-pos-border">
              <p className="text-xs font-black text-pos-text">Paper Roll Width</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(58)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${paperWidth === 58 ? 'bg-pos-accent text-white shadow-sm' : 'bg-pos-card border border-pos-border text-pos-text-muted hover:text-pos-text'}`}
                >
                  58mm (2-inch)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(80)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${paperWidth === 80 ? 'bg-pos-accent text-white shadow-sm' : 'bg-pos-card border border-pos-border text-pos-text-muted hover:text-pos-text'}`}
                >
                  80mm (3-inch)
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs space-y-2 text-pos-text-muted bg-blue-500/5 p-3.5 rounded-xl border border-blue-500/10">
            <p className="font-extrabold text-blue-700 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4" /> Tablet Browser Setup:
            </p>
            <ol className="list-decimal list-inside space-y-1 font-semibold text-[11px] text-slate-600 pl-1">
              <li>Turn on your Bluetooth printer and pair it in Android Bluetooth settings.</li>
              <li>Install <strong>RawBT Print Service</strong> from Google Play Store.</li>
              <li>Open RawBT &gt; Settings &gt; Connection: <strong>Bluetooth</strong> &gt; Select your printer.</li>
            </ol>
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={testRawBTPrint}
                className="px-3.5 py-2 bg-gradient-to-r from-pos-accent to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Test Print via RawBT
              </button>
              <a
                href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-pos-card border border-pos-border hover:bg-pos-bg text-pos-text font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Get RawBT on Play Store
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAURI DESKTOP ONLY: Physical Serial COM Ports & Cash Drawer */}
      {isDesktop && (
        <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Printer className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-pos-text">Physical Printer & Cash Drawer</h3>
                <p className="text-xs font-bold text-pos-text-muted">Configure desktop USB COM / Serial ports</p>
              </div>
            </div>
            <button
              onClick={scanPorts}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-pos-sidebar border border-pos-border rounded-lg text-xs font-black text-pos-text-muted hover:text-pos-text cursor-pointer transition-colors"
            >
              <Loader2 className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Ports'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-pos-text-muted uppercase tracking-wider">
              Receipt Printer Port
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={receiptPort}
                  onChange={e => setReceiptPort(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent cursor-pointer"
                >
                  <option value="">— Select Port —</option>
                  {ports.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
              </div>
              <button
                onClick={testPrint}
                className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-black rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Test Print
              </button>
            </div>
            {testStatus === 'ok' && <p className="text-xs font-bold text-emerald-600">✓ {testMsg}</p>}
            {testStatus === 'fail' && <p className="text-xs font-bold text-rose-500">✗ {testMsg}</p>}
            <p className="text-xs font-bold text-pos-text-muted">Typically COM3 or COM4 for USB receipt printers</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-pos-text-muted uppercase tracking-wider">
              Cash Drawer Port
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={drawerPort}
                  onChange={e => setDrawerPort(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent cursor-pointer"
                >
                  <option value="">— Same as Printer / Select Port —</option>
                  {ports.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
              </div>
              <button
                onClick={testDrawer}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" /> Test Kick
              </button>
            </div>
            <p className="text-xs font-bold text-pos-text-muted">Most drawers share the same COM port as the printer</p>
          </div>

          <button
            onClick={savePorts}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <Check className="h-4 w-4" /> Save Printer Settings
          </button>
        </div>
      )}
    </div>
  );
};
