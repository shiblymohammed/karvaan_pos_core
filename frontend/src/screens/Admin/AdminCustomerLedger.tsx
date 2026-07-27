import React, { useState } from 'react';
import { BookOpen, Check, Search, Smartphone, User } from 'lucide-react';
import { useLedgerStore } from '../../store/useLedgerStore';

export const AdminCustomerLedger: React.FC = () => {
  const { entries, settleDebt } = useLedgerStore();
  const [search, setSearch] = useState('');

  const filteredEntries = entries.filter(e => 
    e.customerName.toLowerCase().includes(search.toLowerCase()) || 
    e.customerPhone.includes(search)
  );

  return (
    <div className="h-full overflow-y-auto p-6 bg-pos-bg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-pos-text">Customer Ledger (Udhar)</h2>
          <p className="text-sm font-bold text-pos-text-muted mt-1">Manage outstanding credit balances and customer debts.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-pos-text-muted" />
          <input 
            type="text" 
            placeholder="Search Name or Phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-pos-card border border-pos-border rounded-xl text-pos-text font-bold focus:outline-none focus:border-emerald-500 w-64 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-pos-card rounded-2xl border border-pos-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-pos-sidebar border-b border-pos-border text-pos-text-muted text-xs uppercase tracking-wider font-black">
              <th className="p-4">Customer</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Invoice / Date</th>
              <th className="p-4 text-right">Amount Due</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pos-border">
            {filteredEntries.map(entry => (
              <tr key={entry.id} className="hover:bg-pos-bg transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-black">
                      {entry.customerName.charAt(0)}
                    </div>
                    <span className="font-bold text-pos-text">{entry.customerName}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-pos-text-muted">
                    <Smartphone className="h-3.5 w-3.5" />
                    {entry.customerPhone}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-pos-text">{entry.billNumber}</span>
                    <span className="text-xs font-bold text-pos-text-muted">{entry.date}</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className={`font-black text-base ${entry.status === 'UNPAID' ? 'text-rose-500' : 'text-pos-text-muted'}`}>
                    ₹{entry.amount.toFixed(2)}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                    entry.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                  }`}>
                    {entry.status}
                  </span>
                </td>
                <td className="p-4 text-center">
                  {entry.status === 'UNPAID' ? (
                    <button 
                      onClick={() => {
                        if (confirm(`Mark ₹${entry.amount} as PAID by ${entry.customerName}?`)) {
                          settleDebt(entry.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white font-bold rounded-lg border border-emerald-200 dark:border-emerald-900 transition-colors shadow-sm cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Settle
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-pos-text-muted">Settled</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-pos-text-muted font-bold">
                  No ledger entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
