import React, { useState, useEffect, useMemo } from 'react';
import { Users, Phone, Search, Banknote, Receipt, ChevronDown, ChevronRight, Calendar, UserCheck, Star, CreditCard, CheckCircle2, History } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { toast } from '../../store/useToastStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useLedgerStore } from '../../store/useLedgerStore';

export const AdminCustomerScreen: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);

  const { entries: ledgerEntries, settleDebt } = useLedgerStore();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      // Fetch a large window of history for customers (e.g. last 365 days)
      const d1 = new Date();
      d1.setFullYear(d1.getFullYear() - 1);
      const startDate = d1.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const res = await apiClient.get(`/billing/history?startDate=${startDate}&endDate=${endDate}`);
      setHistory(res);
    } catch (err: any) {
      toast.error('Failed to load customer orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Aggregate customer data
  const customersMap = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      totalSpend: number;
      visits: number;
      orders: any[];
      creditDue: number;
      ledger: any[];
    }>();

    // 1. Process Billing History
    history.forEach(bill => {
      if (!bill.customerPhone) return;
      const phone = bill.customerPhone;
      
      if (!map.has(phone)) {
        map.set(phone, {
          name: bill.customerName || 'Unknown Guest',
          phone,
          totalSpend: 0,
          visits: 0,
          orders: [],
          creditDue: 0,
          ledger: []
        });
      }
      
      const c = map.get(phone)!;
      c.visits++;
      c.totalSpend += bill.grandTotal;
      c.orders.push(bill);
    });

    // 2. Process Ledger (Credits & Payments)
    ledgerEntries.forEach(entry => {
      if (!entry.customerPhone) return;
      const phone = entry.customerPhone;
      
      if (!map.has(phone)) {
        map.set(phone, {
          name: entry.customerName || 'Unknown Guest',
          phone,
          totalSpend: 0,
          visits: 0,
          orders: [],
          creditDue: 0,
          ledger: []
        });
      }

      const c = map.get(phone)!;
      if (entry.status === 'UNPAID') {
        c.creditDue += entry.amount;
      }
      c.ledger.push(entry);
    });

    // Sort by most visits / spend
    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [history, ledgerEntries]);

  const filteredCustomers = customersMap.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 lg:p-8 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 w-full">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-500" />
            Customer Management
          </h1>
          <p className="text-slate-500 font-semibold mt-1">
            Track customer visits, order history, and manage outstanding ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name or phone..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4"></div>
            <p className="font-bold">Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <Users className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-bold text-slate-600">No Customers Found</p>
            <p className="text-sm">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-1 gap-2">
              {filteredCustomers.map((customer) => {
                const isExpanded = expandedPhone === customer.phone;
                
                return (
                  <div 
                    key={customer.phone} 
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded 
                        ? 'border-emerald-200 shadow-lg ring-1 ring-emerald-500/10' 
                        : 'border-slate-100 shadow-sm hover:border-emerald-200 hover:shadow-md'
                    }`}
                  >
                    {/* Header Summary */}
                    <div 
                      className={`p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-emerald-50/30' : 'bg-transparent'}`}
                      onClick={() => setExpandedPhone(isExpanded ? null : customer.phone)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
                          customer.creditDue > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        }`}>
                          <UserCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            {customer.name}
                            {customer.visits > 10 && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                          </h3>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {customer.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 md:gap-8 flex-wrap justify-end">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-0.5">Total Spend</p>
                          <p className="font-black text-slate-800 tabular-nums">₹{customer.totalSpend.toFixed(2)}</p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-0.5">Visits</p>
                          <p className="font-bold text-slate-700">{customer.visits}</p>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-0.5">Credit Due</p>
                          {customer.creditDue > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-black text-sm border border-rose-200">
                              ₹{customer.creditDue.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-black text-sm border border-emerald-200">
                              ₹0.00
                            </span>
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200 text-slate-400">
                          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 bg-slate-50/50"
                        >
                          <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Order History */}
                            <div>
                              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <History className="h-4 w-4 text-emerald-600" /> Recent Orders ({customer.orders.length})
                              </h4>
                              {customer.orders.length === 0 ? (
                                <div className="p-4 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm font-semibold">
                                  No orders found.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300">
                                  {customer.orders.sort((a,b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()).map(order => (
                                    <div key={order.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                      <div>
                                        <p className="text-xs font-bold text-slate-800">{order.billNumber}</p>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                                          <Calendar className="h-3 w-3" /> {new Date(order.settledAt).toLocaleString()}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-black text-slate-800 tabular-nums">₹{order.grandTotal.toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5 inline-block border border-emerald-100">
                                          {order.paymentMethod}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Ledger / Credit History */}
                            <div>
                              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-rose-600" /> Credit / Ledger ({customer.ledger.length})
                              </h4>
                              {customer.ledger.length === 0 ? (
                                <div className="p-4 border border-slate-200 border-dashed rounded-xl text-center text-slate-400 text-sm font-semibold">
                                  No credit entries found.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300">
                                  {customer.ledger.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                                    <div key={entry.id} className={`bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between ${
                                      entry.status === 'UNPAID' ? 'border-rose-200 bg-rose-50/30' : 'border-emerald-200 bg-emerald-50/30'
                                    }`}>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800">Bill: {entry.billNumber}</p>
                                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                                          <Calendar className="h-3 w-3" /> {entry.date}
                                        </p>
                                      </div>
                                      <div className="text-right flex items-center gap-3">
                                        <div>
                                          <p className="text-sm font-black text-slate-800 tabular-nums">₹{entry.amount.toFixed(2)}</p>
                                          {entry.status === 'UNPAID' ? (
                                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider bg-rose-100 px-1.5 py-0.5 rounded mt-0.5 inline-block border border-rose-200">UNPAID</span>
                                          ) : (
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-100 px-1.5 py-0.5 rounded mt-0.5 inline-block border border-emerald-200 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> PAID</span>
                                          )}
                                        </div>
                                        
                                        {/* Action: Settle Debt */}
                                        {entry.status === 'UNPAID' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if(window.confirm('Mark this amount as PAID?')) {
                                                settleDebt(entry.id);
                                                toast.success('Debt settled successfully!');
                                              }
                                            }}
                                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                                          >
                                            Settle
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
