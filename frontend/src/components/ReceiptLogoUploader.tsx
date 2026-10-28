import React, { useRef } from 'react';
import { Image, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from '../store/useToastStore';

interface ReceiptLogoUploaderProps {
  logo?: string;
  onChange: (logo: string | null) => void;
}

export const ReceiptLogoUploader: React.FC<ReceiptLogoUploaderProps> = ({ logo, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image file is too large. Please select an image under 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Resize image to max 260px width for optimal thermal printing
        const maxW = 260;
        const maxH = 120;
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.9);
          onChange(compressedDataUrl);
          toast.success('Receipt logo updated! It will appear on all printed bills and pre-bills.');
        } else {
          onChange(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    toast.info('Receipt logo removed');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
          Receipt Header Logo
        </label>
        {logo && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove Logo
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        {/* Preview box */}
        <div className="w-40 h-20 rounded-xl bg-white border border-dashed border-slate-300 flex items-center justify-center p-2 overflow-hidden shadow-sm shrink-0">
          {logo ? (
            <img src={logo} alt="Receipt Logo Preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-slate-400 gap-1">
              <Image className="h-6 w-6 stroke-1" />
              <span className="text-[10px] font-bold">No logo uploaded</span>
            </div>
          )}
        </div>

        {/* Upload controls & guidelines */}
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <p className="text-xs font-bold text-slate-700">
            {logo ? (
              <span className="text-emerald-700 font-extrabold flex items-center gap-1 justify-center sm:justify-start">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Logo active on customer receipts
              </span>
            ) : (
              'Upload your restaurant emblem or logo for thermal receipts'
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
            Recommended: High-contrast monochrome or transparent PNG (max 300px width). Automatically sized for 58mm & 80mm rolls.
          </p>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer mx-auto sm:mx-0"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>{logo ? 'Change Logo Image' : 'Choose Logo Image'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
