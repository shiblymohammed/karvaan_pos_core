import React, { useState, useEffect } from 'react';
import { Printer, Check, AlertCircle, Loader2, Zap, ChevronDown, Bluetooth, Smartphone, ExternalLink, Store, Save } from 'lucide-react';
import { isTauri, listSerialPorts, kickCashDrawer, buildBillReceipt, printReceipt, printViaRawBT, isAndroid } from '../services/tauriCommands';
import { getPrinterProfile, savePrinterProfile } from '../services/printerProfile';
import { useSettingsStore } from '../store/useSettingsStore';
import { toast } from '../store/useToastStore';

interface PrinterSettingsProps {
  restaurantName: string;
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({ restaurantName }) => {
  const { receiptName = '', receiptAddress = '', receiptGstin = '' } = useSettingsStore();
  const [name, setName] = useState(receiptName || restaurantName || '');
  const [address, setAddress] = useState(receiptAddress || '');
  const [gstin, setGstin] = useState(receiptGstin || '');

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

  const [ports, setPorts] = useState<string[]>([]);
  const [receiptPort, setReceiptPort] = useState(getPrinterProfile().receiptPort || '');
  const [drawerPort, setDrawerPort] = useState(getPrinterProfile().drawerPort || '');
  const [useRawBT, setUseRawBT] = useState<boolean>(() => !!getPrinterProfile().useRawBT);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(() => getPrinterProfile().browserPaperWidth || 80);
  const [scanning, setScanning] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const isDesktop = isTauri();

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
        restaurantName,
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

  if (!isDesktop) {
    return (
      <div className="space-y-4">
        {/* Receipt Branding Card */}
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

          <div className="space-y-3">
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

        {/* RawBT Android Bluetooth Card */}
        <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                <Bluetooth className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-pos-text">Bluetooth & USB Printing (Android / PWA)</h3>
                  {isAndroid() && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Android Detected
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-pos-text-muted">Direct 1-click printing to Bluetooth thermal printers via RawBT</p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-pos-bg/80 border border-pos-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-pos-text">Use RawBT Instant Printing</p>
                <p className="text-[11px] font-bold text-pos-text-muted">Sends ESC/POS data directly to your paired Bluetooth printer with zero dialogs</p>
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

          {/* Quick Setup Instructions & Action */}
          <div className="text-xs space-y-2 text-pos-text-muted bg-blue-500/5 p-3.5 rounded-xl border border-blue-500/10">
            <p className="font-extrabold text-blue-700 flex items-center gap-1.5">
              <Smartphone className="h-4 w-4" /> Quick Tablet Setup:
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

        {/* Desktop Note */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-xs text-amber-700">Windows Spooler & COM Port Drivers</p>
              <p className="text-[11px] font-bold text-amber-600/90 mt-0.5">
                Direct physical COM/Serial ports require the Karvaan POS desktop application (.exe). In web browser mode on tablets, Bluetooth printing uses the RawBT driver above.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <Printer className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-pos-text">Printer & Cash Drawer</h3>
            <p className="text-xs font-bold text-pos-text-muted">Configure thermal printer and cash drawer serial ports</p>
          </div>
        </div>
        <button onClick={scanPorts} disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pos-sidebar border border-pos-border rounded-lg text-xs font-black text-pos-text-muted hover:text-pos-text cursor-pointer transition-colors">
          <Loader2 className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan Ports'}
        </button>
      </div>

      {/* Receipt Printer Port */}
      <div className="space-y-2">
        <label className="text-xs font-black text-pos-text-muted uppercase tracking-wider">
          Receipt Printer Port
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={receiptPort} onChange={e => setReceiptPort(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent cursor-pointer">
              <option value="">— Select Port —</option>
              {ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
          </div>
          <button onClick={testPrint}
            className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-black rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Test Print
          </button>
        </div>
        {testStatus === 'ok' && <p className="text-xs font-bold text-emerald-600">✓ {testMsg}</p>}
        {testStatus === 'fail' && <p className="text-xs font-bold text-rose-500">✗ {testMsg}</p>}
        <p className="text-xs font-bold text-pos-text-muted">Typically COM3 or COM4 for USB receipt printers</p>
      </div>

      {/* Cash Drawer Port */}
      <div className="space-y-2">
        <label className="text-xs font-black text-pos-text-muted uppercase tracking-wider">
          Cash Drawer Port
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={drawerPort} onChange={e => setDrawerPort(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent cursor-pointer">
              <option value="">— Same as Printer / Select Port —</option>
              {ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
          </div>
          <button onClick={testDrawer}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Test Kick
          </button>
        </div>
        <p className="text-xs font-bold text-pos-text-muted">Most drawers share the same COM port as the printer</p>
      </div>

      <button onClick={savePorts}
        className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm">
        <Check className="h-4 w-4" /> Save Printer Settings
      </button>
    </div>
  );
};

