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
        try {
        // Trim blank margins before resizing; large white source canvases made logos tiny.
        const probe = document.createElement('canvas');
        const probeScale = Math.min(1, 1024 / img.width, 1024 / img.height);
        probe.width = Math.max(1, Math.round(img.width * probeScale));
        probe.height = Math.max(1, Math.round(img.height * probeScale));
        const probeContext = probe.getContext('2d');
        if (!probeContext) throw new Error('Unable to prepare the logo.');
        probeContext.fillStyle = '#fff'; probeContext.fillRect(0, 0, probe.width, probe.height);
        probeContext.drawImage(img, 0, 0, probe.width, probe.height);
        const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
        let left = probe.width, top = probe.height, right = -1, bottom = -1, darkest = 255;
        for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
          const i = (y * probe.width + x) * 4;
          const grey = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          darkest = Math.min(darkest, grey);
          if (grey < 248) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
        }
        if (right < left) throw new Error('This image is blank or too faint. Choose a logo with visible detail.');
        const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
        const maxW = 260;
        const maxH = 120;
        let width = cropWidth;
        let height = cropHeight;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(probe, left, top, cropWidth, cropHeight, 0, 0, width, height);
          // Save the exact monochrome preview that a thermal printer will receive.
          const raster = ctx.getImageData(0, 0, width, height);
          const threshold = Math.min(250, Math.max(180, darkest + 24));
          let inkPixels = 0;
          for (let i = 0; i < raster.data.length; i += 4) {
            const value = 0.299 * raster.data[i] + 0.587 * raster.data[i + 1] + 0.114 * raster.data[i + 2] < threshold ? 0 : 255;
            if (!value) inkPixels++;
            raster.data[i] = raster.data[i + 1] = raster.data[i + 2] = value; raster.data[i + 3] = 255;
          }
          if (!inkPixels) throw new Error('Logo detail is too fine at receipt size. Choose a bolder logo.');
          ctx.putImageData(raster, 0, 0);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.9);
          onChange(compressedDataUrl);
          toast.info('Logo ready. Save the print settings to apply it to printed bills.');
        } else {
          toast.error('Unable to prepare the logo. Please try another image.');
        }
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to prepare the logo.'); }
      };
      img.onerror = () => toast.error('Unable to read this logo. Please choose another image.');
      img.src = event.target?.result as string;
    };
    reader.onerror = () => toast.error('Unable to read this file. Please try another logo.');
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    toast.info('Logo removed from the preview. Save to apply.');
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
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Print preview ready — save to apply
              </span>
            ) : (
              'Upload your restaurant emblem or logo for thermal receipts'
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
            PNG, JPG, SVG or WebP, up to 3 MB. Blank margins are trimmed and colours converted to a crisp black-and-white print preview. Sized for 58 mm and 80 mm rolls.
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
