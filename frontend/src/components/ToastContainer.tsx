import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] flex flex-col gap-3 w-[calc(100%-2rem)] sm:w-full max-w-sm pointer-events-none mx-4 sm:mx-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          let Icon = Info;
          let colors = 'bg-white/90 border-blue-200 text-slate-800';
          let iconColor = 'text-blue-500';

          if (toast.type === 'SUCCESS') {
            Icon = CheckCircle2;
            colors = 'bg-white/90 border-emerald-200 text-slate-800';
            iconColor = 'text-emerald-500';
          } else if (toast.type === 'ERROR') {
            Icon = AlertCircle;
            colors = 'bg-white/90 border-rose-200 text-slate-800';
            iconColor = 'text-rose-500';
          } else if (toast.type === 'WARNING') {
            Icon = AlertTriangle;
            colors = 'bg-white/90 border-amber-200 text-slate-800';
            iconColor = 'text-amber-500';
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
              className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl pointer-events-auto backdrop-blur-md ${colors}`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${iconColor} mt-0.5`} />
              <p className="flex-1 font-bold text-sm leading-snug break-words pr-2">{toast.message}</p>
              <button 
                onClick={() => removeToast(toast.id)}
                className="opacity-40 hover:opacity-100 transition-opacity p-1 bg-slate-100 hover:bg-slate-200 rounded-full shrink-0"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
