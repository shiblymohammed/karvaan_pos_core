import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Users, Receipt, CreditCard, Download, UserCheck } from 'lucide-react';

const HOURLY_SALES_DATA = [
  { time: '10 AM', sales: 4500 },
  { time: '11 AM', sales: 7200 },
  { time: '12 PM', sales: 15400 },
  { time: '1 PM', sales: 22100 },
  { time: '2 PM', sales: 18500 },
  { time: '3 PM', sales: 8400 },
  { time: '4 PM', sales: 6200 },
];

const PAYMENT_METHODS_DATA = [
  { name: 'UPI', value: 45000, color: '#10b981' }, // emerald-500
  { name: 'Card', value: 25000, color: '#3b82f6' }, // blue-500
  { name: 'Cash', value: 12400, color: '#f59e0b' }, // amber-500
];

const TOP_PRODUCTS = [
  { name: 'Hazelnut Cold Coffee', sold: 42, revenue: 9240 },
  { name: 'Margherita Pepperoni Pizza', sold: 38, revenue: 18240 },
  { name: 'Hyderabadi Chicken Biryani', sold: 31, revenue: 11780 },
  { name: 'Smoked Chicken Burger', sold: 28, revenue: 8120 },
];

const WAITER_SALES = [
  { name: 'John Doe', tablesServed: 24, revenue: 21500, avgTurnaround: '45m' },
  { name: 'Sarah Smith', tablesServed: 31, revenue: 32400, avgTurnaround: '38m' },
  { name: 'Alex Johnson', tablesServed: 18, revenue: 15200, avgTurnaround: '52m' },
];

export const AdminDashboard: React.FC = () => {
  const handleExportCSV = () => {
    // Dummy export function
    alert('Exporting SalesData_2026-07-26.csv to your downloads folder...');
  };
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-pos-text">Executive Dashboard</h2>
          <p className="text-sm font-bold text-pos-text-muted mt-1">Real-time store performance and analytics</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-glow-accent transition-transform active:scale-95 cursor-pointer"
        >
          <Download className="h-4 w-4 shrink-0" />
          Export to CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1">Gross Sales (Today)</p>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">₹82,400</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1">Total Orders</p>
            <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400">142</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center border border-blue-500/20">
            <Receipt className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1">Average Order Val</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">₹580</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center border border-amber-500/20">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1">Covers (Guests)</p>
            <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400">312</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center border border-purple-500/20">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm">
          <h3 className="text-lg font-black text-pos-text mb-4">Hourly Sales Velocity</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HOURLY_SALES_DATA}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-pos-border opacity-50" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: 'currentColor' }} className="text-pos-text-muted" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: 'currentColor' }} className="text-pos-text-muted" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--pos-card)', borderColor: 'var(--pos-border)', borderRadius: '12px', fontWeight: 'bold', color: 'var(--pos-text)' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm">
          <h3 className="text-lg font-black text-pos-text mb-4">Tender Breakdown</h3>
          <div className="h-72 w-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PAYMENT_METHODS_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {PAYMENT_METHODS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--pos-card)', borderColor: 'var(--pos-border)', borderRadius: '12px', fontWeight: 'bold', color: 'var(--pos-text)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontWeight: 'bold', fontSize: '12px', color: 'var(--pos-text)' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Grid */}
        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm">
          <h3 className="text-lg font-black text-pos-text mb-4">Top Moving Products</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-pos-border text-xs uppercase tracking-wider text-pos-text-muted">
                  <th className="py-3 px-4 font-black">Item Name</th>
                  <th className="py-3 px-4 font-black">Sold</th>
                  <th className="py-3 px-4 font-black text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {TOP_PRODUCTS.map((prod, idx) => (
                  <tr key={idx} className="border-b border-pos-border/50 hover:bg-pos-card-hover transition-colors">
                    <td className="py-3 px-4 font-bold text-sm text-pos-text">{prod.name}</td>
                    <td className="py-3 px-4 font-bold text-sm text-pos-text">{prod.sold}</td>
                    <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 text-right">₹{prod.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Waiter Performance */}
        <div className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-pos-text">Staff Performance (Waiters)</h3>
            <UserCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-pos-border text-xs uppercase tracking-wider text-pos-text-muted">
                  <th className="py-3 px-4 font-black">Staff Name</th>
                  <th className="py-3 px-4 font-black">Tables</th>
                  <th className="py-3 px-4 font-black text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {WAITER_SALES.map((waiter, idx) => (
                  <tr key={idx} className="border-b border-pos-border/50 hover:bg-pos-card-hover transition-colors">
                    <td className="py-3 px-4 font-bold text-sm text-pos-text flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center text-[10px] font-black uppercase">
                        {waiter.name.charAt(0)}
                      </div>
                      {waiter.name}
                    </td>
                    <td className="py-3 px-4 font-bold text-sm text-pos-text">{waiter.tablesServed}</td>
                    <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 text-right">₹{waiter.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
