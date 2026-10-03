import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import {
  TrendingUp, Users, Receipt, CreditCard, Download, RefreshCw,
  Calendar, Package, Bike, DollarSign, ArrowUpRight, Clock,
  ChevronLeft, ChevronRight, BarChart2, Loader2, RotateCcw
} from 'lucide-react';
import { DatePickerPopover } from '../../components/DatePickerPopover';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailySummary {
  date: string;
  totalBills: number;
  grossRevenue: number;
  totalDiscount: number;
  totalGst: number;
  netRevenue: number;
  deliveriesCompleted: number;
  paymentBreakdown: Record<string, number>;
  orderTypeBreakdown: Record<string, number>;
}

interface BillRecord {
  id: string;
  billNumber: string;
  orderType: string;
  subtotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  settledAt: string;
  customerName: string | null;
  cashier?: { name: string };
  order?: { orderNumber: string; items: any[] };
}

interface TopItem {
  productId: string;
  productName: string;
  totalSold: number;
}

import { getServerUrl } from '../../services/serverConfig';
import { ReturnOrderModal, ReturnOrderData } from '../../components/ReturnOrderModal';

// ─── Helper ──────────────────────────────────────────────────────────────────
const BACKEND = getServerUrl();
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#f59e0b',
  UPI: '#10b981',
  CARD: '#3b82f6',
  CREDIT: '#8b5cf6',
  SPLIT: '#ec4899',
};

const ORDER_TYPE_COLORS: Record<string, string> = {
  DINE_IN: '#10b981',
  PARCEL: '#f59e0b',
  DELIVERY: '#3b82f6',
};

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}> = ({ label, value, sub, icon, color }) => (
  <div className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg hover:border-white transition-all flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <h3 className={`text-2xl font-black ${color}`}>{value}</h3>
      {sub && <p className="text-xs font-bold text-slate-500 mt-0.5">{sub}</p>}
    </div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${color.replace('text-', 'bg-').replace('-600', '-50/80').replace('-400', '-950/40')} border-current/20`}>
      {icon}
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const [viewDate, setViewDate] = useState(dateStr(new Date()));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BILLS' | 'ITEMS'>('OVERVIEW');
  const [returnModalData, setReturnModalData] = useState<ReturnOrderData | null>(null);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const [sumRes, billsRes, itemsRes] = await Promise.all([
        fetch(`${BACKEND}/history/daily-summary?date=${date}`),
        fetch(`${BACKEND}/history/bills?startDate=${date}&endDate=${date}&limit=100`),
        fetch(`${BACKEND}/history/top-items?startDate=${date}&endDate=${date}&limit=10`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (billsRes.ok) { const d = await billsRes.json(); setBills(d.data || []); }
      if (itemsRes.ok) setTopItems(await itemsRes.json());
    } catch {
      // Backend offline — show empty state gracefully
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(viewDate); }, [viewDate, load]);

  const shiftDate = (days: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + days);
    if (d <= new Date()) setViewDate(dateStr(d));
  };

  const isToday = viewDate === dateStr(new Date());

  // Build hourly chart data from bills
  const hourlyData = Array.from({ length: 14 }, (_, i) => ({
    time: `${i + 9}:00`,
    sales: 0,
    orders: 0,
  }));
  bills.forEach(b => {
    const h = new Date(b.settledAt).getHours();
    const idx = h - 9;
    if (idx >= 0 && idx < 14) {
      hourlyData[idx].sales += b.grandTotal;
      hourlyData[idx].orders += 1;
    }
  });

  // Payment breakdown pie data
  const paymentData = Object.entries(summary?.paymentBreakdown || {}).map(([name, value]) => ({
    name, value, color: PAYMENT_COLORS[name] || '#94a3b8'
  }));

  // Order type bar data
  const orderTypeData = Object.entries(summary?.orderTypeBreakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' '), value, color: ORDER_TYPE_COLORS[name] || '#94a3b8'
  }));

  const handleExportCSV = () => {
    if (!bills.length) return;
    const rows = [
      ['Bill #', 'Order Type', 'Customer', 'Payment', 'Subtotal', 'Discount', 'GST', 'Grand Total', 'Time'],
      ...bills.map(b => [
        b.billNumber, b.orderType, b.customerName || 'Walk-in',
        b.paymentMethod, b.subtotal, b.discount, ((b.subtotal - b.discount) * 0.05).toFixed(2),
        b.grandTotal, new Date(b.settledAt).toLocaleTimeString()
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Karvaan-Sales-${viewDate}.csv`; a.click();
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden p-3 xl:px-4 xl:pt-4 xl:pb-6 pb-28 space-y-4 bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] transition-colors duration-300 text-slate-800">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Sales Dashboard</h2>
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5">
            {isToday ? "Today's live performance" : `Report for ${new Date(viewDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 -mx-1 px-1">
          {/* Date Navigation */}
          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl p-1 shadow-sm shrink-0">
            <button onClick={() => shiftDate(-1)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer text-slate-500 hover:text-slate-800">
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <div className="flex items-center px-1">
              <DatePickerPopover 
                date={viewDate} 
                onChange={setViewDate} 
                maxDate={dateStr(new Date())} 
              />
            </div>
            <button onClick={() => shiftDate(1)} disabled={isToday}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer text-slate-500 hover:text-slate-800 disabled:opacity-30">
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          </div>
          <button onClick={() => load(viewDate)}
            className="p-2 sm:p-2.5 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl hover:bg-white transition-colors cursor-pointer text-slate-500 shadow-sm shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#b5ef85] hover:bg-[#a2db74] text-[#0d212b] font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer text-xs sm:text-sm border border-[#b5ef85]/50 shrink-0">
            <Download className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" /> <span className="hidden sm:inline">Export</span> CSV
          </button>
        </div>
      </div>

      {/* ─── Loading Overlay ──────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-bold text-sm">Loading report data…</span>
        </div>
      )}

      {/* ─── Tabs ─────────────────────────────────────────────────── */}
      {!loading && (
        <>
          <div className="flex bg-white/70 backdrop-blur-xl rounded-xl p-1 border border-white/60 w-full sm:w-fit shadow-sm overflow-x-auto no-scrollbar shrink-0 relative">
            {(['OVERVIEW', 'BILLS', 'ITEMS'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`relative flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition-colors cursor-pointer whitespace-nowrap z-10 ${
                  activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}>
                {activeTab === tab && (
                  <motion.div
                    layoutId="adminTabsPill"
                    className="absolute inset-0 bg-slate-800 rounded-lg shadow-sm -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {tab === 'OVERVIEW' ? '📊 Overview' : tab === 'BILLS' ? '🧾 Bills' : '🍽️ Top Items'}
              </button>
            ))}
          </div>

          {/* ─── OVERVIEW TAB ─────────────────────────────────────── */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Gross Revenue" value={fmt(summary?.grossRevenue || 0)}
                  sub={`${summary?.totalBills || 0} bills settled`}
                  icon={<TrendingUp className="h-6 w-6" />} color="text-emerald-600" />
                <KpiCard label="Net Revenue" value={fmt(summary?.netRevenue || 0)}
                  sub={`After ₹${(summary?.totalDiscount || 0).toFixed(0)} discount`}
                  icon={<DollarSign className="h-6 w-6" />} color="text-blue-600" />
                <KpiCard label="Avg Order Value"
                  value={fmt(summary && summary.totalBills > 0 ? summary.grossRevenue / summary.totalBills : 0)}
                  sub="Per transaction"
                  icon={<CreditCard className="h-6 w-6" />} color="text-amber-600" />
                <KpiCard label="Deliveries Done" value={`${summary?.deliveriesCompleted || 0}`}
                  sub="Delivered orders"
                  icon={<Bike className="h-6 w-6" />} color="text-purple-600" />
              </div>

              {/* GST Summary */}
              {summary && summary.totalGst > 0 && (
                <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 p-5 shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">GST Summary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">Total GST Collected</p>
                      <p className="text-xl font-black text-slate-800">{fmt(summary.totalGst)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">CGST (2.5%)</p>
                      <p className="text-xl font-black text-blue-600">{fmt(summary.totalGst / 2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">SGST (2.5%)</p>
                      <p className="text-xl font-black text-indigo-600">{fmt(summary.totalGst / 2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hourly Sales */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg transition-all">
                  <h3 className="text-base font-black text-slate-800 mb-4">Hourly Sales Velocity</h3>
                  <div className="h-64 w-full">
                    {bills.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyData.filter(h => h.sales > 0 || h.orders > 0)}>
                          <defs>
                            <linearGradient id="colorSales2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" className="opacity-50" />
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#cbd5e1', borderRadius: '16px', fontWeight: 'bold', backdropFilter: 'blur(10px)' }}
                            formatter={(v: number) => [fmt(v), 'Revenue']}
                          />
                          <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        <div className="text-center">
                          <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
                          <p className="font-bold text-sm">No sales data for this date</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Breakdown Pie */}
                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg transition-all">
                  <h3 className="text-base font-black text-slate-800 mb-4">Payment Methods</h3>
                  <div className="h-64 w-full">
                    {paymentData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentData} cx="50%" cy="45%" innerRadius={55} outerRadius={75}
                            paddingAngle={4} dataKey="value" stroke="none">
                            {paymentData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#cbd5e1', borderRadius: '16px', fontWeight: 'bold', backdropFilter: 'blur(10px)' }}
                            formatter={(v: number) => [fmt(v), '']}
                          />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontWeight: 700, fontSize: 12, color: '#475569' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        <p className="font-bold text-sm">No payment data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Type Breakdown */}
              {orderTypeData.length > 0 && (
                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg transition-all">
                  <h3 className="text-base font-black text-slate-800 mb-4">Revenue by Order Type</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={orderTypeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" className="opacity-50" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} width={70} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#cbd5e1', borderRadius: '16px', fontWeight: 'bold', backdropFilter: 'blur(10px)' }}
                          formatter={(v: number) => [fmt(v), 'Revenue']}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {orderTypeData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── BILLS TAB ────────────────────────────────────────── */}
          {activeTab === 'BILLS' && (
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 overflow-hidden shadow-sm">
              {bills.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-black text-lg">No bills for this date</p>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-white/40 border-b border-white/60 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 font-black">Bill #</th>
                      <th className="py-3 px-4 font-black">Type</th>
                      <th className="py-3 px-4 font-black">Customer</th>
                      <th className="py-3 px-4 font-black">Payment</th>
                      <th className="py-3 px-4 font-black">Discount</th>
                      <th className="py-3 px-4 font-black text-right">Total</th>
                      <th className="py-3 px-4 font-black text-right">Time</th>
                      <th className="py-3 px-4 font-black text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(b => (
                      <tr key={b.id} className="border-b border-white/40 hover:bg-white/50 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-sm text-slate-800">{b.billNumber}</td>
                        <td className="py-2.5 px-4">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                            b.orderType === 'DINE_IN' ? 'bg-emerald-100 text-emerald-700' :
                            b.orderType === 'DELIVERY' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {b.orderType?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-sm font-bold text-slate-500">{b.customerName || '—'}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-white/60 border border-slate-200 text-slate-600">
                            {b.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-sm font-bold text-rose-500">
                          {b.discount > 0 ? `-₹${b.discount.toFixed(0)}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-black text-emerald-600 text-right">
                          {fmt(b.grandTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-bold text-slate-500 text-right">
                          {new Date(b.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => setReturnModalData({
                              billNumber: b.billNumber,
                              orderType: b.orderType,
                              customerName: b.customerName || undefined,
                              items: b.order?.items?.map((i: any) => ({ name: i.product?.name || i.name || 'Item', quantity: i.quantity, price: i.price })) || [],
                              grandTotal: b.grandTotal,
                              paymentMethod: b.paymentMethod,
                            })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-[10px] font-black transition-colors cursor-pointer active:scale-95"
                            title="Process Return / Refund"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Return
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/60 bg-white/40">
                      <td colSpan={5} className="py-3 px-4 font-black text-sm text-slate-800">Total ({bills.length} bills)</td>
                      <td className="py-3 px-4 font-black text-emerald-600 text-right text-base">
                        {fmt(bills.reduce((s, b) => s + b.grandTotal, 0))}
                      </td>
                      <td /><td />
                    </tr>
                  </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── TOP ITEMS TAB ────────────────────────────────────── */}
          {activeTab === 'ITEMS' && (
            <div className="space-y-4">
              {topItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-black text-lg">No item data for this date</p>
                </div>
              ) : (
                topItems.map((item, idx) => {
                  const maxSold = topItems[0]?.totalSold || 1;
                  return (
                    <div key={item.productId} className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 p-4 flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black text-sm text-slate-500 border border-slate-200">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-800 truncate">{item.productName}</p>
                        <div className="mt-1.5 h-2 bg-slate-200/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                            style={{ width: `${pct(item.totalSold, maxSold)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-lg text-slate-800">{item.totalSold}</p>
                        <p className="text-[10px] font-bold text-slate-500">sold</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Return Order Modal */}
      <ReturnOrderModal
        isOpen={!!returnModalData}
        onClose={() => setReturnModalData(null)}
        orderData={returnModalData}
      />
    </div>
  );
};
