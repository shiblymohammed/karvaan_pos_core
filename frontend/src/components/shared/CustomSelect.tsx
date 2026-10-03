import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, onChange, options }: { value: string, onChange: (v: string) => void, options: { value: string, label: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div className="relative">
      <button 
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3.5 bg-slate-50/50 hover:bg-slate-100/50 border border-slate-200 rounded-2xl text-slate-800 text-sm font-bold shadow-sm transition-all flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-emerald-400/20 focus:border-emerald-400"
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="max-h-60 overflow-y-auto hide-scrollbar flex flex-col">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`px-4 py-3 text-left text-sm font-bold transition-colors flex items-center justify-between ${
                      value === opt.value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                    {value === opt.value && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
