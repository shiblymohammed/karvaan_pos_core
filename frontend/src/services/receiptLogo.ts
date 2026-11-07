/** Convert the saved logo to monochrome ESC/POS raster bytes before sending a bill. */
export async function receiptLogoBytes(source?: string): Promise<Uint8Array> {
  if (!source) return new Uint8Array();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Receipt logo could not load. Upload it again in printer settings.')), 5000);
    image.onload = () => { clearTimeout(timeout); resolve(); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Receipt logo could not load. Upload it again in printer settings.')); };
    image.src = source;
  });
  const scale = Math.min(1, 260 / image.naturalWidth, 120 / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare the receipt logo for printing.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let darkest = 255;
  for (let i = 0; i < pixels.length; i += 4) darkest = Math.min(darkest, 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  if (darkest >= 250) throw new Error('Logo has no printable detail. Upload a darker logo.');
  const threshold = Math.min(250, Math.max(180, darkest + 24));
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(8 + rowBytes * height);
  bytes.set([0x1d, 0x76, 0x30, 0, rowBytes & 255, rowBytes >> 8, height & 255, height >> 8]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2] < threshold) bytes[8 + y * rowBytes + (x >> 3)] |= 0x80 >> (x % 8);
  }
  return bytes;
}

export async function waitForReceiptImages(documentToPrint: Document): Promise<void> {
  await Promise.all(Array.from(documentToPrint.images).map(image => new Promise<void>((resolve, reject) => {
    const error = () => reject(new Error('Receipt logo could not load. Upload it again before printing.'));
    if (image.complete) { image.naturalWidth ? resolve() : error(); return; }
    const timeout = setTimeout(error, 5000);
    image.onload = () => { clearTimeout(timeout); resolve(); };
    image.onerror = () => { clearTimeout(timeout); error(); };
  })));
}
