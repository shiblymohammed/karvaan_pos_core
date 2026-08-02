import React, { useState, useMemo } from 'react';
import { useTableStore, Floor, DiningTable } from '../../store/useTableStore';
import {
  Plus, Edit3, Trash2, X, ChevronUp, ChevronDown, Save, Map, Columns, LayoutGrid
} from 'lucide-react';

const inputCls = 'w-full px-3 py-2.5 bg-pos-input border border-pos-border rounded-xl text-pos-text text-sm font-bold focus:outline-none focus:border-pos-accent shadow-inner';
const labelCls = 'block text-xs font-bold text-pos-text-muted uppercase tracking-wider mb-1.5';

// --- Floor Form Modal ---
interface FloorFormProps {
  initial?: Partial<Floor>;
  onSave: (data: Omit<Floor, 'id' | 'sortOrder'>) => void;
  onClose: () => void;
  title: string;
}

const FloorForm: React.FC<FloorFormProps> = ({ initial, onSave, onClose, title }) => {
  const [form, setForm] = useState<Partial<Floor>>({
    name: '', zone: 'NON_AC', surchargeType: 'PERCENTAGE', surchargeValue: 0, ...initial
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onSave(form as Omit<Floor, 'id' | 'sortOrder'>);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-pos-border">
          <h3 className="text-xl font-black text-pos-text flex items-center gap-2">
            <Map className="h-5 w-5 text-emerald-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text p-1 rounded-lg hover:bg-pos-card">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Floor Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputCls} placeholder="e.g. 1st Floor AC" />
          </div>
          <div>
            <label className={labelCls}>Zone Type</label>
            <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} className={inputCls}>
              <option value="AC">AC</option>
              <option value="NON_AC">Non-AC</option>
              <option value="OUTDOOR">Outdoor</option>
              <option value="VIP">VIP</option>
              <option value="PARTY_HALL">Party Hall</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Surcharge Type</label>
              <select value={form.surchargeType} onChange={e => setForm({ ...form, surchargeType: e.target.value as any })} className={inputCls}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Value</label>
              <input type="number" min="0" value={form.surchargeValue} onChange={e => setForm({ ...form, surchargeValue: Number(e.target.value) })}
                className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Table Form Modal ---
interface TableFormProps {
  initial?: Partial<DiningTable>;
  floors: Floor[];
  onSave: (data: Omit<DiningTable, 'id' | 'status'>) => void;
  onClose: () => void;
  title: string;
}

const TableForm: React.FC<TableFormProps> = ({ initial, floors, onSave, onClose, title }) => {
  const [form, setForm] = useState<Partial<DiningTable>>({
    number: '', capacity: 4, floorId: floors[0]?.id || '', ...initial
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number || !form.floorId) return;
    onSave(form as Omit<DiningTable, 'id' | 'status'>);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-pos-sidebar w-full max-w-md rounded-2xl border border-pos-border shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-pos-border">
          <h3 className="text-xl font-black text-pos-text flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-blue-500" /> {title}
          </h3>
          <button onClick={onClose} className="text-pos-text-muted hover:text-pos-text p-1 rounded-lg hover:bg-pos-card">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Table Number *</label>
              <input type="text" required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })}
                className={inputCls} placeholder="e.g. T1" />
            </div>
            <div>
              <label className={labelCls}>Capacity</label>
              <input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
                className={inputCls} placeholder="4" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Assign Floor *</label>
            <select value={form.floorId} onChange={e => setForm({ ...form, floorId: e.target.value })} className={inputCls} required>
              {floors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-pos-bg hover:bg-pos-card text-pos-text font-bold rounded-xl border border-pos-border transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminTableManager: React.FC = () => {
  const { floors, tables, addFloor, updateFloor, deleteFloor, reorderFloor, addTable, updateTable, deleteTable } = useTableStore();
  
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  
  const [showTableForm, setShowTableForm] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('ALL');

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.sortOrder - b.sortOrder), [floors]);
  const filteredTables = useMemo(() => {
    return selectedFloorFilter === 'ALL' 
      ? tables 
      : tables.filter(t => t.floorId === selectedFloorFilter);
  }, [tables, selectedFloorFilter]);

  const getZoneBadge = (zone: string) => {
    switch (zone) {
      case 'AC': return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">AC</span>;
      case 'NON_AC': return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">Non-AC</span>;
      case 'OUTDOOR': return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">Outdoor</span>;
      case 'VIP': return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">VIP</span>;
      case 'PARTY_HALL': return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200">Party</span>;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full overflow-y-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-pos-text flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-pos-accent" />
            Tables & Floors Management
          </h2>
          <p className="text-sm font-bold text-pos-text-muted mt-1">Configure layout zones and surcharges</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floors Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-pos-card rounded-2xl border border-pos-border p-4 shadow-sm flex flex-col h-[calc(100vh-160px)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-pos-text flex items-center gap-2"><Map className="h-4 w-4 text-emerald-500"/> Floors</h3>
              <button onClick={() => { setEditingFloor(null); setShowFloorForm(true); }} className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg hover:bg-emerald-500/20 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sortedFloors.map((floor, idx) => (
                <div key={floor.id} className="bg-pos-bg p-3 rounded-xl border border-pos-border flex items-center justify-between group">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-sm text-pos-text">{floor.name}</span>
                    <div className="flex items-center gap-2">
                      {getZoneBadge(floor.zone)}
                      <span className="text-[10px] text-pos-text-muted font-bold">
                        {floor.surchargeValue > 0 ? `+${floor.surchargeValue}${floor.surchargeType === 'PERCENTAGE' ? '%' : '₹'}` : 'No Surcharge'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col">
                      <button onClick={() => reorderFloor(floor.id, 'up')} disabled={idx === 0} className="p-0.5 text-pos-text-muted hover:text-pos-text disabled:opacity-30"><ChevronUp className="h-3 w-3"/></button>
                      <button onClick={() => reorderFloor(floor.id, 'down')} disabled={idx === sortedFloors.length - 1} className="p-0.5 text-pos-text-muted hover:text-pos-text disabled:opacity-30"><ChevronDown className="h-3 w-3"/></button>
                    </div>
                    <button onClick={() => { setEditingFloor(floor); setShowFloorForm(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 className="h-4 w-4"/></button>
                    <button onClick={() => deleteFloor(floor.id)} disabled={sortedFloors.length <= 1} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tables Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-pos-card rounded-2xl border border-pos-border p-4 shadow-sm flex flex-col h-[calc(100vh-160px)]">
            <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
              <h3 className="font-black text-pos-text flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-blue-500"/> Tables</h3>
              
              <div className="flex items-center gap-3">
                <select value={selectedFloorFilter} onChange={(e) => setSelectedFloorFilter(e.target.value)} className="px-3 py-1.5 bg-pos-input border border-pos-border rounded-lg text-xs font-bold text-pos-text">
                  <option value="ALL">All Floors</option>
                  {sortedFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button onClick={() => { setEditingTable(null); setShowTableForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Table
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-pos-text-muted uppercase bg-pos-bg sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-black">No.</th>
                    <th className="py-2 px-3 font-black">Capacity</th>
                    <th className="py-2 px-3 font-black">Floor</th>
                    <th className="py-2 px-3 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTables.map((table) => {
                    const floor = floors.find(f => f.id === table.floorId);
                    return (
                      <tr key={table.id} className="border-b border-pos-border/50 hover:bg-pos-bg group">
                        <td className="py-2 px-3 font-bold text-pos-text">{table.number}</td>
                        <td className="py-2 px-3 text-sm text-pos-text-muted">{table.capacity}</td>
                        <td className="py-2 px-3">
                          <span className="text-xs font-bold text-pos-text">{floor?.name || 'Unknown'}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingTable(table); setShowTableForm(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit3 className="h-4 w-4"/></button>
                            <button onClick={() => deleteTable(table.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="h-4 w-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-pos-text-muted text-sm font-bold">No tables found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showFloorForm && (
        <FloorForm 
          initial={editingFloor || undefined} 
          title={editingFloor ? 'Edit Floor' : 'New Floor'}
          onClose={() => setShowFloorForm(false)}
          onSave={(data) => {
            if (editingFloor) updateFloor(editingFloor.id, data);
            else addFloor(data);
            setShowFloorForm(false);
          }} 
        />
      )}
      
      {showTableForm && (
        <TableForm 
          initial={editingTable || { floorId: selectedFloorFilter !== 'ALL' ? selectedFloorFilter : undefined }} 
          floors={floors}
          title={editingTable ? 'Edit Table' : 'New Table'}
          onClose={() => setShowTableForm(false)}
          onSave={(data) => {
            if (editingTable) updateTable(editingTable.id, data);
            else addTable(data);
            setShowTableForm(false);
          }} 
        />
      )}
    </div>
  );
};
