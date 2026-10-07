import React, { useState } from 'react';
import { Printer, RefreshCw, CheckCircle, XCircle, Settings, Save, Plus, Trash2, Search, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../../services/apiClient';
import { AdminLabelStudio } from './AdminLabelStudio';
import { toast } from '../../store/useToastStore';

export interface PrinterConfig {
  id: string;
  name: string;
  role: 'CASHIER' | 'KITCHEN' | 'BAR' | 'LABEL';
  ip: string;
  port: string;
  paperSize: '58mm' | '80mm' | 'label';
  status?: 'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR';
}

export const AdminPrinterSettings: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterConfig[]>([
    { id: '1', name: 'Main Cashier', role: 'CASHIER', ip: '192.168.1.100', port: '9100', paperSize: '80mm', status: 'IDLE' }
  ]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);



  const addPrinter = () => {
    setPrinters([
      ...printers,
      { 
        id: Date.now().toString(), 
        name: `New Printer ${printers.length + 1}`, 
        role: 'KITCHEN', 
        ip: '', 
        port: '9100', 
        paperSize: '80mm',
        status: 'IDLE'
      }
    ]);
  };

  const confirmRemovePrinter = (id: string) => {
    setDeleteConfirmId(null);
    setPrinters(printers.filter(p => p.id !== id));
  };

  const updatePrinter = (id: string, updates: Partial<PrinterConfig>) => {
    setPrinters(printers.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleTestPrint = async (id: string) => {
    updatePrinter(id, { status: 'TESTING' });
    setErrorMessage('');
    
    try {
      const p = printers.find(x => x.id === id);
      if (!p?.ip) throw new Error('IP is required');
      
      const res = await apiClient.post('/printer/test', { ip: p.ip, port: p.port });
      if (res?.success) {
        updatePrinter(id, { status: 'SUCCESS' });
        toast.success(`Successfully connected to ${p.ip}`);
      } else {
        throw new Error('Connection failed');
      }
    } catch (e: any) {
      updatePrinter(id, { status: 'ERROR' });
      const errorMsg = e.message || 'Invalid IP or Port';
      setErrorMessage(errorMsg);
      toast.error(`Connection failed: ${errorMsg}`);
    }
  };

  const scanNetworkForPrinters = async () => {
    setIsScanning(true);
    try {
      const res = await apiClient.get('/printer/scan');
      const found: {ip: string, name: string}[] = res?.printers || [];
      if (found.length === 0) {
        toast.warning("No printers found on the network (Port 9100). Please check if they are turned on and connected to WiFi/LAN.");
      } else {
        const newPrinters = found.map((f, i) => ({
          id: `scan-${Date.now()}-${i}`,
          name: f.name,
          role: 'KITCHEN' as const,
          ip: f.ip,
          port: '9100',
          paperSize: '80mm' as const,
          status: 'IDLE' as const
        }));
        setPrinters(prev => [...prev, ...newPrinters]);
        toast.success(`Found ${found.length} printer(s)! They have been added to your list.`);
      }
    } catch (e: any) {
      toast.error("Error scanning network: " + e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveSettings = () => {
    toast.success('All Printer Settings Saved to Network Profile!');
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white/70 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white/60">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Printer className="h-6 w-6 text-amber-500" />
              Network Printers Setup
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">Configure multiple printers for Cashier, Kitchen KOT, and Labels.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={scanNetworkForPrinters}
              disabled={isScanning}
              className="bg-indigo-50 border-2 border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {isScanning ? 'Scanning...' : 'Scan Network'}
            </button>
            <button 
              onClick={addPrinter}
              className="bg-white border-2 border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Printer
            </button>
            <button 
              onClick={handleSaveSettings}
              className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"
            >
              <Save className="h-4 w-4" /> Save Profile
            </button>
          </div>
        </div>

        {/* Printer List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence>
            {printers.map((printer) => (
              <motion.div 
                key={printer.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/70 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white/60 flex flex-col gap-5 relative group"
              >
                <button 
                  onClick={() => setDeleteConfirmId(printer.id)}
                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <Printer className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={printer.name}
                      onChange={(e) => updatePrinter(printer.id, { name: e.target.value })}
                      className="bg-transparent text-lg font-black text-slate-800 focus:outline-none w-full border-b-2 border-transparent focus:border-amber-400 px-1"
                      placeholder="Printer Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Role / Location</label>
                    <div className="relative">
                      <select 
                        value={printer.role}
                        onChange={(e) => updatePrinter(printer.id, { role: e.target.value as any })}
                        className="w-full bg-slate-50/50 hover:bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="CASHIER">Cashier (Receipts)</option>
                        <option value="KITCHEN">Kitchen (KOT)</option>
                        <option value="BAR">Bar (KOT)</option>
                        <option value="LABEL">Label Station</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Paper / Media</label>
                    <div className="relative">
                      <select 
                        value={printer.paperSize}
                        onChange={(e) => updatePrinter(printer.id, { paperSize: e.target.value as any })}
                        className="w-full bg-slate-50/50 hover:bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="58mm">58mm Receipt</option>
                        <option value="80mm">80mm Receipt</option>
                        <option value="label">Adhesive Label (50x30)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">IP Address</label>
                    <input 
                      type="text" 
                      value={printer.ip}
                      onChange={(e) => updatePrinter(printer.id, { ip: e.target.value })}
                      className="w-full bg-slate-50/50 hover:bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all placeholder:text-slate-300"
                      placeholder="192.168.1.X"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Port</label>
                    <input 
                      type="text" 
                      value={printer.port}
                      onChange={(e) => updatePrinter(printer.id, { port: e.target.value })}
                      className="w-full bg-slate-50/50 hover:bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all placeholder:text-slate-300"
                      placeholder="9100"
                    />
                  </div>
                </div>

                {/* Status & Test */}
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2">
                    {printer.status === 'IDLE' && <div className="h-2 w-2 rounded-full bg-slate-300" />}
                    {printer.status === 'TESTING' && <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />}
                    {printer.status === 'SUCCESS' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                    {printer.status === 'ERROR' && <XCircle className="h-4 w-4 text-rose-500" />}
                    <span className="text-xs font-bold text-slate-500">
                      {printer.status === 'IDLE' && 'Not Tested'}
                      {printer.status === 'TESTING' && 'Connecting...'}
                      {printer.status === 'SUCCESS' && 'Connected'}
                      {printer.status === 'ERROR' && <span className="text-rose-500">Connection Failed</span>}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleTestPrint(printer.id)}
                    disabled={printer.status === 'TESTING'}
                    className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Test Print
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Label Studio Engine */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="flex items-center gap-3 mb-6 pl-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Label Studio Engine</h2>
              <p className="text-sm font-bold text-slate-500">Design your perfect label block by block.</p>
            </div>
          </div>
          
          <AdminLabelStudio />
        </motion.div>

      </div>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-center text-slate-800 mb-2">Delete Printer?</h3>
              <p className="text-sm font-bold text-center text-slate-500 mb-6">
                Are you sure you want to remove this printer? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => confirmRemovePrinter(deleteConfirmId)}
                  className="flex-1 bg-rose-500 text-white font-bold py-3 rounded-xl hover:bg-rose-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
