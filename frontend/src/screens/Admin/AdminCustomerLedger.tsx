import React, { useState, useMemo } from 'react';
import {
  BookOpen, Check, Search, Smartphone, User, Plus,
  X, TrendingDown, AlertCircle, CheckCircle2, ChevronRight,
  ArrowLeft, Banknote, Clock, Receipt, Download
} from 'lucide-react';
import { useLedgerStore, LedgerEntry } from '../../store/useLedgerStore';

// ─── Per-Customer Summary ─────────────────────────────────────────────────────
interface CustomerSummary {
  phone: string;
  name: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  lastActivity: string;
  entryCount: number;
  entries: LedgerEntry[];
}

const inputCls = 'w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 shadow-sm transition-all';
const labelCls = 'block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2';

// ─── Settle Payment Modal ──────────────────────────────────────────────────────
interface SettleModalProps {
  entry: LedgerEntry;
  onClose: () => void;
  onSettle: (id: string, partialAmount?: number) => void;
}

const SettleModal: React.FC<SettleModalProps> = ({ entry, onClose, onSettle }) => {
  const [amount, setAmount] = useState(entry.amount.toFixed(2));
  const isPartial = parseFloat(amount) < entry.amount && parseFloat(amount) > 0;
  const isValid = parseFloat(amount) > 0 && parseFloat(amount) <= entry.amount;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-sm rounded-[24px] sm:rounded-[32px] border border-white shadow-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-5 border-b border-slate-200/60 pb-3 sm:pb-4">
          <h3 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg sm:rounded-xl"><Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" /></div>
            Collect Payment
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="bg-white/50 rounded-xl sm:rounded-2xl border border-slate-200/80 p-3 sm:p-4 mb-4 sm:mb-5 space-y-1.5 sm:space-y-2 shadow-sm">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="font-bold text-slate-500">Customer</span>
            <span className="font-black text-slate-800">{entry.customerName}</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="font-bold text-slate-500">Invoice</span>
            <span className="font-bold text-slate-800">{entry.billNumber}</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="font-bold text-slate-500">Due Date</span>
            <span className="font-bold text-slate-800">{entry.date}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-200 pt-2 sm:pt-3 mt-1.5 sm:mt-2">
            <span className="font-black text-slate-600 text-[10px] sm:text-[11px] uppercase tracking-widest">Outstanding</span>
            <span className="font-black text-rose-500 text-base sm:text-lg">₹{entry.amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-5 sm:mb-6">
          <label className={labelCls}>Amount Collected (₹)</label>
          <input
            type="number"
            min="0.01"
            max={entry.amount}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`${inputCls} text-xl sm:text-2xl py-3 sm:py-4 text-center tracking-wider`}
          />
          {isPartial && (
            <p className="text-[10px] sm:text-[11px] font-black text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-amber-100 leading-tight">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              Partial: ₹{(entry.amount - parseFloat(amount)).toFixed(2)} will remain as new entry
            </p>
          )}
        </div>

        <div className="flex gap-2 sm:gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 sm:py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm active:scale-95">
            Cancel
          </button>
          <button
            onClick={() => { onSettle(entry.id, parseFloat(amount)); onClose(); }}
            disabled={!isValid}
            className="flex-1 py-3 sm:py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-emerald-200 transition-transform active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 sm:gap-2">
            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {isPartial ? 'Save Partial' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Customer Detail View ─────────────────────────────────────────────────────
interface CustomerDetailProps {
  customer: CustomerSummary;
  onBack: () => void;
  onSettle: (id: string, amount?: number) => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customer, onBack, onSettle }) => {
  const [settleTarget, setSettleTarget] = useState<LedgerEntry | null>(null);

  const handleExportStatement = () => {
    const rows = [
      ['Invoice', 'Date', 'Amount', 'Status'],
      ...customer.entries.map(e => [e.billNumber, e.date, e.amount.toFixed(2), e.status])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Ledger-${customer.name.replace(' ', '_')}-${customer.phone}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-5 sm:pt-8 pb-4 sm:pb-6 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-400 hover:text-slate-800 mb-4 sm:mb-6 cursor-pointer transition-colors w-fit bg-white/60 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-lg border-4 border-white/80 shrink-0">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight">{customer.name}</h2>
              <p className="text-[10px] sm:text-sm font-bold text-slate-500 flex items-center gap-1.5 mt-1 sm:mt-1 bg-white/50 px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl w-fit shadow-inner border border-slate-100">
                <Smartphone className="h-3 w-3 sm:h-4 sm:w-4" /> {customer.phone}
              </p>
            </div>
          </div>
          <button onClick={handleExportStatement}
            className="flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 bg-white/70 hover:bg-white backdrop-blur-xl border border-white/80 shadow-sm rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-slate-600 hover:text-indigo-600 transition-all cursor-pointer active:scale-95 w-full sm:w-auto">
            <Download className="h-4 w-4" /> Export Statement
          </button>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-8">
          <div className="bg-white/70 backdrop-blur-xl rounded-[20px] sm:rounded-[24px] border border-white/80 shadow-sm p-4 sm:p-5 text-center">
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5">Total Billed</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">₹{customer.totalBilled.toFixed(0)}</p>
          </div>
          <div className="bg-emerald-50/70 backdrop-blur-xl rounded-[20px] sm:rounded-[24px] border border-emerald-100 shadow-sm p-4 sm:p-5 text-center">
            <p className="text-[9px] sm:text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1 sm:mb-1.5">Total Paid</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-700">₹{customer.totalPaid.toFixed(0)}</p>
          </div>
          <div className={`col-span-2 sm:col-span-1 rounded-[20px] sm:rounded-[24px] backdrop-blur-xl shadow-sm p-4 sm:p-5 text-center flex flex-row sm:flex-col items-center justify-between sm:justify-center ${customer.outstanding > 0 ? 'bg-rose-50 border-2 border-rose-200' : 'bg-white/70 border border-white/80'}`}>
            <p className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-0 sm:mb-1.5 ${customer.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Outstanding</p>
            <p className={`text-2xl sm:text-3xl font-black ${customer.outstanding > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              ₹{customer.outstanding.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 sm:pb-8">
        <h3 className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 sm:mb-4 px-1">
          Transaction History ({customer.entries.length})
        </h3>
        <div className="space-y-3">
          {customer.entries.map(entry => (
            <div key={entry.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border shadow-sm transition-all ${
                entry.status === 'UNPAID'
                  ? 'bg-white/80 border-rose-200 hover:shadow-md'
                  : 'bg-white/50 border-white/60 opacity-80'
              }`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                  entry.status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                    : 'bg-rose-100 text-rose-600 border border-rose-200'
                }`}>
                  {entry.status === 'PAID' ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <Clock className="h-5 w-5 sm:h-6 sm:w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm sm:text-base text-slate-800">{entry.billNumber}</p>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5 sm:mt-1">{entry.date}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 sm:w-1/2">
                <div className="text-left sm:text-right">
                  <p className={`font-black text-lg sm:text-xl ${entry.status === 'UNPAID' ? 'text-rose-600' : 'text-slate-400 line-through'}`}>
                    ₹{entry.amount.toFixed(2)}
                  </p>
                  <span className={`inline-block text-[9px] sm:text-[10px] font-black px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg mt-1 uppercase tracking-widest ${
                    entry.status === 'PAID'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}>
                    {entry.status}
                  </span>
                </div>
                {entry.status === 'UNPAID' && (
                  <button
                    onClick={() => setSettleTarget(entry)}
                    className="px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-200 transition-all cursor-pointer shrink-0 active:scale-95">
                    Collect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {settleTarget && (
        <SettleModal
          entry={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSettle={onSettle}
        />
      )}
    </div>
  );
};

// ─── Main Ledger Screen ────────────────────────────────────────────────────────
export const AdminCustomerLedger: React.FC = () => {
  const { entries, settleDebt, addEntry } = useLedgerStore();
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');

  // Group all entries by customer phone → per-customer summary
  const customerSummaries = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    entries.forEach(e => {
      if (!map.has(e.customerPhone)) {
        map.set(e.customerPhone, {
          phone: e.customerPhone,
          name: e.customerName,
          totalBilled: 0,
          totalPaid: 0,
          outstanding: 0,
          lastActivity: e.date,
          entryCount: 0,
          entries: [],
        });
      }
      const s = map.get(e.customerPhone)!;
      s.totalBilled += e.amount;
      if (e.status === 'PAID') s.totalPaid += e.amount;
      else s.outstanding += e.amount;
      s.entryCount += 1;
      s.entries.push(e);
      // Latest date
      if (new Date(e.date) > new Date(s.lastActivity)) s.lastActivity = e.date;
    });
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customerSummaries.filter(c => {
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
      const matchStatus =
        filterStatus === 'ALL' ? true :
        filterStatus === 'UNPAID' ? c.outstanding > 0 :
        c.outstanding === 0;
      return matchSearch && matchStatus;
    });
  }, [customerSummaries, search, filterStatus]);

  const totalOutstanding = customerSummaries.reduce((s, c) => s + c.outstanding, 0);
  const unpaidCustomers = customerSummaries.filter(c => c.outstanding > 0).length;

  const handleSettle = (id: string, partialAmount?: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    if (!partialAmount || partialAmount >= entry.amount) {
      settleDebt(id);
    } else {
      settleDebt(id);
      const remaining = entry.amount - partialAmount;
      addEntry({
        customerId: entry.customerId,
        customerName: entry.customerName,
        customerPhone: entry.customerPhone,
        amount: remaining,
        billNumber: `${entry.billNumber}-R`,
        date: new Date().toLocaleDateString('en-IN'),
      });
    }
  };

  if (selectedPhone) {
    const customer = customerSummaries.find(c => c.phone === selectedPhone);
    if (customer) {
      return (
        <div className="h-full bg-transparent">
          <CustomerDetail
            customer={customer}
            onBack={() => setSelectedPhone(null)}
            onSettle={handleSettle}
          />
        </div>
      );
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
        <div className="flex flex-row items-center justify-between gap-2 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg sm:rounded-xl"><BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" /></div> 
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 leading-tight">
                Customer <span className="hidden sm:inline">Ledger</span>
              </h2>
              <p className="text-[10px] sm:text-sm font-bold text-slate-500 mt-0.5">Manage credit balances</p>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="col-span-2 md:col-span-1 bg-rose-50/80 backdrop-blur-xl border border-rose-200 rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 shadow-sm flex flex-row md:flex-col items-center justify-between md:justify-center text-left md:text-center">
            <p className="text-[10px] sm:text-[11px] font-black text-rose-500 uppercase tracking-widest mb-0 md:mb-2">Total Outstanding</p>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">₹{totalOutstanding.toFixed(0)}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-xl border border-white/80 rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 shadow-sm text-center">
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">With Dues</p>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{unpaidCustomers}</p>
          </div>
          <div className="bg-white/70 backdrop-blur-xl border border-white/80 rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 shadow-sm text-center">
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Total Cust.</p>
            <p className="text-xl sm:text-3xl font-black text-slate-800">{customerSummaries.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 bg-white/70 backdrop-blur-xl border border-white/80 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-400/20 shadow-sm transition-all"
            />
          </div>
          <div className="flex gap-1 bg-white/60 backdrop-blur-xl rounded-[16px] sm:rounded-[20px] p-1.5 border border-white/80 shadow-sm overflow-x-auto hide-scrollbar">
            {(['ALL', 'UNPAID', 'PAID'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-[14px] text-[10px] sm:text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === f ? 'bg-white shadow-sm text-indigo-600 border border-slate-100' : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Customer List ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 sm:pb-8 mt-2">
        {filtered.length === 0 ? (
          <div className="py-12 sm:py-20 text-center text-slate-400 bg-white/50 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] border border-white/80 shadow-sm flex flex-col items-center justify-center gap-3 sm:gap-4 mx-1">
            <div className="p-4 sm:p-5 bg-white/60 rounded-full shadow-inner border border-white">
              <User className="h-8 w-8 sm:h-10 sm:w-10 text-slate-300" />
            </div>
            <div>
              <p className="font-black text-base sm:text-lg text-slate-700">No customers found</p>
              <p className="text-[11px] sm:text-sm font-medium mt-1">Credit bills from the POS will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map(customer => (
              <button
                key={customer.phone}
                onClick={() => setSelectedPhone(customer.phone)}
                className="w-full flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 bg-white/70 backdrop-blur-xl rounded-[20px] sm:rounded-[24px] border border-white/80 hover:shadow-lg hover:border-indigo-100 transition-all text-left cursor-pointer group active:scale-[0.98]"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xl sm:text-2xl font-black text-white shrink-0 shadow-md border border-white/20">
                    {customer.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
                    <p className="font-black text-base sm:text-lg text-slate-800 truncate leading-tight">{customer.name}</p>
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-1 sm:mt-1.5 bg-white/50 px-2 py-0.5 rounded-lg w-fit shadow-sm border border-slate-100">
                      <Smartphone className="h-3 w-3" /> {customer.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-3 sm:pt-4 border-t border-slate-200/50 mt-1">
                  <div>
                     <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1 flex items-center gap-1">
                       <Receipt className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {customer.entryCount} bill{customer.entryCount !== 1 ? 's' : ''}
                     </p>
                     <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                       Billed: ₹{customer.totalBilled.toFixed(0)}
                     </p>
                  </div>
                  {/* Balance Badges */}
                  <div className="text-right">
                    {customer.outstanding > 0 ? (
                      <div className="bg-rose-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-rose-100">
                        <p className="font-black text-sm sm:text-base text-rose-600">
                          ₹{customer.outstanding.toFixed(0)} <span className="text-[9px] sm:text-[10px] uppercase">Due</span>
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="font-black text-[9px] sm:text-[11px] uppercase tracking-widest">Settled</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
