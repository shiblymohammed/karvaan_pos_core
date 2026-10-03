import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTableStore, Floor, DiningTable } from '../../store/useTableStore';
import CustomSelect from '../../components/shared/CustomSelect';
import {
  Plus, Edit3, Trash2, X, ChevronUp, ChevronDown, Save, Map, LayoutGrid, Users, ArrowLeft,
  AlertCircle
} from 'lucide-react';

const inputCls = 'w-full px-4 py-3 bg-white/60 border border-slate-200/80 rounded-2xl text-slate-700 text-sm font-bold focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 shadow-sm transition-all';
const labelCls = 'block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2';

type Tab = 'tables' | 'floors';

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[32px] border border-white shadow-2xl">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200/60 sticky top-0 bg-white/80 backdrop-blur-xl z-10 rounded-t-[32px]">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-emerald-100 rounded-xl"><Map className="h-5 w-5 text-emerald-600" /></div> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Floor Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputCls} placeholder="e.g. 1st Floor AC" />
          </div>
          <div>
            <label className={labelCls}>Zone Type</label>
            <CustomSelect
              value={form.zone || 'NON_AC'}
              onChange={val => setForm({ ...form, zone: val })}
              options={[
                { value: 'AC', label: 'AC' },
                { value: 'NON_AC', label: 'Non-AC' },
                { value: 'OUTDOOR', label: 'Outdoor' },
                { value: 'VIP', label: 'VIP' },
                { value: 'PARTY_HALL', label: 'Party Hall' }
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Surcharge</label>
              <CustomSelect
                value={form.surchargeType || 'PERCENTAGE'}
                onChange={val => setForm({ ...form, surchargeType: val as any })}
                options={[
                  { value: 'PERCENTAGE', label: 'Percent (%)' },
                  { value: 'FIXED', label: 'Fixed (₹)' }
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Value</label>
              <input type="number" min="0" value={form.surchargeValue === 0 ? '' : form.surchargeValue} onChange={e => setForm({ ...form, surchargeValue: e.target.value === '' ? 0 : Number(e.target.value) })}
                className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} placeholder="0" />
            </div>
          </div>
          <div className="pt-6 mt-2 flex gap-3 border-t border-slate-200/60">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors shadow-sm">Cancel</button>
            <button type="submit" className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md shadow-emerald-200 transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save Floor
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[32px] border border-white shadow-2xl">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200/60 sticky top-0 bg-white/80 backdrop-blur-xl z-10 rounded-t-[32px]">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-blue-100 rounded-xl"><LayoutGrid className="h-5 w-5 text-blue-600" /></div> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Table No. *</label>
              <input type="text" required value={form.number} onChange={e => setForm({ ...form, number: e.target.value })}
                className={inputCls} placeholder="e.g. T1" />
            </div>
            <div>
              <label className={labelCls}>Capacity</label>
              <input type="number" min="1" value={form.capacity === 0 ? '' : form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value === '' ? 0 : Number(e.target.value) })}
                className={`${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} placeholder="4" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Assign Floor *</label>
            <CustomSelect
              value={form.floorId || (floors[0]?.id ?? '')}
              onChange={val => setForm({ ...form, floorId: val })}
              options={floors.map(f => ({ value: f.id, label: f.name }))}
            />
          </div>
          <div className="pt-6 mt-2 flex gap-3 border-t border-slate-200/60">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors shadow-sm">Cancel</button>
            <button type="submit" className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-md shadow-blue-200 transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Save className="h-4 w-4" /> Save Table
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminTableManager: React.FC = () => {
  const { floors, tables, addFloor, updateFloor, deleteFloor, reorderFloor, addTable, updateTable, deleteTable } = useTableStore();
  
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  
  const [showTableForm, setShowTableForm] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('ALL');

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'floor' | 'table', id: string, name: string } | null>(null);

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.sortOrder - b.sortOrder), [floors]);
  const filteredTables = useMemo(() => {
    return selectedFloorFilter === 'ALL' 
      ? tables 
      : tables.filter(t => t.floorId === selectedFloorFilter);
  }, [tables, selectedFloorFilter]);

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'floor') deleteFloor(deleteConfirm.id);
    else deleteTable(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const getZoneBadge = (zone: string) => {
    switch (zone) {
      case 'AC': return <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider border border-blue-200 shadow-sm">AC</span>;
      case 'NON_AC': return <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wider border border-slate-200 shadow-sm">Non-AC</span>;
      case 'OUTDOOR': return <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-200 shadow-sm">Outdoor</span>;
      case 'VIP': return <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider border border-amber-200 shadow-sm">VIP</span>;
      case 'PARTY_HALL': return <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-wider border border-purple-200 shadow-sm">Party</span>;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-0 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          {/* Tabs */}
          <div className="flex gap-2 w-full sm:w-fit overflow-x-auto hide-scrollbar">
            {([['tables', 'Dining Tables', LayoutGrid], ['floors', 'Floor Zones', Map]] as const).map(([id, label, Icon]) => {
              const isActive = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id as Tab)}
                  className={`relative flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-black transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'bg-white/50 text-slate-600 border border-white/60 hover:bg-white/80'
                  }`}>
                  {isActive && (
                    <motion.div
                      layoutId="tableTabs"
                      className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-md z-0"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={`h-4 w-4 relative z-10 ${isActive ? 'text-white' : 'text-slate-500'}`} /> 
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Floating Action Buttons on Mobile, Inline on Desktop */}
          <div className="fixed sm:static bottom-[90px] right-6 sm:bottom-auto sm:right-auto z-40 flex flex-col sm:flex-row gap-3 items-end sm:items-center pointer-events-none">
            {activeTab === 'tables' ? (
              <button onClick={() => { setEditingTable(null); setShowTableForm(true); }}
                className="px-5 py-3.5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-full sm:rounded-[14px] shadow-xl sm:shadow-md shadow-blue-200 transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto shrink-0">
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Table</span>
              </button>
            ) : (
              <button onClick={() => { setEditingFloor(null); setShowFloorForm(true); }}
                className="px-5 py-3.5 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-full sm:rounded-[14px] shadow-xl sm:shadow-md shadow-emerald-200 transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 sm:gap-2 text-xs sm:text-[11px] uppercase tracking-wider pointer-events-auto shrink-0">
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Add Floor</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tables Tab ─────────────────────────────────────────────── */}
      {activeTab === 'tables' && (
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10">
          {/* Floor Filters (Horizontal Scroll on Mobile) */}
          <div className="flex gap-2 flex-nowrap overflow-x-auto hide-scrollbar mb-6 pb-1">
            <button onClick={() => setSelectedFloorFilter('ALL')}
              className={`px-5 py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-black transition-all cursor-pointer border whitespace-nowrap shrink-0 shadow-sm ${
                selectedFloorFilter === 'ALL'
                  ? 'bg-slate-800 text-[#b5ef85] border-slate-800 shadow-md'
                  : 'bg-white/60 border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-white/80'
              }`}>
              All Floors
            </button>
            {sortedFloors.map(f => (
              <button key={f.id} onClick={() => setSelectedFloorFilter(f.id)}
                className={`px-5 py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-black transition-all cursor-pointer border whitespace-nowrap shrink-0 shadow-sm ${
                  selectedFloorFilter === f.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                    : 'bg-white/60 border-slate-200/80 text-slate-500 hover:border-slate-300 hover:bg-white/80'
                }`}>
                {f.name}
              </button>
            ))}
          </div>

          {/* Table Cards Grid */}
          {filteredTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[32px] shadow-sm">
              <div className="p-5 bg-white/50 rounded-full shadow-inner border border-white">
                <LayoutGrid className="h-10 w-10 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="font-black text-lg text-slate-700">No tables found</p>
                <p className="text-sm font-medium mt-1">Add a table to this floor to get started.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredTables.map(table => {
                const floor = floors.find(f => f.id === table.floorId);
                return (
                  <div key={table.id} className="relative group bg-white/70 backdrop-blur-xl border border-white/80 rounded-[24px] shadow-sm hover:shadow-lg transition-all p-5 flex flex-col items-center justify-center gap-3 overflow-hidden">
                    {/* Action buttons (Absolute, hover reveal on desktop, persistent faint on mobile) */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { setEditingTable(table); setShowTableForm(true); }} className="p-2 bg-white/80 hover:bg-amber-50 text-slate-400 hover:text-amber-500 rounded-xl shadow-sm transition-colors border border-slate-100"><Edit3 className="h-3.5 w-3.5"/></button>
                       <button onClick={() => setDeleteConfirm({ type: 'table', id: table.id, name: table.number })} className="p-2 bg-white/80 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl shadow-sm transition-colors border border-slate-100"><Trash2 className="h-3.5 w-3.5"/></button>
                    </div>

                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-inner mt-2">
                      <span className="text-2xl font-black text-blue-600">{table.number}</span>
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 text-slate-500 font-bold text-sm bg-white/50 px-3 py-1 rounded-xl shadow-sm border border-slate-100">
                        <Users className="h-3.5 w-3.5" />
                        <span>{table.capacity} <span className="text-[10px] uppercase">Seats</span></span>
                      </div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-2">
                        {floor?.name || 'No Floor'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Floors Tab ─────────────────────────────────────────────── */}
      {activeTab === 'floors' && (
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-10">


          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedFloors.map((floor, idx) => {
              const tableCount = tables.filter(t => t.floorId === floor.id).length;
              return (
                <div key={floor.id}
                  className="flex items-center gap-4 p-5 rounded-[24px] bg-white/70 backdrop-blur-xl border border-white/80 shadow-md transition-all group hover:shadow-lg">
                  {/* Drag handle / reorder */}
                  <div className="flex flex-col gap-1">
                    <button onClick={() => reorderFloor(floor.id, 'up')} disabled={idx === 0}
                      className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer transition-colors">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => reorderFloor(floor.id, 'down')} disabled={idx === sortedFloors.length - 1}
                      className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-20 cursor-pointer transition-colors">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="font-black text-lg text-slate-800 truncate">{floor.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {getZoneBadge(floor.zone)}
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {floor.surchargeValue > 0 ? `+${floor.surchargeValue}${floor.surchargeType === 'PERCENTAGE' ? '%' : '₹'} Surcharge` : 'No Surcharge'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 ml-auto">
                        {tableCount} Table{tableCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingFloor(floor); setShowFloorForm(true); }}
                      className="p-2 bg-white text-slate-400 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'floor', id: floor.id, name: floor.name })}
                      disabled={sortedFloors.length <= 1 || tableCount > 0}
                      title={tableCount > 0 ? "Remove all tables from this floor first" : "Delete Floor"}
                      className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add Floor Card CTA */}
            <button onClick={() => { setEditingFloor(null); setShowFloorForm(true); }}
              className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] border-2 border-dashed border-slate-300 bg-white/30 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer min-h-[104px]">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100"><Plus className="h-5 w-5" /></div>
              <span className="text-sm font-black uppercase tracking-wider">Add Floor</span>
            </button>
          </div>
        </div>
      )}

      {showFloorForm && (
        <FloorForm 
          initial={editingFloor || undefined} 
          title={editingFloor ? 'Edit Floor' : 'Add New Floor'}
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
          title={editingTable ? 'Edit Table' : 'Add New Table'}
          onClose={() => setShowTableForm(false)}
          onSave={(data) => {
            if (editingTable) updateTable(editingTable.id, data);
            else addTable(data);
            setShowTableForm(false);
          }} 
        />
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[32px] border border-white/80 shadow-2xl p-7 max-w-sm w-full">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200 shadow-sm">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div className="pt-1">
                <h3 className="font-black text-lg text-slate-800 leading-tight">
                  Delete {deleteConfirm.type === 'floor' ? 'Floor' : 'Table'}?
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-2 leading-snug">
                  <span className="font-black text-slate-700">"{deleteConfirm.name}"</span>
                  {deleteConfirm.type === 'floor'
                    ? ' will be permanently removed. This action cannot be undone.'
                    : ' will be permanently removed from this floor.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-600 font-black text-sm rounded-2xl border border-slate-200 transition-colors cursor-pointer shadow-sm">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-sm rounded-2xl shadow-md shadow-rose-200 transition-transform active:scale-95 cursor-pointer">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
