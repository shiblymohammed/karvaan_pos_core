import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Delete, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStaffStore } from '../store/useStaffStore';

interface ManagerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authorizedByName: string) => void;
  actionTitle: string;
  actionDescription?: string;
}

export const ManagerAuthModal: React.FC<ManagerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionTitle,
  actionDescription
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Invalid Manager/Admin PIN');

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (pin.length === 4) {
      const staffList = useStaffStore.getState().staff;
      // Find an active staff member whose PIN matches and has Admin/Manager role OR explicit canVoid permission
      const authorizedUser = staffList.find(s => 
        s.pin === pin && 
        s.isActive && 
        (s.role === 'ADMIN' || s.role === 'MANAGER' || s.permissions?.canVoid === true)
      );

      if (authorizedUser) {
        setError(false);
        setPin('');
        onSuccess(authorizedUser.name);
        onClose();
      } else {
        setError(true);
        setErrorMessage('Unauthorized PIN or insufficient permissions');
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 1200);
      }
    }
  }, [pin, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4 && !error) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (!error) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-pos-card border border-pos-border rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-pos-text-muted hover:text-pos-text rounded-full hover:bg-pos-bg transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center mb-3 shadow-glow">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-black text-pos-text tracking-tight">{actionTitle}</h3>
        <p className="text-xs text-pos-text-muted font-medium mt-1 max-w-[260px] leading-relaxed">
          {actionDescription || 'This action is restricted. Enter Admin or Manager PIN to override.'}
        </p>

        {/* PIN Dots Display */}
        <div className="flex gap-4 my-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                pin.length > i
                  ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] scale-110'
                  : 'bg-pos-border'
              } ${error ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : ''}`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-500 font-bold mb-4 animate-pulse bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20">
            <AlertTriangle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mb-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit.toString())}
              className="h-14 rounded-2xl bg-pos-bg border border-pos-border text-xl font-black text-pos-text flex items-center justify-center hover:bg-pos-card-hover active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <div className="h-14"></div>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-pos-bg border border-pos-border text-xl font-black text-pos-text flex items-center justify-center hover:bg-pos-card-hover active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-pos-bg border border-pos-border text-lg font-black text-pos-text-muted flex items-center justify-center hover:bg-pos-card-hover hover:text-rose-500 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-3 text-xs font-bold text-pos-text-muted hover:text-pos-text transition-colors cursor-pointer uppercase tracking-wider"
        >
          Cancel Action
        </button>
      </div>
    </div>
  );
};
