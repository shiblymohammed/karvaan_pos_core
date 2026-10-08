import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, Building, Users, Plus, ShieldCheck, ChevronRight, Activity, DollarSign, AlertTriangle, ChevronLeft, Lock, Edit2, RefreshCw, X, ArrowUpRight, Save } from 'lucide-react';
import { toast } from '../store/useToastStore';
import { apiClient } from '../services/apiClient';

// ─── KPI Card ─────────────────────────────────────────────────────────────────
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

export const SuperAdminDashboard: React.FC = () => {
  const { currentUser, logout, lockTerminal } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'RESTAURANTS' | 'OWNERS'>('RESTAURANTS');
  
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modal States
  const [selectedRestaurant, setSelectedRestaurant] = useState<any | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);
  const [isManageOwnerModalOpen, setIsManageOwnerModalOpen] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFormData, setNewFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'RESTAURANTS') {
        const data = await apiClient.get('/tenant/restaurants');
        setRestaurants(data);
      } else {
        const data = await apiClient.get('/tenant/owners');
        setOwners(data);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openManageModal = (rest: any) => {
    setSelectedRestaurant({
      ...rest,
      subscriptionPlan: rest.subscriptionPlan || 'TRIAL',
      subscriptionPrice: rest.subscriptionPrice || 0,
      subscriptionExpiry: rest.subscriptionExpiry ? rest.subscriptionExpiry.split('T')[0] : '',
      subscriptionStatus: rest.subscriptionStatus || 'ACTIVE'
    });
    setIsManageModalOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedRestaurant) return;
    try {
      const res = await apiClient.put(`/tenant/restaurants/${selectedRestaurant.id}/subscription`, selectedRestaurant);
      
      setRestaurants(prev => prev.map(r => r.id === selectedRestaurant.id ? res : r));
      setIsManageModalOpen(false);
    } catch (e) {
      console.error('Failed to update subscription', e);
    }
  };

  const handleOwnerUpdate = async () => {
    setIsSaving(true);
    try {
      const payload: any = {};
      if (newFormData.name) payload.name = newFormData.name;
      if (newFormData.username) payload.username = newFormData.username;
      if (newFormData.password) payload.password = newFormData.password;
      if (newFormData.isActive !== undefined) payload.isActive = newFormData.isActive;
      
      await apiClient.put(`/tenant/owners/${selectedOwner.id}`, payload);
      toast.success('Owner profile updated!');
      setIsManageOwnerModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error updating owner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (activeTab === 'RESTAURANTS') {
        const payload = {
          name: newFormData.name,
          address: newFormData.address,
          phone: newFormData.phone,
          ownerId: newFormData.ownerId,
        };
        await apiClient.post('/tenant/restaurants', payload);
      } else {
        const payload = {
          name: newFormData.name,
          username: newFormData.username,
          password: newFormData.password,
        };
        await apiClient.post('/tenant/owners', payload);
      }
      setIsAddModalOpen(false);
      setNewFormData({});
      fetchData(); // refresh lists
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to create');
      console.error('Failed to create', e);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-carbon-lines text-kv-dark font-sans selection:bg-kv-primary selection:text-white overflow-hidden transition-colors duration-300 p-0 md:py-4 md:pr-4 gap-0 md:gap-4 relative bg-[#0d212b]">
      
      {/* Sidebar Navigation (Hidden on Mobile, Visible on Desktop) */}
      <aside className={`${isSidebarOpen ? 'w-20 md:w-[220px] translate-x-0 opacity-100' : 'w-16 md:w-[64px] translate-x-0 opacity-100'} hidden md:flex bg-transparent flex-col shrink-0 transition-all duration-300 z-30 relative`}>
        {/* Edge Collapse Trigger */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex items-center justify-center h-32 w-5 rounded-r-xl bg-[#0d212b] bg-carbon-lines text-slate-400 hover:bg-[#8cc63f] hover:text-[#0f172a] active:scale-95 transition-all absolute -right-5 top-1/2 -translate-y-1/2 z-50 cursor-pointer drop-shadow-2xl group/notch select-none touch-manipulation"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between md:px-5 shrink-0 border-b border-white/5 relative">
          <div className="flex items-center gap-2 overflow-hidden">
            <img 
              src="/logo/karvaan_logo_main.png" 
              alt="Karvaan POS" 
              className={`h-6 md:h-7 object-contain drop-shadow-sm transition-all duration-300 ${isSidebarOpen ? 'opacity-100 min-w-[120px]' : 'opacity-0 min-w-0 w-0 hidden md:block'}`}
            />
            {!isSidebarOpen && <span className="hidden md:block text-[#8cc63f] font-black text-2xl tracking-tighter w-full text-center">K.</span>}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-visible py-4 px-1.5 md:px-2 flex flex-col gap-2 items-center md:items-stretch relative z-40 overscroll-none touch-pan-y scroll-smooth">
          
          <div className="relative group/navitem w-full flex justify-center">
            <button
              onClick={() => setActiveTab('RESTAURANTS')}
              className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0 hover:scale-[1.15] hover:z-50'} ${activeTab === 'RESTAURANTS' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {activeTab === 'RESTAURANTS' && (
                <div className="absolute inset-0 z-0 rounded-xl bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] shadow-[0_4px_12px_rgba(140,198,63,0.4)] border border-[#8cc63f]/50" />
              )}
              {!activeTab && (
                <div className="absolute inset-0 z-0 rounded-xl bg-transparent group-hover/btn:bg-[#151e32] border border-transparent group-hover/btn:border-white/10 transition-colors duration-300" />
              )}
              <Building className="h-6 w-6 shrink-0 relative z-10" />
              <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Restaurants</span>
            </button>
          </div>

          <div className="relative group/navitem w-full flex justify-center">
            <button
              onClick={() => setActiveTab('OWNERS')}
              className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0 hover:scale-[1.15] hover:z-50'} ${activeTab === 'OWNERS' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {activeTab === 'OWNERS' && (
                <div className="absolute inset-0 z-0 rounded-xl bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] shadow-[0_4px_12px_rgba(140,198,63,0.4)] border border-[#8cc63f]/50" />
              )}
              {!activeTab && (
                <div className="absolute inset-0 z-0 rounded-xl bg-transparent group-hover/btn:bg-[#151e32] border border-transparent group-hover/btn:border-white/10 transition-colors duration-300" />
              )}
              <Users className="h-6 w-6 shrink-0 relative z-10" />
              <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Platform Owners</span>
            </button>
          </div>

          <div className="mt-auto"></div>
          
          <div className="flex flex-col gap-2 pt-4 border-t border-white/5 w-full">
            {/* User Profile Badge */}
            <div className="relative group/navitem w-full flex justify-center mb-2">
              <div className={`relative flex items-center gap-3.5 rounded-xl transition-all duration-300 cursor-default select-none overflow-hidden ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'}`}>
                <div className="h-9 w-9 rounded-full bg-[#151e32] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck className="h-5 w-5 text-[#8cc63f]" />
                </div>
                <div className={`flex-col items-start shrink-0 truncate transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 w-auto flex' : 'opacity-0 w-0 hidden'}`}>
                  <span className="text-sm font-bold text-white leading-tight block truncate">{currentUser?.name}</span>
                  <span className="text-[10px] uppercase font-black text-[#8cc63f] tracking-wide block">{currentUser?.role}</span>
                </div>
              </div>
            </div>

            {/* Lock Button */}
            <div className="relative group/navitem w-full flex justify-center">
              <button onClick={() => lockTerminal()} className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'} text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10`}>
                <Lock className="h-6 w-6 shrink-0 relative z-10" />
                <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Lock Terminal</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="relative group/navitem w-full flex justify-center">
              <button onClick={() => logout()} className={`relative group/btn flex items-center gap-3.5 rounded-xl text-[15px] font-bold transition-all duration-300 ease-out cursor-pointer overflow-hidden select-none touch-manipulation active:scale-95 ${isSidebarOpen ? 'px-3 py-2.5 md:px-3 md:py-2.5 w-full justify-start' : 'w-12 h-12 md:w-12 md:h-12 justify-center shrink-0 p-0'} text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10`}>
                <LogOut className="h-6 w-6 shrink-0 relative z-10" />
                <span className={`whitespace-nowrap relative z-10 transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>Logout</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative md:rounded-[24px] shadow-2xl border-0 md:border md:border-white/10 overflow-hidden h-full z-10 bg-[linear-gradient(135deg,#ecfccb,#ede9fe_35%,#e0f2fe_65%,#ecfccb)] transition-colors duration-300 text-slate-800">
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 xl:px-6 xl:pt-6 xl:pb-6 pb-28 space-y-4 no-scrollbar">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2 sm:mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                {activeTab === 'RESTAURANTS' ? 'Enrolled Restaurants' : 'Platform Owners'}
              </h1>
              <p className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">
                Super Admin Panel
              </p>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto pb-1 -mx-1 px-1">
              <button onClick={() => fetchData()}
                className="p-2 sm:p-2.5 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl hover:bg-white transition-colors cursor-pointer text-slate-500 shadow-sm shrink-0">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => {
                  setNewFormData(activeTab === 'RESTAURANTS' && owners.length > 0 ? { ownerId: owners[0].id } : {});
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 bg-[#b5ef85] hover:bg-[#a2db74] text-[#0d212b] font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer text-xs sm:text-sm border border-[#b5ef85]/50 shrink-0"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" strokeWidth={3} /> <span className="hidden sm:inline">Add</span> {activeTab === 'RESTAURANTS' ? 'Restaurant' : 'Owner'}
              </button>
            </div>
          </div>

          {/* KPI Cards for Restaurants */}
          {activeTab === 'RESTAURANTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-8">
              <KpiCard label="Total Active" value={`${restaurants.filter(r => r.subscriptionStatus === 'ACTIVE').length}`}
                sub="Running on network"
                icon={<Activity className="h-5 w-5 sm:h-6 sm:w-6" />} color="text-emerald-600" />
              <KpiCard label="Monthly MRR" value={`₹${restaurants.reduce((acc, r) => acc + (r.subscriptionPrice || 0), 0)}`}
                sub="Expected revenue"
                icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />} color="text-blue-600" />
              <KpiCard label="Expired / Disabled" value={`${restaurants.filter(r => r.subscriptionStatus !== 'ACTIVE').length}`}
                sub="Accounts locked"
                icon={<AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />} color="text-rose-600" />
            </div>
          )}

          {/* Animated Tabs (Hidden on Desktop because Sidebar has the tabs, visible on mobile) */}
          <div className="md:hidden flex bg-white/70 backdrop-blur-xl rounded-xl p-1 border border-white/60 w-full shadow-sm overflow-x-auto no-scrollbar shrink-0 relative mb-4">
            <button onClick={() => setActiveTab('RESTAURANTS')}
              className={`relative flex-1 px-4 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap z-10 ${
                activeTab === 'RESTAURANTS' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
              }`}>
              {activeTab === 'RESTAURANTS' && (
                <motion.div layoutId="superAdminTabsMobile" className="absolute inset-0 bg-slate-800 rounded-lg shadow-sm -z-10" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              🏢 Restaurants
            </button>
            <button onClick={() => setActiveTab('OWNERS')}
              className={`relative flex-1 px-4 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap z-10 ${
                activeTab === 'OWNERS' ? 'text-white' : 'text-slate-500 hover:text-slate-800'
              }`}>
              {activeTab === 'OWNERS' && (
                <motion.div layoutId="superAdminTabsMobile" className="absolute inset-0 bg-slate-800 rounded-lg shadow-sm -z-10" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              🧑‍💼 Owners
            </button>
          </div>

          {/* Main Table Views */}
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            </div>
          ) : activeTab === 'RESTAURANTS' ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/40 border-b border-white/60 text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold">
                      <th className="p-3 sm:p-4 pl-4 sm:pl-6">Restaurant Info</th>
                      <th className="p-3 sm:p-4">Plan & Pricing</th>
                      <th className="p-3 sm:p-4 hidden sm:table-cell">Expiry</th>
                      <th className="p-3 sm:p-4 text-center">Status</th>
                      <th className="p-3 sm:p-4 text-right pr-4 sm:pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {restaurants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 sm:p-8 text-center text-slate-500 font-medium text-sm sm:text-base">No restaurants found on network.</td>
                      </tr>
                    ) : (
                      restaurants.map((rest) => (
                        <tr key={rest.id} className="hover:bg-white/40 transition-colors">
                          <td className="p-3 sm:p-4 pl-4 sm:pl-6">
                            <div className="font-black text-slate-800 text-sm sm:text-base tracking-tight truncate max-w-[150px] sm:max-w-[250px]">{rest.name}</div>
                            <div className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 truncate max-w-[150px] sm:max-w-[250px]">{rest.owner?.name || 'No Owner'}</div>
                          </td>
                          <td className="p-3 sm:p-4">
                            <div className="font-black text-emerald-600 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                              {rest.subscriptionPlan || 'TRIAL'} 
                              <span className="text-slate-700 bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-mono inline-block w-fit">₹{rest.subscriptionPrice || 0}</span>
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 text-slate-600 font-bold text-xs sm:text-sm hidden sm:table-cell">
                            {rest.subscriptionExpiry ? new Date(rest.subscriptionExpiry).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3 sm:p-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black tracking-widest uppercase ${rest.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {rest.subscriptionStatus || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-3 sm:p-4 text-right pr-4 sm:pr-6">
                            <button 
                              onClick={() => openManageModal(rest)}
                              className="text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white shadow-sm px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all border border-slate-200 active:scale-95 flex items-center gap-1 sm:gap-1.5 ml-auto"
                            >
                              <Edit2 className="h-3 w-3" /> <span className="hidden sm:inline">Manage</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/40 border-b border-white/60 text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold">
                      <th className="p-3 sm:p-4 pl-4 sm:pl-6">Owner Name</th>
                      <th className="p-3 sm:p-4">Username</th>
                      <th className="p-3 sm:p-4 hidden sm:table-cell">Joined Date</th>
                      <th className="p-3 sm:p-4 text-center">Status</th>
                      <th className="p-3 sm:p-4 text-right pr-4 sm:pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {owners.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 sm:p-8 text-center text-slate-500 font-medium text-sm sm:text-base">No owners found.</td>
                      </tr>
                    ) : (
                      owners.map((owner) => (
                        <tr key={owner.id} className="hover:bg-white/40 transition-colors">
                          <td className="p-3 sm:p-4 pl-4 sm:pl-6 font-black text-slate-800 text-sm sm:text-base">{owner.name}</td>
                          <td className="p-3 sm:p-4 font-mono text-slate-600 text-xs sm:text-sm font-bold bg-white/50 px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg inline-block mt-1 sm:mt-3 border border-slate-200">{owner.username}</td>
                          <td className="p-3 sm:p-4 text-slate-600 font-bold text-xs sm:text-sm hidden sm:table-cell">{new Date(owner.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 sm:p-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black tracking-widest uppercase ${owner.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                              {owner.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="p-3 sm:p-4 text-right pr-4 sm:pr-6">
                            <button 
                              onClick={() => {
                                setSelectedOwner(owner);
                                setNewFormData({ name: owner.name, username: owner.username, isActive: owner.isActive });
                                setIsManageOwnerModalOpen(true);
                              }}
                              className="text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white shadow-sm px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all border border-slate-200 active:scale-95 flex items-center gap-1 sm:gap-1.5 ml-auto">
                              <Edit2 className="h-3 w-3" /> <span className="hidden sm:inline">Manage</span>
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
          
          <button
            onClick={() => setActiveTab('RESTAURANTS')}
            className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform"
          >
            {activeTab === 'RESTAURANTS' && (
              <motion.div layoutId="mobileSuperAdminTabs" className="absolute inset-0 bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] rounded-2xl shadow-sm z-0" />
            )}
            <Building className={`h-6 w-6 relative z-10 mb-1 ${activeTab === 'RESTAURANTS' ? 'text-white drop-shadow-sm' : 'text-slate-400'}`} />
            <span className={`text-[10px] font-bold relative z-10 tracking-tight leading-none ${activeTab === 'RESTAURANTS' ? 'text-white' : 'text-slate-400'}`}>Resto</span>
          </button>

          <button
            onClick={() => setActiveTab('OWNERS')}
            className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform"
          >
            {activeTab === 'OWNERS' && (
              <motion.div layoutId="mobileSuperAdminTabs" className="absolute inset-0 bg-gradient-to-br from-[#8cc63f] to-[#6a9a2a] rounded-2xl shadow-sm z-0" />
            )}
            <Users className={`h-6 w-6 relative z-10 mb-1 ${activeTab === 'OWNERS' ? 'text-white drop-shadow-sm' : 'text-slate-400'}`} />
            <span className={`text-[10px] font-bold relative z-10 tracking-tight leading-none ${activeTab === 'OWNERS' ? 'text-white' : 'text-slate-400'}`}>Owners</span>
          </button>

          <div className="w-[1px] h-10 bg-white/10 mx-1"></div>

          <button
            onClick={() => lockTerminal()}
            className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform hover:bg-white/5"
          >
            <Lock className="h-6 w-6 relative z-10 mb-1 text-amber-500" />
            <span className="text-[10px] font-bold relative z-10 tracking-tight leading-none text-amber-500/80">Lock</span>
          </button>

          <button
            onClick={() => logout()}
            className="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-2xl touch-manipulation active:scale-95 transition-transform hover:bg-white/5"
          >
            <LogOut className="h-6 w-6 relative z-10 mb-1 text-rose-500" />
            <span className="text-[10px] font-bold relative z-10 tracking-tight leading-none text-rose-500/80">Logout</span>
          </button>
        </nav>
      </div>

      {/* Glassmorphic Subscription Management Modal */}
      {isManageModalOpen && selectedRestaurant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-3xl border border-white w-full max-w-xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Manage Subscription</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5 sm:mt-1">{selectedRestaurant.name}</p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors bg-slate-50">
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Billing Plan</label>
                  <select 
                    value={selectedRestaurant.subscriptionPlan}
                    onChange={(e) => setSelectedRestaurant({...selectedRestaurant, subscriptionPlan: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                  >
                    <option value="TRIAL">Trial</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="CUSTOM">Custom Pricing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Price / Cycle (₹)</label>
                  <input 
                    type="number"
                    value={selectedRestaurant.subscriptionPrice}
                    onChange={(e) => setSelectedRestaurant({...selectedRestaurant, subscriptionPrice: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-5">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Expiry / Due Date</label>
                  <input 
                    type="date"
                    value={selectedRestaurant.subscriptionExpiry}
                    onChange={(e) => setSelectedRestaurant({...selectedRestaurant, subscriptionExpiry: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Status</label>
                  <select 
                    value={selectedRestaurant.subscriptionStatus}
                    onChange={(e) => setSelectedRestaurant({...selectedRestaurant, subscriptionStatus: e.target.value})}
                    className={`w-full border rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 transition-colors ${
                      selectedRestaurant.subscriptionStatus === 'ACTIVE' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/20' 
                        : 'bg-rose-50 border-rose-200 text-rose-700 focus:ring-rose-500/20'
                    }`}
                  >
                    <option value="ACTIVE" className="bg-white text-slate-800">🟢 Active</option>
                    <option value="EXPIRED" className="bg-white text-slate-800">🔴 Expired</option>
                    <option value="DISABLED" className="bg-white text-slate-800">⚫ Disabled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200/60 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateSubscription}
                className="px-5 py-2 sm:px-6 sm:py-2.5 bg-[#8cc63f] hover:bg-[#7ab036] text-[#0d212b] rounded-lg sm:rounded-xl font-black shadow-[0_4px_12px_rgba(140,198,63,0.3)] active:scale-95 transition-all text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
              >
                Save Changes <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Entity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-3xl border border-white w-full max-w-xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Create {activeTab === 'RESTAURANTS' ? 'Restaurant' : 'Platform Owner'}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5 sm:mt-1">Fill in the details below</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors bg-slate-50">
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {activeTab === 'RESTAURANTS' ? (
                <>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Restaurant Name *</label>
                    <input 
                      type="text"
                      placeholder="e.g. Karvaan Express"
                      value={newFormData.name || ''}
                      onChange={(e) => setNewFormData({...newFormData, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Assign to Owner *</label>
                    <select 
                      value={newFormData.ownerId || ''}
                      onChange={(e) => setNewFormData({...newFormData, ownerId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                    >
                      {owners.length === 0 && <option value="">-- No Owners Exist --</option>}
                      {owners.map(o => <option key={o.id} value={o.id}>{o.name} ({o.username})</option>)}
                    </select>
                    {owners.length === 0 && <p className="text-rose-500 text-[10px] mt-1 font-bold ml-1">You must create an Owner first.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Phone (Optional)</label>
                      <input 
                        type="text"
                        value={newFormData.phone || ''}
                        onChange={(e) => setNewFormData({...newFormData, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">City / Address</label>
                      <input 
                        type="text"
                        value={newFormData.address || ''}
                        onChange={(e) => setNewFormData({...newFormData, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Owner Full Name *</label>
                    <input 
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newFormData.name || ''}
                      onChange={(e) => setNewFormData({...newFormData, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Login Username *</label>
                      <input 
                        type="text"
                        placeholder="john.owner"
                        value={newFormData.username || ''}
                        onChange={(e) => setNewFormData({...newFormData, username: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Password *</label>
                      <input 
                        type="text"
                        placeholder="Secret123"
                        value={newFormData.password || ''}
                        onChange={(e) => setNewFormData({...newFormData, password: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#8cc63f]/30"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-200/60 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={activeTab === 'RESTAURANTS' ? (!newFormData.name || !newFormData.ownerId) : (!newFormData.name || !newFormData.username || !newFormData.password)}
                className="px-5 py-2 sm:px-6 sm:py-2.5 bg-[#8cc63f] hover:bg-[#7ab036] disabled:opacity-50 disabled:cursor-not-allowed text-[#0d212b] rounded-lg sm:rounded-xl font-black shadow-[0_4px_12px_rgba(140,198,63,0.3)] active:scale-95 transition-all text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2"
              >
                Create {activeTab === 'RESTAURANTS' ? 'Restaurant' : 'Owner'} <Plus className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MANAGE OWNER MODAL */}
      {isManageOwnerModalOpen && selectedOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsManageOwnerModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Edit Platform Owner</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedOwner.name}</p>
              </div>
              <button onClick={() => setIsManageOwnerModalOpen(false)} className="p-2 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors border border-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 bg-white">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Owner Name</label>
                  <input type="text" value={newFormData.name || ''} onChange={e => setNewFormData({...newFormData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Username</label>
                  <input type="text" value={newFormData.username || ''} onChange={e => setNewFormData({...newFormData, username: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">New Password (Optional)</label>
                  <input type="password" placeholder="Leave blank to keep current" value={newFormData.password || ''} onChange={e => setNewFormData({...newFormData, password: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1.5">Account Status</label>
                  <select value={newFormData.isActive ? 'active' : 'suspended'} onChange={e => setNewFormData({...newFormData, isActive: e.target.value === 'active'})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setIsManageOwnerModalOpen(false)} className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors border border-slate-200">Cancel</button>
              <button disabled={isSaving} onClick={handleOwnerUpdate} className="flex-1 py-3 bg-[#b5ef85] hover:bg-[#a2db74] disabled:opacity-70 disabled:cursor-not-allowed text-[#0d212b] font-black rounded-xl transition-colors border border-[#b5ef85]/50 flex items-center justify-center gap-2">
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
