const fs = require('fs');
let code = fs.readFileSync('src/screens/OwnerDashboard.tsx', 'utf8');

// Add states for edit admin
code = code.replace(
  /const \[adminData, setAdminData\] = useState\(\{ name: '', username: '', password: '' \}\);/,
  `const [adminData, setAdminData] = useState({ name: '', username: '', password: '' });
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);`
);

// Add edit/delete handlers
code = code.replace(
  /const handleCreateAdmin = async \(\) => \{/,
  `const handleEditAdmin = async () => {
    if (!selectedAdmin) return;
    try {
      await apiClient.put(\`/tenant/restaurants/admin/\${selectedAdmin.id}\`, adminData);
      alert('Admin updated successfully!');
      setIsEditAdminOpen(false);
      fetchData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update admin');
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;
    try {
      await apiClient.delete(\`/tenant/restaurants/admin/\${adminId}\`);
      fetchData();
    } catch (e: any) {
      alert('Failed to delete admin');
    }
  };

  const handleCreateAdmin = async () => {`
);

// Modify the table cell to show admins and edit buttons
code = code.replace(
  /<td className="p-3 sm:p-4 text-right pr-4 sm:pr-6">\s*<button\s*onClick=\{[^}]+\}\s*className="[^"]+"\s*>\s*<UserPlus className="[^"]+" \/> Create Admin\s*<\/button>\s*<\/td>/,
  `<td className="p-3 sm:p-4 pr-4 sm:pr-6">
    <div className="flex flex-col gap-2 items-end">
      {rest.users && rest.users.length > 0 ? (
        rest.users.map((u: any) => (
          <div key={u.id} className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-lg border border-slate-200/50">
            <span className="text-[10px] font-bold text-slate-700">{u.name} ({u.username})</span>
            <button onClick={() => { setSelectedAdmin(u); setAdminData({ name: u.name, username: u.username, password: '' }); setIsEditAdminOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-1"><Activity className="h-3 w-3" /></button>
            <button onClick={() => handleDeleteAdmin(u.id)} className="text-rose-600 hover:text-rose-800 p-1"><X className="h-3 w-3" /></button>
          </div>
        ))
      ) : (
        <span className="text-[10px] text-slate-400 font-medium">No Admins</span>
      )}
      <button 
        onClick={() => { setSelectedRestaurant(rest); setIsAddAdminOpen(true); }}
        className="text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white shadow-sm px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs transition-all border border-slate-200 active:scale-95 flex items-center gap-1.5 whitespace-nowrap mt-1"
      >
        <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500" /> Add Admin
      </button>
    </div>
  </td>`
);

// Add the Edit Admin Modal at the bottom
code = code.replace(
  /\{\/\* Create Admin Modal \*\/\}/,
  `{/* Edit Admin Modal */}
      {isEditAdminOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-3xl border border-white w-full max-w-xl rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-slate-200/60 flex justify-between items-center bg-white/50">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">Edit Store Admin</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5 sm:mt-1">{selectedAdmin.username}</p>
              </div>
              <button onClick={() => setIsEditAdminOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors bg-slate-50">
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
              <div>
                <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">New Password (Optional)</label>
                <input 
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={adminData.password}
                  onChange={(e) => setAdminData({...adminData, password: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-slate-200/60 bg-slate-50/50 flex gap-3">
              <button onClick={() => setIsEditAdminOpen(false)} className="flex-1 py-3 sm:py-3.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl transition-colors border border-slate-200">Cancel</button>
              <button onClick={handleEditAdmin} className="flex-1 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl transition-colors shadow-md shadow-indigo-200 flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" /> Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Admin Modal */}`
);

fs.writeFileSync('src/screens/OwnerDashboard.tsx', code);
console.log('OwnerDashboard patched!');
