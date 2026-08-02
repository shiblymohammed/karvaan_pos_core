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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-sidebar w-full max-w-sm rounded-2xl border border-pos-border shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-pos-text flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-500" /> Collect Payment
          </h3>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text cursor-pointer p-1 rounded-lg hover:bg-pos-card">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-pos-card rounded-xl border border-pos-border p-4 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-bold text-pos-text-muted">Customer</span>
            <span className="font-black text-pos-text">{entry.customerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-bold text-pos-text-muted">Invoice</span>
            <span className="font-bold text-pos-text">{entry.billNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-bold text-pos-text-muted">Due Date</span>
            <span className="font-bold text-pos-text">{entry.date}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-pos-border pt-2 mt-2">
            <span className="font-black text-pos-text">Outstanding</span>
            <span className="font-black text-rose-500 text-base">₹{entry.amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1.5">
            Amount Collected (₹)
          </label>
          <input
            type="number"
            min="0.01"
            max={entry.amount}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-4 py-3 bg-pos-input border border-pos-border rounded-xl text-pos-text text-xl font-black focus:outline-none focus:border-emerald-500 shadow-inner text-center"
          />
          {isPartial && (
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Partial payment — ₹{(entry.amount - parseFloat(amount)).toFixed(2)} will remain as new entry
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => { onSettle(entry.id, parseFloat(amount)); onClose(); }}
            disabled={!isValid}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            {isPartial ? 'Record Partial' : 'Mark Paid'}
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-pos-border">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-black text-pos-text-muted hover:text-pos-text mb-4 cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Back to All Customers
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
              {customer.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-pos-text">{customer.name}</h2>
              <p className="text-sm font-bold text-pos-text-muted flex items-center gap-1.5 mt-0.5">
                <Smartphone className="h-3.5 w-3.5" /> {customer.phone}
              </p>
            </div>
          </div>
          <button onClick={handleExportStatement}
            className="flex items-center gap-2 px-4 py-2 bg-pos-card border border-pos-border rounded-xl text-sm font-black text-pos-text-muted hover:text-pos-text hover:border-pos-accent transition-all cursor-pointer">
            <Download className="h-4 w-4" /> Export Statement
          </button>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-pos-card rounded-xl border border-pos-border p-3 text-center">
            <p className="text-[10px] font-black text-pos-text-muted uppercase tracking-wider mb-1">Total Billed</p>
            <p className="text-lg font-black text-pos-text">₹{customer.totalBilled.toFixed(0)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 text-center">
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Paid</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{customer.totalPaid.toFixed(0)}</p>
          </div>
          <div className={`rounded-xl border p-3 text-center ${customer.outstanding > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' : 'bg-pos-card border-pos-border'}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${customer.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-pos-text-muted'}`}>Outstanding</p>
            <p className={`text-lg font-black ${customer.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-pos-text'}`}>
              ₹{customer.outstanding.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h3 className="text-xs font-black text-pos-text-muted uppercase tracking-wider mb-3">
          Transaction History ({customer.entries.length})
        </h3>
        <div className="space-y-2">
          {customer.entries.map(entry => (
            <div key={entry.id}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                entry.status === 'UNPAID'
                  ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                  : 'bg-pos-card border-pos-border opacity-70'
              }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                entry.status === 'PAID'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'
              }`}>
                {entry.status === 'PAID' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-pos-text">{entry.billNumber}</p>
                <p className="text-xs font-bold text-pos-text-muted mt-0.5">{entry.date}</p>
              </div>
              <div className="text-right">
                <p className={`font-black text-base ${entry.status === 'UNPAID' ? 'text-rose-600 dark:text-rose-400' : 'text-pos-text-muted line-through'}`}>
                  ₹{entry.amount.toFixed(2)}
                </p>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                  entry.status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                }`}>
                  {entry.status}
                </span>
              </div>
              {entry.status === 'UNPAID' && (
                <button
                  onClick={() => setSettleTarget(entry)}
                  className="ml-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-lg transition-colors cursor-pointer shrink-0">
                  Collect
                </button>
              )}
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

  // Handle partial settlement
  const handleSettle = (id: string, partialAmount?: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    if (!partialAmount || partialAmount >= entry.amount) {
      // Full settlement
      settleDebt(id);
    } else {
      // Partial: settle full entry + create a new entry for the remainder
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

  // If customer selected → show detail view
  if (selectedPhone) {
    const customer = customerSummaries.find(c => c.phone === selectedPhone);
    if (customer) {
      return (
        <div className="h-full bg-pos-bg">
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
    <div className="h-full flex flex-col overflow-hidden bg-pos-bg">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-black text-pos-text flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-purple-500" /> Customer Ledger
            </h2>
            <p className="text-sm font-bold text-pos-text-muted mt-0.5">Manage credit balances and outstanding dues (Udhar)</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
            <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">Total Outstanding</p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">₹{totalOutstanding.toFixed(0)}</p>
          </div>
          <div className="bg-pos-card border border-pos-border rounded-2xl p-4">
            <p className="text-xs font-black text-pos-text-muted uppercase tracking-wider mb-1">Customers with Dues</p>
            <p className="text-2xl font-black text-pos-text">{unpaidCustomers}</p>
          </div>
          <div className="bg-pos-card border border-pos-border rounded-2xl p-4">
            <p className="text-xs font-black text-pos-text-muted uppercase tracking-wider mb-1">Total Customers</p>
            <p className="text-2xl font-black text-pos-text">{customerSummaries.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
            <input
              type="text"
              placeholder="Search name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-pos-card border border-pos-border rounded-xl text-sm font-bold text-pos-text focus:outline-none focus:border-pos-accent"
            />
          </div>
          <div className="flex gap-1 bg-pos-card rounded-xl p-1 border border-pos-border">
            {(['ALL', 'UNPAID', 'PAID'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  filterStatus === f ? 'bg-pos-accent text-white' : 'text-pos-text-muted hover:text-pos-text'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Customer List ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-pos-text-muted bg-pos-card rounded-2xl border border-pos-border">
            <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-black text-lg">No customers found</p>
            <p className="text-sm mt-1">Credit bills from the POS will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(customer => (
              <button
                key={customer.phone}
                onClick={() => setSelectedPhone(customer.phone)}
                className="w-full flex items-center gap-4 px-5 py-4 bg-pos-card rounded-2xl border border-pos-border hover:border-pos-accent hover:shadow-md transition-all text-left cursor-pointer group"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-xl font-black text-white shrink-0 shadow-sm">
                  {customer.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-base text-pos-text truncate">{customer.name}</p>
                  <p className="text-xs font-bold text-pos-text-muted flex items-center gap-1 mt-0.5">
                    <Smartphone className="h-3 w-3" /> {customer.phone}
                    <span className="mx-1">·</span>
                    <Receipt className="h-3 w-3" /> {customer.entryCount} bill{customer.entryCount !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Balance Badges */}
                <div className="text-right shrink-0">
                  {customer.outstanding > 0 ? (
                    <div>
                      <p className="font-black text-base text-rose-600 dark:text-rose-400">
                        ₹{customer.outstanding.toFixed(0)} due
                      </p>
                      <p className="text-[10px] font-bold text-pos-text-muted mt-0.5">
                        of ₹{customer.totalBilled.toFixed(0)} billed
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-black text-sm">All Settled</span>
                    </div>
                  )}
                </div>

                <ChevronRight className="h-5 w-5 text-pos-text-muted group-hover:text-pos-accent transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
