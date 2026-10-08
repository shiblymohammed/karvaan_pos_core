import React, { useState } from 'react';
import { Users, Plus, Edit3, Trash2, ShieldCheck, X, Bike, Key, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useStaffStore, StaffMember } from '../../store/useStaffStore';
import CustomSelect from '../../components/shared/CustomSelect';
import { ConfirmModal } from '../../components/shared/ConfirmModal';

const inputCls = 'w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold focus:outline-none focus:border-[#8cc63f] focus:ring-4 focus:ring-[#8cc63f]/20 shadow-sm transition-all';
const labelCls = 'block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2';

export const AdminStaffManager: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff } = useStaffStore();
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const passwordMismatch = confirmPassword.length > 0 && formData.password !== confirmPassword;
  const canSave = !!(formData.name && formData.username && formData.password && formData.password === confirmPassword);

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
      setConfirmPassword(s.password || '');
    } else {
      setEditingStaff(null);
      setFormData({ name: '', username: '', password: '', email: '', phone: '', role: 'WAITER', pin: '', isActive: true, permissions: { canVoid: false, canDiscount: false } });
      setConfirmPassword('');
    }
    setShowPassword(false);
    setShowConfirm(false);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!canSave) return;
    if (editingStaff) {
      updateStaff(editingStaff.id, formData);
    } else {
      addStaff(formData);
    }
    setShowModal(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* ─── FAB ────────────────────────────────────────────── */}
      <div className="fixed sm:static bottom-[90px] right-6 sm:bottom-auto sm:right-auto z-40 flex justify-end pointer-events-none sm:px-10 sm:pt-6 pb-2">
        <button
          onClick={() => handleOpenModal()}
          className="px-5 py-3.5 sm:py-2.5 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] hover:opacity-90 text-[#0f172a] font-black rounded-full sm:rounded-[14px] shadow-xl sm:shadow-md shadow-[#8cc63f]/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto shrink-0"
        >
          <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Staff</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 sm:px-10 pt-4 sm:pt-0 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 lg:grid-cols-3 gap-4">
          {staff.map((s) => (
            <div key={s.id} className="bg-white/60 backdrop-blur-xl p-4 rounded-3xl border border-white/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(s)} className="p-2 bg-white/50 backdrop-blur-md hover:bg-amber-100 text-slate-500 hover:text-amber-600 rounded-lg shadow-sm transition-colors border border-white/40 cursor-pointer"><Edit3 className="h-4 w-4"/></button>
                <button onClick={() => deleteStaff(s.id)} className="p-2 bg-white/50 backdrop-blur-md hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-lg shadow-sm transition-colors border border-white/40 cursor-pointer"><Trash2 className="h-4 w-4"/></button>
              </div>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#8cc63f] to-[#6da12c] text-white flex items-center justify-center font-black text-xl shadow-inner shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="pt-0.5">
                  <h3 className="font-black text-base text-slate-900 leading-tight pr-8">{s.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0f172a] bg-[#8cc63f]/20 px-2 py-0.5 rounded-md border border-[#8cc63f]/30">{s.role}</span>
                    <span className="text-[10px] font-bold text-slate-400">@{s.username}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/40">
                <div className="flex flex-col gap-0.5">
                  {s.pin && (
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Key className="h-3 w-3" /> PIN: <span className="font-black text-slate-800">{s.pin}</span>
                    </span>
                  )}
                  {s.phone && <span className="text-[10px] font-bold text-slate-400">{s.phone}</span>}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm border ${
                  s.role === 'DELIVERY'
                    ? 'bg-purple-100/50 text-purple-700 border-purple-200 flex items-center gap-1'
                    : s.isActive
                    ? 'bg-blue-100/50 text-blue-700 border-blue-200'
                    : 'bg-rose-100/50 text-rose-700 border-rose-200'
                }`}>
                  {s.role === 'DELIVERY' ? <><Bike className="h-3 w-3" /> Rider</> : (s.isActive ? 'Active' : 'Inactive')}
                </span>
              </div>
            </div>
          ))}

          {/* Add Staff Card CTA */}
          <button onClick={() => handleOpenModal()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border-2 border-dashed border-white/60 bg-white/30 text-slate-400 hover:text-[#0f172a] hover:border-[#8cc63f]/50 hover:bg-[#8cc63f]/10 transition-all cursor-pointer min-h-[140px] shadow-sm">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-xl shadow-sm border border-white/40"><Plus className="h-5 w-5" /></div>
            <span className="text-xs font-black uppercase tracking-wider">Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* ─── Staff Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] border border-white shadow-2xl max-h-[92vh] flex flex-col">

            {/* Header — not sticky, just a simple top section */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200/60">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-[#8cc63f]/15 rounded-xl">
                  <ShieldCheck className="h-5 w-5 text-[#6da12c]" />
                </div>
                {editingStaff ? 'Edit Staff Profile' : 'New Staff Member'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* Name & Username */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls} placeholder="e.g., John Doe" />
                </div>
                <div>
                  <label className={labelCls}>Username *</label>
                  <input type="text" required value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={inputCls} placeholder="e.g., johndoe" />
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Password *</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`${inputCls} pr-10`} placeholder="Password" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirm Password *</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputCls} pr-10 ${passwordMismatch ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                      placeholder="Confirm" />
                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mismatch warning */}
              {passwordMismatch && (
                <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" /> Passwords do not match
                </div>
              )}

              {/* Contact */}
              <div>
                <label className={labelCls}>{formData.role === 'ADMIN' ? 'Email' : 'Phone'}</label>
                <input type="text"
                  value={formData.role === 'ADMIN' ? formData.email : formData.phone}
                  onChange={(e) => {
                    if (formData.role === 'ADMIN') setFormData({ ...formData, email: e.target.value });
                    else setFormData({ ...formData, phone: e.target.value });
                  }}
                  className={inputCls}
                  placeholder={formData.role === 'ADMIN' ? 'Email Address' : 'Phone Number'} />
              </div>

              {/* Role & PIN */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-5">
                <div>
                  <label className={labelCls}>Assigned Role</label>
                  <CustomSelect
                    value={formData.role || 'WAITER'}
                    onChange={val => setFormData({ ...formData, role: val as any })}
                    options={[
                      { value: 'ADMIN', label: 'Admin' },
                      { value: 'MANAGER', label: 'Manager' },
                      { value: 'CASHIER', label: 'Cashier' },
                      { value: 'WAITER', label: 'Waiter' },
                      { value: 'KITCHEN', label: 'Kitchen Staff' },
                      { value: 'DELIVERY', label: 'Delivery Rider' }
                    ]}
                  />
                </div>
                <div>
                  <label className={labelCls}>Quick PIN (4-digit)</label>
                  <input type="text" maxLength={4} value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    className={`${inputCls} text-center tracking-[0.5em] text-xl`}
                    placeholder="••••" />
                </div>
              </div>

              {/* Permissions */}
              {(formData.role === 'CASHIER' || formData.role === 'WAITER') && (
                <div className="p-4 bg-slate-50/80 border border-slate-200/60 rounded-2xl space-y-4">
                  <h4 className="font-black text-[11px] uppercase tracking-widest text-slate-500">Till Permissions</h4>
                  {[
                    { key: 'canVoid', label: 'Can Void Items' },
                    { key: 'canDiscount', label: 'Can Apply Discounts' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm font-bold text-slate-700 group-hover:text-[#8cc63f] transition-colors">{label}</span>
                      <div
                        className={`w-12 h-6 rounded-full p-1 transition-colors relative shadow-inner ${(formData.permissions as any)[key] ? 'bg-gradient-to-r from-[#8cc63f] to-[#b5ef85]' : 'bg-slate-200'}`}
                        onClick={() => setFormData({ ...formData, permissions: { ...formData.permissions, [key]: !(formData.permissions as any)[key] } })}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform absolute top-1 shadow-sm ${(formData.permissions as any)[key] ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50/80 border border-slate-200/60 rounded-2xl cursor-pointer hover:bg-white transition-colors"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}>
                <div>
                  <h4 className="font-black text-sm text-slate-800">Account Active</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Can log into POS?</p>
                </div>
                <div className={`w-14 h-7 rounded-full p-1 transition-colors relative shadow-inner ${formData.isActive ? 'bg-gradient-to-r from-[#8cc63f] to-[#b5ef85]' : 'bg-slate-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform absolute top-1 shadow-sm ${formData.isActive ? 'translate-x-7' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3 border-t border-slate-200/60">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors shadow-sm cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={!canSave}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-[#8cc63f] to-[#b5ef85] hover:opacity-90 disabled:opacity-40 text-[#0f172a] font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed">
                  <Save className="h-4 w-4" /> {editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};
