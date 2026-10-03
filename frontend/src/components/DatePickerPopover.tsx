import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DatePickerPopoverProps {
  date: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDate?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePickerPopover: React.FC<DatePickerPopoverProps> = ({ date, onChange, maxDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse current selected date
  const selectedDate = new Date(date);
  
  // State for the calendar view (month/year)
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    // Reset view when opened if date changed externally
    if (isOpen) {
      const d = new Date(date);
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [isOpen, date]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    if (isOpen) document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDateDisabled = (year: number, month: number, day: number) => {
    if (!maxDate) return false;
    const d = new Date(year, month, day);
    const max = new Date(maxDate);
    // Compare YYYY-MM-DD
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dStr > maxDate;
  };

  const handleSelectDate = (day: number) => {
    const newDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(newDateStr);
    setIsOpen(false);
  };

  // Generate calendar days
  const calendarDays = [];
  // Empty slots before 1st of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="w-8 h-8 sm:w-10 sm:h-10"></div>);
  }
  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear;
    const isToday = new Date().getDate() === day && new Date().getMonth() === viewMonth && new Date().getFullYear() === viewYear;
    const disabled = isDateDisabled(viewYear, viewMonth, day);

    calendarDays.push(
      <button
        key={`day-${day}`}
        disabled={disabled}
        onClick={() => handleSelectDate(day)}
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
          isSelected 
            ? 'bg-slate-800 text-white shadow-md scale-110' 
            : disabled 
              ? 'text-slate-300 cursor-not-allowed'
              : isToday
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer'
                : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
        }`}
      >
        {day}
      </button>
    );
  }

  // Display text formatter
  const formattedSelectedDate = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="relative z-50" ref={popoverRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-transparent hover:bg-white/50 rounded-lg transition-colors cursor-pointer text-slate-800"
      >
        <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500" />
        <span className="text-xs sm:text-sm font-black whitespace-nowrap">{formattedSelectedDate}</span>
      </button>

      {/* Popover Calendar Modal (Portal) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            />
            
            {/* Calendar Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, type: 'spring', bounce: 0.3 }}
              className="relative bg-white/90 backdrop-blur-2xl border border-white/60 p-5 rounded-3xl shadow-2xl w-full max-w-[320px]"
            >
              {/* Header: Month/Year controls */}
              <div className="flex items-center justify-between mb-4">
                <button 
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-600 active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h4 className="font-black text-slate-800 text-base">
                  {MONTHS[viewMonth]} {viewYear}
                </h4>
                <button 
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-600 active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Weekdays header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => (
                  <div key={d} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs font-black text-slate-400 uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays}
              </div>

              {/* Quick action: Today */}
              <div className="mt-5 pt-4 border-t border-slate-100/50 flex justify-center">
                <button 
                  onClick={() => {
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    onChange(todayStr);
                    setIsOpen(false);
                  }}
                  className="text-sm font-black text-[#8cc63f] hover:text-[#7bb036] cursor-pointer hover:underline uppercase tracking-widest"
                >
                  Select Today
                </button>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
