import React, { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, ChevronRight, CheckCircle2, Receipt, MapPin, User, Clock, CreditCard, Banknote, QrCode } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { toast } from '../../store/useToastStore';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePickerPopover } from '../../components/DatePickerPopover';

export const AdminOrderHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/billing/history?startDate=${startDate}&endDate=${endDate}`);
      setHistory(res);
    } catch (err: any) {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate]);

  const filteredHistory = history.filter(h => 
    h.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.order?.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.customerPhone?.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 lg:p-8 overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 w-full">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 flex items-center gap-3">
            <Receipt className="h-8 w-8 text-indigo-500" />
            Order History
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Deep dive into past transactions, bills, and order details.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl shadow-sm border border-slate-200">
            <DatePickerPopover 
              date={startDate} 
              onChange={setStartDate} 
              maxDate={new Date().toISOString().split('T')[0]} 
            />
            <span className="text-slate-400 font-bold text-xs uppercase">to</span>
            <DatePickerPopover 
              date={endDate} 
              onChange={setEndDate} 
              maxDate={new Date().toISOString().split('T')[0]} 
            />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Bill, Order, Customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden w-full flex-1 flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider hidden sm:grid">
          <div className="col-span-2">Bill / Order</div>
          <div className="col-span-3">Time & Details</div>
          <div className="col-span-2">Customer</div>
          <div className="col-span-2">Payment</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 font-medium">Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Receipt className="h-10 w-10 mb-3 opacity-20" />
              <p className="font-medium">No orders found for this date range.</p>
            </div>
          ) : (
            filteredHistory.map((bill) => (
              <div key={bill.id} className="mb-2 w-full">
                <div 
                  onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                  className={`flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer transition-all border ${expandedId === bill.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}`}
                >
                  {/* Top Row on Mobile: Bill # and Total */}
                  <div className="flex justify-between items-center sm:contents">
                    <div className="col-span-1 sm:col-span-2 flex flex-col justify-center">
                      <span className="font-black text-slate-800 text-sm sm:text-base">{bill.billNumber}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{bill.order?.orderNumber}</span>
                    </div>
                    
                    <div className="flex sm:hidden items-center gap-2">
                      <span className="text-sm font-black text-slate-800">₹{bill.grandTotal.toLocaleString('en-IN')}</span>
                      {expandedId === bill.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>
                  
                  {/* Second Row on Mobile: Time/Staff and Payment Badge */}
                  <div className="flex justify-between items-center sm:contents">
                    <div className="col-span-1 sm:col-span-3 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-slate-600 text-xs sm:text-sm font-bold">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {new Date(bill.settledAt).toLocaleString('en-IN', { hour: 'numeric', minute: 'numeric', day: '2-digit', month: 'short' })}
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-500">
                        <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {bill.order?.waiter?.name || 'Self'} • {bill.orderType}
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 flex items-center justify-end sm:justify-start">
                      <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black ${
                        bill.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-700' :
                        bill.paymentMethod === 'UPI' ? 'bg-purple-100 text-purple-700' :
                        bill.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {bill.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="col-span-1 sm:col-span-2 flex flex-col justify-center mt-1 sm:mt-0">
                    {bill.customerName ? (
                      <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 truncate">{bill.customerName}</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">{bill.customerPhone}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 italic">Walk-in Customer</span>
                    )}
                  </div>

                  {/* Desktop Only: Total & Chevron */}
                  <div className="hidden sm:flex col-span-1 sm:col-span-2 items-center justify-end">
                    <span className="text-lg font-black text-slate-800">₹{bill.grandTotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="hidden sm:flex col-span-1 sm:col-span-1 items-center justify-end text-slate-400">
                    {expandedId === bill.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedId === bill.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 sm:p-6 mx-4 mb-4 bg-white border border-t-0 border-indigo-100 rounded-b-2xl shadow-inner text-sm">
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {/* Items List */}
                          <div className="md:col-span-2">
                            <h3 className="font-black text-slate-800 mb-3 uppercase text-xs tracking-wider border-b border-slate-100 pb-2">Order Items</h3>
                            <div className="space-y-2">
                              {bill.order?.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-start border-b border-dashed border-slate-100 pb-2">
                                  <div className="flex-1">
                                    <p className="font-bold text-slate-700">{item.quantity} x {item.product?.name}</p>
                                    {item.notes && <p className="text-xs text-amber-600 font-medium mt-0.5">Note: {item.notes}</p>}
                                  </div>
                                  <div className="font-black text-slate-600">₹{(item.price * item.quantity).toLocaleString('en-IN')}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Order Summary & Meta */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider border-b border-slate-200 pb-2">Bill Summary</h3>
                            
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Subtotal</span>
                              <span>₹{bill.subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            {(bill.cgst > 0 || bill.sgst > 0) && (
                              <div className="flex justify-between text-slate-500 font-medium">
                                <span>Taxes (GST)</span>
                                <span>₹{(bill.cgst + bill.sgst).toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            {bill.discount > 0 && (
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>Discount</span>
                                <span>-₹{bill.discount.toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-slate-800 font-black text-lg pt-2 border-t border-slate-200">
                              <span>Total Paid</span>
                              <span>₹{bill.grandTotal.toLocaleString('en-IN')}</span>
                            </div>
                            
                            <div className="mt-4 space-y-1.5 text-xs font-medium text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                              <p className="flex justify-between"><span>Cashier:</span> <span className="font-bold text-slate-700">{bill.cashier?.name || 'Unknown'}</span></p>
                              {bill.order?.table && <p className="flex justify-between"><span>Table:</span> <span className="font-bold text-slate-700">{bill.order.table.tableNumber}</span></p>}
                              <p className="flex justify-between"><span>Order Type:</span> <span className="font-bold text-slate-700">{bill.orderType}</span></p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
