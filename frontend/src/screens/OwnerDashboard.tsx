import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, Building, ShieldCheck, ChevronRight, Activity, ChevronLeft, Lock, Plus, UserPlus, X } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const KpiCard: React.FC<{
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}> = ({ label, value, sub, icon, color }) => (
  <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg hover:border-white transition-all flex items-center justify-between">
    <div>
      <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <h3 className={`text-xl sm:text-2xl font-black ${color}`}>{value}</h3>
      {sub && <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5">{sub}</p>}
    </div>
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border ${color.replace('text-', 'bg-').replace('-600', '-50/80').replace('-400', '-950/40')} border-current/20`}>
      {icon}
    </div>
  </div>
);

export const OwnerDashboard: React.FC = () => {
  const { currentUser, logout, lockTerminal } = useAuthStore();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Add Admin Modal State
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [adminData, setAdminData] = useState({ name: '', username: '', password: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get('/tenant/restaurants');
      setRestaurants(data);
    } catch (err) {
      console.error('Failed to fetch restaurants', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!selectedRestaurant) return;
    try {
      await apiClient.post(`/tenant/restaurants/${selectedRestaurant.id}/admin`, adminData);
      alert('Restaurant Admin Account Created Successfully!\n\nYou can now log in using this account to set up staff and use the POS.');
      setIsAddAdminOpen(false);
      setAdminData({ name: '', username: '', password: '' });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create admin');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-carbon-lines text-kv-dark font-sans selection:bg-kv-primary selection:text-white overflow-hidden transition-colors duration-300 p-0 md:py-4 md:pr-4 gap-0 md:gap-4 relative bg-[#0d212b]">
      
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-20 md:w-[220px] translate-x-0 opacity-100' : 'w-16 md:w-[64px] translate-x-0 opacity-100'} hidden md:flex bg-transparent flex-col shrink-0 transition-all duration-300 z-30 relative`}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex items-center justify-center h-32 w-5 rounded-r-xl bg-[#0d212b] bg-carbon-lines text-slate-400 hover:bg-[#8cc63f] hover:text-[#0f172a] active:scale-95 transition-all absolute -right-5 top-1/2 -translate-y-1/2 z-50 cursor-pointer drop-shadow-2xl select-none"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <div className="h-16 flex items-center justify-between md:px-5 shrink-0 border-b border-white/5 relative">
          <div className="flex items-center gap-2 overflow-hidden">
            <img 
              src="/logo/karvaan_logo_main.png" 
              alt="Karvaan" 
              className={`h-6 md:h-7 object-contain drop-shadow-sm transition-all duration-300 ${isSidebarOpen ? 'opacity-100 min-w-[120px]' : 'opacity-0 min-w-0 w-0 hidden md:block'}`}
            />
            {!isSidebarOpen && <span className="hidden md:block text-[#8cc63f] font-black text-2xl tracking-tighter w-full text-center">K.</span>}
          </div>
        </div>

        <nav className="flex-1 overflow-visible py-4 px-1.5 md:px-2 flex flex-col gap-2 items-center md:items-stretch relative z-40">
          <div className="relative group/navitem w-full flex justify-center">
            <button
              className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 justify-center shrink-0 p-0'} text-white`}
            >
              <div className="absolute inset-0 z-0 rounded-xl bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] shadow-[0_4px_12px_rgba(140,198,63,0.4)] border border-[#8cc63f]/50" />
              <Building className="h-6 w-6 shrink-0 relative z-10" />
              <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>My Restaurants</span>
            </button>
          </div>

          <div className="mt-auto"></div>
          
          <div className="flex flex-col gap-2 pt-4 border-t border-white/5 w-full">
            <div className="relative group/navitem w-full flex justify-center mb-2">
              <div className={`relative flex items-center gap-3.5 rounded-xl transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 justify-center shrink-0 p-0'}`}>
                <div className="h-9 w-9 rounded-full bg-[#151e32] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="h-5 w-5 text-[#8cc63f]" />
                </div>
                <div className={`flex-col items-start shrink-0 truncate transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 w-auto flex' : 'opacity-0 w-0 hidden'}`}>
                  <span className="text-sm font-bold text-white block truncate">{currentUser?.name}</span>
                  <span className="text-[10px] uppercase font-black text-[#8cc63f] tracking-wide block">Owner</span>
                </div>
              </div>
            </div>

            <button onClick={() => lockTerminal()} className={`relative flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 w-full justify-start' : 'w-12 h-12 justify-center shrink-0 p-0'} text-amber-500/80 hover:bg-amber-500/10`}>
              <Lock className="h-6 w-6 shrink-0 relative z-10" />
              <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Lock Terminal</span>
            </button>

            <button onClick={() => logout()} className={`relative flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 w-full justify-start' : 'w-12 h-12 justify-center shrink-0 p-0'} text-rose-500/80 hover:bg-rose-500/10`}>
              <LogOut className="h-6 w-6 shrink-0 relative z-10" />
              <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative md:rounded-[24px] shadow-2xl border-0 md:border md:border-white/10 overflow-hidden h-full z-10 bg-[linear-gradient(135deg,#e0e7ff,#ede9fe_35%,#e0f2fe_65%,#f0fdf4)] transition-colors duration-300 text-slate-800">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 xl:px-8 xl:pt-8 xl:pb-8 pb-28 space-y-4 no-scrollbar">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-800 tracking-tight">My Restaurants</h1>
              <p className="text-[11px] sm:text-xs md:text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">Restaurant Owner Portal</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
            <KpiCard label="Total Restaurants" value={`${restaurants.length}`} sub="On your account" icon={<Building className="h-6 w-6" />} color="text-indigo-600" />
            <KpiCard label="Active Licenses" value={`${restaurants.filter(r => r.subscriptionStatus === 'ACTIVE').length}`} sub="Currently running" icon={<Activity className="h-6 w-6" />} color="text-emerald-600" />
          </div>

          {/* Main Table Views */}
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/40 border-b border-white/60 text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold">
                      <th className="p-3 sm:p-4 pl-4 sm:pl-6">Restaurant Name</th>
                      <th className="p-3 sm:p-4">Location</th>
                      <th className="p-3 sm:p-4">Subscription Plan</th>
                      <th className="p-3 sm:p-4 text-center">Status</th>
                      <th className="p-3 sm:p-4 text-right pr-4 sm:pr-6">Admin Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {restaurants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 sm:p-8 text-center text-slate-500 font-medium text-sm sm:text-base">No restaurants assigned to your account. Please contact Karvaan support to add a restaurant.</td>
                      </tr>
                    ) : (
                      restaurants.map((rest) => (
                        <tr key={rest.id} className="hover:bg-white/40 transition-colors">
                          <td className="p-3 sm:p-4 pl-4 sm:pl-6">
                            <div className="font-black text-slate-800 text-sm sm:text-base tracking-tight">{rest.name}</div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="text-xs font-bold text-slate-500">{rest.address || 'N/A'}</div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="font-black text-indigo-600 flex flex-col gap-1 text-xs sm:text-sm">
                              {rest.subscriptionPlan || 'TRIAL'} 
                              <span className="text-slate-500 text-[9px] sm:text-[10px]">Expires: {rest.subscriptionExpiry ? new Date(rest.subscriptionExpiry).toLocaleDateString() : 'Never'}</span>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black tracking-widest uppercase ${rest.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {rest.subscriptionStatus || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-3 sm:p-4 text-right pr-4 sm:pr-6">
                            <button 
                              onClick={() => { setSelectedRestaurant(rest); setIsAddAdminOpen(true); }}
                              className="text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white shadow-sm px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all border border-slate-200 active:scale-95 flex items-center gap-1.5 ml-auto whitespace-nowrap"
                            >
                              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500" /> Create Admin
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 p-3 z-30 pointer-events-none transition-all duration-500`}>
        <nav className="flex items-center justify-around bg-[#0d212b]/90 backdrop-blur-3xl pb-safe pt-2 pb-2 px-2 rounded-[28px] border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto">
          <button className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform">
            <motion.div layoutId="mobileOwnerTabs" className="absolute inset-0 bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] rounded-2xl shadow-sm z-0" />
            <Building className="h-6 w-6 relative z-10 mb-1 text-white drop-shadow-sm" />
            <span className="text-[10px] font-bold relative z-10 tracking-tight leading-none text-white">Restaurants</span>
          </button>
          <div className="w-[1px] h-10 bg-white/10 mx-1"></div>
          <button onClick={() => lockTerminal()} className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform hover:bg-white/5">
            <Lock className="h-6 w-6 relative z-10 mb-1 text-amber-500" />
            <span className="text-[10px] font-bold relative z-10 tracking-tight leading-none text-amber-500/80">Lock</span>
          </button>
          <button onClick={() => logout()} className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform hover:bg-white/5">
            <LogOut className="h-6 w-6 relative z-10 mb-1 text-rose-500" />
            <span className="text-[10px] font-bold relative z-10 tracking-tight leading-none text-rose-500/80">Logout</span>
          </button>
        </nav>
      </div>

      {/* Create Admin Modal */}
      {isAddAdminOpen && selectedRestaurant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-3xl border border-white w-full max-w-xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Create Store Admin</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5 sm:mt-1">For {selectedRestaurant.name}</p>
              </div>
              <button onClick={() => setIsAddAdminOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors bg-slate-50">
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div>
                <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Admin Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. John Manager"
                  value={adminData.name}
                  onChange={(e) => setAdminData({...adminData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Login Username</label>
                  <input 
                    type="text"
                    placeholder="john.admin"
                    value={adminData.username}
                    onChange={(e) => setAdminData({...adminData, username: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <input 
                    type="text"
                    placeholder="Secret123"
                    value={adminData.password}
                    onChange={(e) => setAdminData({...adminData, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
              
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-3 mt-4">
                <ShieldCheck className="w-8 h-8 text-indigo-500 shrink-0" />
                <p className="text-xs text-indigo-800 font-medium">This admin account will have full access to {selectedRestaurant.name}, including POS, Inventory, and Staff management.</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200/60 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddAdminOpen(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateAdmin}
                disabled={!adminData.name || !adminData.username || !adminData.password}
                className="px-5 py-2 sm:px-6 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg sm:rounded-xl font-black shadow-[0_4px_12px_rgba(79,70,229,0.3)] active:scale-95 transition-all text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
              >
                Create Admin <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
