import React, { useState, useEffect } from 'react';
import { Printer, Check, X, AlertCircle, Loader2, Zap, ChevronDown } from 'lucide-react';
import { isTauri, listSerialPorts, kickCashDrawer, buildBillReceipt, printReceipt } from '../services/tauriCommands';

interface PrinterSettingsProps {
  restaurantName: string;
}

export const PrinterSettings: React.FC<PrinterSettingsProps> = ({ restaurantName }) => {
  const [ports, setPorts] = useState<string[]>([]);
  const [receiptPort, setReceiptPort] = useState(localStorage.getItem('karvaan_receipt_port') || '');
  const [drawerPort, setDrawerPort] = useState(localStorage.getItem('karvaan_drawer_port') || '');
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
    localStorage.setItem('karvaan_receipt_port', receiptPort);
    localStorage.setItem('karvaan_drawer_port', drawerPort);
    alert('Printer settings saved!');
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
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm text-amber-700 dark:text-amber-400">Printer Setup â€” Desktop Only</p>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-500 mt-1">
              Thermal printer and cash drawer control requires the Karvaan POS desktop app (.exe).
              In browser mode, receipts use the browser print dialog (Ctrl+P).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pos-card rounded-2xl border border-pos-border p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
            <Printer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
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
              <option value="">â€” Select Port â€”</option>
              {ports.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted pointer-events-none" />
          </div>
          <button onClick={testPrint}
            className="px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-black rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Test Print
          </button>
        </div>
        {testStatus === 'ok' && <p className="text-xs font-bold text-emerald-600">âœ“ {testMsg}</p>}
        {testStatus === 'fail' && <p className="text-xs font-bold text-rose-500">âœ— {testMsg}</p>}
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
              <option value="">â€” Same as Printer / Select Port â€”</option>
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

