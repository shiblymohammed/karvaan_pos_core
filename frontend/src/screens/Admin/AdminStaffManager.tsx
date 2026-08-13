import React, { useState } from 'react';
import { Users, Plus, Edit3, Trash2, ShieldCheck, Mail, Phone, X, Check, Bike } from 'lucide-react';
import { useStaffStore, StaffMember } from '../../store/useStaffStore';

export const AdminStaffManager: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff } = useStaffStore();
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    role: 'WAITER' as 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DELIVERY',
    pin: '',
    isActive: true,
    permissions: { canVoid: false, canDiscount: false },
  });

  const handleOpenModal = (s?: StaffMember) => {
    if (s) {
      setEditingStaff(s);
      setFormData({ 
        name: s.name, 
        username: s.username,
        password: s.password || '',
        email: s.email || '',
        phone: s.phone || '',
        role: s.role, 
        pin: s.pin,
        isActive: s.isActive,
        permissions: s.permissions || { canVoid: false, canDiscount: false }
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: '', username: '', password: '', email: '', phone: '', role: 'WAITER', pin: '', isActive: true, permissions: { canVoid: false, canDiscount: false } });
    }
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.username || !formData.password) return;
    
    if (editingStaff) {
      updateStaff(editingStaff.id, formData);
    } else {
      addStaff(formData);
    }
    setShowModal(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-pos-bg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-pos-text">Staff & Waiter Management</h2>
          <p className="text-sm font-bold text-pos-text-muted mt-1">Add, remove, and manage your restaurant staff.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-glow-accent transition-transform active:scale-95 cursor-pointer"
        >
          <Plus className="h-5 w-5 shrink-0" /> Add New Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {staff.map((s) => (
          <div key={s.id} className="bg-pos-card p-5 rounded-2xl border border-pos-border shadow-sm flex flex-col justify-between hover:shadow-glass transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xl border border-emerald-300 uppercase">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-lg text-pos-text leading-tight">{s.name}</h3>
                  <div className="flex flex-col text-xs font-bold text-pos-text-muted mt-0.5">
                    <span>{s.role} • @{s.username}</span>
                    <span className="text-[10px]">PIN: {s.pin} {s.phone ? `• Ph: ${s.phone}` : ''}</span>
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                s.role === 'DELIVERY'
                  ? 'bg-purple-100 text-purple-700 flex items-center gap-1'
                  : s.isActive 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {s.role === 'DELIVERY' ? <><Bike className="h-3 w-3" /> Rider</> : (s.isActive ? 'Active' : 'Inactive')}
              </span>
            </div>

            <div className="flex gap-2 pt-3 border-t border-pos-border">
              <button 
                onClick={() => handleOpenModal(s)}
                className="flex-1 py-1.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold text-xs rounded-lg border border-pos-border transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Profile
              </button>
              <button 
                onClick={() => {
                  if (confirm(`Remove ${s.name}?`)) deleteStaff(s.id);
                }}
                className="px-3 py-1.5 bg-pos-bg hover:bg-rose-50 text-rose-500 font-bold text-xs rounded-lg border border-pos-border transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-pos-border pb-3">
              <h3 className="text-lg font-extrabold text-pos-text">{editingStaff ? 'Edit Staff Member' : 'Add New Staff'}</h3>
              <button onClick={() => setShowModal(false)} className="text-pos-text-muted hover:text-pos-text cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="e.g., johndoe123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Password</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Login Password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Contact (Phone or Email)</label>
                  <input
                    type="text"
                    value={formData.role === 'ADMIN' ? formData.email : formData.phone}
                    onChange={(e) => {
                      if (formData.role === 'ADMIN') setFormData({ ...formData, email: e.target.value });
                      else setFormData({ ...formData, phone: e.target.value });
                    }}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder={formData.role === 'ADMIN' ? 'Email Address' : 'Phone Number'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="WAITER">Waiter</option>
                    <option value="KITCHEN">Kitchen Staff</option>
                    <option value="DELIVERY">🛵 Delivery Rider</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-pos-text-muted mb-1">Login PIN</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-pos-bg border border-pos-border rounded-xl p-3 text-pos-text font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="4 digits"
                  />
                </div>
              </div>

              {(formData.role === 'CASHIER' || formData.role === 'WAITER') && (
                <div className="p-3 bg-pos-bg border border-pos-border rounded-xl space-y-3">
                  <h4 className="font-bold text-sm text-pos-text border-b border-pos-border pb-2">Permissions</h4>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-pos-text-muted">Can Void Items</span>
                    <div className={`w-10 h-5 rounded-full p-1 transition-colors relative ${formData.permissions.canVoid ? 'bg-emerald-500' : 'bg-pos-border'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform absolute top-1 ${formData.permissions.canVoid ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.permissions.canVoid} 
                      onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, canVoid: !formData.permissions.canVoid } })} 
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-pos-text-muted">Can Apply Discounts</span>
                    <div className={`w-10 h-5 rounded-full p-1 transition-colors relative ${formData.permissions.canDiscount ? 'bg-emerald-500' : 'bg-pos-border'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-transform absolute top-1 ${formData.permissions.canDiscount ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.permissions.canDiscount} 
                      onChange={() => setFormData({ ...formData, permissions: { ...formData.permissions, canDiscount: !formData.permissions.canDiscount } })} 
                    />
                  </label>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-pos-bg border border-pos-border rounded-xl">
                <div>
                  <h4 className="font-bold text-sm text-pos-text">Active Status</h4>
                  <p className="text-xs text-pos-text-muted">Is this staff member currently working?</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors relative ${formData.isActive ? 'bg-emerald-500' : 'bg-pos-border'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.username || !formData.password}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-glow-accent transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <Check className="h-5 w-5" /> Save Staff Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
