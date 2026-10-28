import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  Printer,
  UtensilsCrossed,
  Check,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Loader2,
  Store,
  Save,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  listPairedBluetoothPrinters,
  getSavedBtPrinter,
  setSavedBtPrinter,
  clearSavedBtPrinter,
  getSavedBtKotPrinter,
  setSavedBtKotPrinter,
  clearSavedBtKotPrinter,
  setBtKotPrinterEnabled,
  testBluetoothNativePrint,
  testBluetoothKotPrint,
  BluetoothDevice,
} from '../services/bluetoothPrinter';
import { useSettingsStore } from '../store/useSettingsStore';
import { toast } from '../store/useToastStore';
import { ReceiptLogoUploader } from './ReceiptLogoUploader';

interface CapacitorBluetoothPrinterSettingsProps {
  restaurantName: string;
}

export const CapacitorBluetoothPrinterSettings: React.FC<CapacitorBluetoothPrinterSettingsProps> = ({
  restaurantName,
}) => {
  const { receiptName = '', receiptAddress = '', receiptGstin = '', receiptLogo = '', receiptFooterNote = '' } = useSettingsStore();
  const [name, setName] = useState(receiptName || restaurantName || '');
  const [address, setAddress] = useState(receiptAddress || '');
  const [gstin, setGstin] = useState(receiptGstin || '');
  const [logo, setLogo] = useState<string | undefined>(receiptLogo);
  const [footerNote, setFooterNote] = useState(receiptFooterNote || 'Thank you! Visit again.');

  // Bluetooth Paired Devices
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [scanningBt, setScanningBt] = useState(false);

  // Main Printer State
  const [mainAddress, setMainAddress] = useState<string>('');
  const [mainPaperWidth, setMainPaperWidth] = useState<58 | 80>(58);
  const [savedMain, setSavedMain] = useState<{ address: string; name: string; paperWidth: 58 | 80 } | null>(null);
  const [testingMain, setTestingMain] = useState(false);

  // KOT Printer State
  const [kotEnabled, setKotEnabled] = useState(false);
  const [kotAddress, setKotAddress] = useState<string>('');
  const [kotPaperWidth, setKotPaperWidth] = useState<58 | 80>(58);
  const [savedKot, setSavedKot] = useState<{ address: string; name: string; enabled: boolean; paperWidth: 58 | 80 } | null>(null);
  const [testingKot, setTestingKot] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const main = getSavedBtPrinter();
    if (main) {
      setSavedMain(main);
      setMainAddress(main.address);
      setMainPaperWidth(main.paperWidth || 58);
    }

    const kot = getSavedBtKotPrinter();
    if (kot) {
      setSavedKot(kot);
      setKotEnabled(kot.enabled);
      setKotAddress(kot.address);
      setKotPaperWidth(kot.paperWidth || 58);
    }

    void loadDevices();
  }, []);

  const loadDevices = async () => {
    setScanningBt(true);
    try {
      const devices = await listPairedBluetoothPrinters();
      setBtDevices(devices);
      if (devices.length > 0) {
        if (!mainAddress) {
          const main = getSavedBtPrinter();
          setMainAddress(main?.address || devices[0].address);
        }
        if (!kotAddress) {
          const kot = getSavedBtKotPrinter();
          setKotAddress(kot?.address || devices[0].address);
        }
      }
    } catch (err: any) {
      console.warn('Could not list Bluetooth devices:', err);
    } finally {
      setScanningBt(false);
    }
  };

  // Main Printer Actions
  const handleSaveMainPrinter = () => {
    if (!mainAddress) {
      toast.error('Please select a paired Bluetooth device for Main Printer');
      return;
    }
    const match = btDevices.find((d) => d.address === mainAddress);
    const devName = match?.name || 'Bluetooth Thermal Printer';
    setSavedBtPrinter(mainAddress, devName, mainPaperWidth);
    setSavedMain({ address: mainAddress, name: devName, paperWidth: mainPaperWidth });
    toast.success(`Main Receipt Printer saved: ${devName} (${mainPaperWidth}mm)`);
  };

  const handleClearMainPrinter = () => {
    clearSavedBtPrinter();
    setSavedMain(null);
    setMainAddress('');
    toast.info('Main Bluetooth printer disconnected');
  };

  const handleTestMainPrint = async () => {
    const target = mainAddress || savedMain?.address;
    if (!target) {
      toast.error('Please select a printer to test');
      return;
    }
    setTestingMain(true);
    try {
      await testBluetoothNativePrint(target, name.trim() || restaurantName || 'Karvaan POS', mainPaperWidth);
      toast.success('Test receipt printed successfully via Bluetooth!');
    } catch (err: any) {
      toast.error('Bluetooth test failed: ' + (err.message || String(err)));
    } finally {
      setTestingMain(false);
    }
  };

  // KOT Printer Actions
  const handleToggleKotEnabled = (enabled: boolean) => {
    setKotEnabled(enabled);
    setBtKotPrinterEnabled(enabled);
    if (savedKot) {
      setSavedKot({ ...savedKot, enabled });
    }
    if (enabled) {
      toast.info('Separate KOT printer enabled. Select your kitchen Bluetooth printer.');
    } else {
      toast.info('Separate KOT printer disabled. Kitchen orders will print on Main printer.');
    }
  };

  const handleSaveKotPrinter = () => {
    if (!kotAddress) {
      toast.error('Please select a paired Bluetooth device for Kitchen KOT');
      return;
    }
    const match = btDevices.find((d) => d.address === kotAddress);
    const devName = match?.name || 'Kitchen Bluetooth Printer';
    setSavedBtKotPrinter(kotAddress, devName, true, kotPaperWidth);
    setSavedKot({ address: kotAddress, name: devName, enabled: true, paperWidth: kotPaperWidth });
    setKotEnabled(true);
    toast.success(`Kitchen (KOT) Printer saved: ${devName} (${kotPaperWidth}mm)`);
  };

  const handleClearKotPrinter = () => {
    clearSavedBtKotPrinter();
    setSavedKot(null);
    setKotAddress('');
    setKotEnabled(false);
    toast.info('Kitchen KOT printer disconnected');
  };

  const handleTestKotPrint = async () => {
    const target = kotAddress || savedKot?.address;
    if (!target) {
      toast.error('Please select a kitchen printer to test');
      return;
    }
    setTestingKot(true);
    try {
      await testBluetoothKotPrint(target, kotPaperWidth);
      toast.success('Test KOT printed successfully via Bluetooth!');
    } catch (err: any) {
      toast.error('Kitchen test print failed: ' + (err.message || String(err)));
    } finally {
      setTestingKot(false);
    }
  };

  // Header Branding Save
  const saveBranding = () => {
    useSettingsStore.setState({
      receiptName: name.trim(),
      receiptAddress: address.trim(),
      receiptGstin: gstin.trim(),
    });
    toast.success('Receipt header saved! Receipts will print with "' + (name.trim() || 'your restaurant name') + '"');
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Bluetooth className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Bluetooth Printers Setup</h1>
                <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/30 tracking-wider">
                  APK Native
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-emerald-100 mt-0.5">
                Wireless ESC/POS thermal printing directly from your Android tablet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDevices}
            disabled={scanningBt}
            className="self-start sm:self-auto px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-700 ${scanningBt ? 'animate-spin' : ''}`} />
            <span>{scanningBt ? 'Scanning...' : 'Refresh Paired Devices'}</span>
          </button>
        </div>
      </div>

      {/* ─── Device Notice if 0 devices paired ─── */}
      {btDevices.length === 0 && !scanningBt && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-900">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs font-bold space-y-1">
            <p className="font-black text-sm text-amber-800">No Paired Bluetooth Devices Found</p>
            <p className="text-amber-700">
              1. Turn on your Bluetooth thermal printer.<br />
              2. Open your tablet's <strong>Android Settings → Bluetooth</strong> and pair your printer (PIN is usually <code>0000</code> or <code>1234</code>).<br />
              3. Come back here and tap <strong>Refresh Paired Devices</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ─── 1. Main Receipt Printer (Bill / Invoice) ─── */}
      <div className="bg-white rounded-3xl border-2 border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">Main Receipt Printer</h2>
              <p className="text-xs font-bold text-slate-400">Customer invoices, pre-bills, and settled receipts</p>
            </div>
          </div>

          <div>
            {savedMain ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{savedMain.name}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">({savedMain.paperWidth || 58}mm)</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearMainPrinter}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Not configured
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Paired Device Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Select Paired Device
            </label>
            <div className="relative">
              <select
                value={mainAddress}
                onChange={(e) => setMainAddress(e.target.value)}
                className="w-full appearance-none pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
              >
                <option value="">— Select Paired Printer —</option>
                {btDevices.map((d) => (
                  <option key={d.address} value={d.address}>
                    {d.name} ({d.address})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Paper Width */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Thermal Paper Width
            </label>
            <div className="flex gap-2 h-[46px] items-center">
              <button
                type="button"
                onClick={() => setMainPaperWidth(58)}
                className={`flex-1 h-full rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mainPaperWidth === 58
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                58mm (2-inch roll)
              </button>
              <button
                type="button"
                onClick={() => setMainPaperWidth(80)}
                className={`flex-1 h-full rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mainPaperWidth === 80
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                80mm (3-inch roll)
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSaveMainPrinter}
            disabled={!mainAddress}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Save as Main Printer
          </button>
          <button
            type="button"
            onClick={handleTestMainPrint}
            disabled={!mainAddress || testingMain}
            className="px-5 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {testingMain ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : <Printer className="h-4 w-4 text-emerald-600" />}
            <span>{testingMain ? 'Printing Test...' : 'Test Bill Print'}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Kitchen Order Ticket (KOT) Printer ─── */}
      <div className="bg-white rounded-3xl border-2 border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">Kitchen (KOT) Printer</h2>
              <p className="text-xs font-bold text-slate-400">Prints kitchen order tickets when firing or sending items</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-600">Use Separate KOT Printer</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={kotEnabled}
                onChange={(e) => handleToggleKotEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {!kotEnabled ? (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-500 flex items-center gap-2.5">
            <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              Separate KOT printer is currently disabled. Kitchen orders will automatically print on your <strong>Main Receipt Printer</strong>, or can be managed digitally on the Kitchen Display System (KDS).
            </span>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Kitchen Printer Status</p>
              {savedKot?.address ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                    <Check className="h-3.5 w-3.5 text-amber-600" />
                    <span>{savedKot.name}</span>
                    <span className="text-[10px] text-amber-600 font-bold">({savedKot.paperWidth || 58}mm)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearKotPrinter}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  No KOT printer configured
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Paired Device Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  Select Kitchen Bluetooth Device
                </label>
                <div className="relative">
                  <select
                    value={kotAddress}
                    onChange={(e) => setKotAddress(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm"
                  >
                    <option value="">— Select Kitchen Printer —</option>
                    {btDevices.map((d) => (
                      <option key={d.address} value={d.address}>
                        {d.name} ({d.address})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Paper Width */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  Thermal Paper Width
                </label>
                <div className="flex gap-2 h-[46px] items-center">
                  <button
                    type="button"
                    onClick={() => setKotPaperWidth(58)}
                    className={`flex-1 h-full rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      kotPaperWidth === 58
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    58mm (2-inch roll)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKotPaperWidth(80)}
                    className={`flex-1 h-full rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      kotPaperWidth === 80
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    80mm (3-inch roll)
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveKotPrinter}
                disabled={!kotAddress}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Save KOT Printer
              </button>
              <button
                type="button"
                onClick={handleTestKotPrint}
                disabled={!kotAddress || testingKot}
                className="px-5 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {testingKot ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : <Printer className="h-4 w-4 text-amber-600" />}
                <span>{testingKot ? 'Printing KOT...' : 'Test KOT Print'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. Receipt Branding (Header Info) ─── */}
      <div className="bg-white rounded-3xl border-2 border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">Receipt Header & Business Info</h2>
            <p className="text-xs font-bold text-slate-400">Appears at the top of printed thermal receipts</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Logo Uploader */}
          <ReceiptLogoUploader logo={logo} onChange={(newLogo) => setLogo(newLogo || undefined)} />
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
              Restaurant / Business Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Karvaan Restaurant & Cafe"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                Address / Tagline
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Ground Floor, City Center"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                Tax ID / Phone Number
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. GSTIN: 32AAAAA0000A1Z5 | Ph: 9876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
              Receipt Footer Note / Tagline
            </label>
            <input
              type="text"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="e.g. Thank you for dining with us! Follow us @karvaan"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveBranding}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" /> Save Receipt Header
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

