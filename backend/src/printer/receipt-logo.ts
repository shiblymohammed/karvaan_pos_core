import { PNG } from 'pngjs';

/** Uploads are normalized to PNG by ReceiptLogoUploader. Never fetch external URLs. */
export function receiptLogoBytes(source?: string): Buffer {
  if (!source) return Buffer.alloc(0);
  if (typeof source !== 'string' || source.length > 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(source)) throw new Error('Upload the receipt logo again in printer settings (PNG required).');
  const input = Buffer.from(source.slice(source.indexOf(',') + 1), 'base64');
  // Bound decoded allocation before passing untrusted image data to the decoder.
  if (input.length < 24 || input.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || input.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid receipt logo PNG');
  const w = input.readUInt32BE(16), h = input.readUInt32BE(20);
  if (!w || !h || w > 2048 || h > 2048) throw new Error('Receipt logo dimensions are too large');
  const image = PNG.sync.read(input);
  let darkest = 255;
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3] / 255;
    darkest = Math.min(darkest, (0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2]) * alpha + 255 * (1 - alpha));
  }
  if (darkest >= 250) throw new Error('Logo has no printable detail');
  const threshold = Math.min(250, Math.max(180, darkest + 24));
  const scale = Math.min(1, 260 / w, 120 / h);
  const width = Math.max(1, Math.round(w * scale)), height = Math.max(1, Math.round(h * scale));
  const rowBytes = Math.ceil(width / 8);
  const bytes = Buffer.alloc(8 + rowBytes * height);
  bytes.set([0x1d, 0x76, 0x30, 0, rowBytes & 255, rowBytes >> 8, height & 255, height >> 8]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (Math.min(h - 1, Math.floor(y / scale)) * w + Math.min(w - 1, Math.floor(x / scale))) * 4;
    const alpha = image.data[i + 3] / 255;
    const grey = (0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2]) * alpha + 255 * (1 - alpha);
    if (grey < threshold) bytes[8 + y * rowBytes + (x >> 3)] |= 0x80 >> (x % 8);
  }
  return bytes;
}
