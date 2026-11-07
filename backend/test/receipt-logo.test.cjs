const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PNG } = require('pngjs');
require('ts-node/register/transpile-only');
const { receiptLogoBytes } = require('../src/printer/receipt-logo');
const { renderPrintDocument } = require('../src/printer/print-document');

function logo(width = 9, height = 1) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  // Black, transparent black, white, then a final black pixel across the byte boundary.
  for (const x of [0, 1, width - 1]) png.data.fill(0, x * 4, x * 4 + 3);
  png.data[7] = 0;
  return 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
}
function frontend(file, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../frontend/src/services', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, TextEncoder, Uint8Array, setTimeout, clearTimeout, ...globals });
  return module.exports;
}

test('thermal logo packs visible black pixels and composites transparency onto white', () => {
  const bytes = receiptLogoBytes(logo());
  assert.deepEqual([...bytes], [0x1d, 0x76, 0x30, 0, 2, 0, 1, 0, 0x80, 0x80]);
  assert.equal(receiptLogoBytes('').length, 0);
  const scaled = receiptLogoBytes(logo(600, 300));
  assert.equal(scaled.readUInt16LE(4), 30);
  assert.equal(scaled.readUInt16LE(6), 120);
  assert.throws(() => receiptLogoBytes('https://example.com/logo.png'), /Upload/);
  assert.throws(() => receiptLogoBytes('data:image/png;base64,AAAA'), /Invalid/);
});

test('server receipts and pre-bills contain logo pixels before text at both paper widths', () => {
  const source = logo(), raster = receiptLogoBytes(source);
  for (const kind of ['RECEIPT', 'PREBILL', 'DISPATCH']) for (const paperWidth of [58, 80]) {
    const bytes = renderPrintDocument({ kind, receiptLogo: source, restaurantName: 'My Restaurant', reference: '123', createdAt: '2026-11-07T00:00:00Z', items: [] }, paperWidth);
    assert.ok(bytes.indexOf(raster) > 0);
    assert.ok(bytes.indexOf(raster) < bytes.indexOf(Buffer.from('My Restaurant')));
    assert.deepEqual([...bytes.subarray(-3)], [0x1d, 0x56, 0]);
  }
  const kot = renderPrintDocument({ kind: 'KOT', receiptLogo: source, reference: '123', createdAt: '2026-11-07T00:00:00Z', items: [] }, 58);
  assert.equal(kot.indexOf(raster), -1);
});

test('frontend receipt builder preserves binary logo data before the restaurant name', () => {
  const { buildBillReceipt } = frontend('tauriCommands.ts');
  const raster = receiptLogoBytes(logo());
  const bytes = Buffer.from(buildBillReceipt({ logoBytes: raster, restaurantName: 'My Restaurant', billNumber: '123', orderType: 'PARCEL', items: [], subtotal: 0, discount: 0, gst: 0, grandTotal: 0, paymentMethod: 'CASH', cashier: 'Staff', time: '12:00' }));
  assert.ok(bytes.indexOf(raster) > 0);
  assert.ok(bytes.indexOf(raster) < bytes.indexOf(Buffer.from('My Restaurant')));
});

test('browser printing waits for images and rejects broken logos rather than printing blank', async () => {
  const { waitForReceiptImages } = frontend('receiptLogo.ts');
  const image = { complete: false, naturalWidth: 0 };
  let done = false;
  const waiting = waitForReceiptImages({ images: [image] }).then(() => { done = true; });
  await Promise.resolve(); assert.equal(done, false);
  image.naturalWidth = 100; image.onload(); await waiting;
  assert.equal(done, true);
  await assert.rejects(waitForReceiptImages({ images: [{ complete: true, naturalWidth: 0 }] }), /could not load/);
  await waitForReceiptImages({ images: [{ complete: true, naturalWidth: 100 }] });
});

test('faint coloured logos produce ink while blank or fully transparent logos are rejected', () => {
  const png = new PNG({ width: 8, height: 1 }); png.data.fill(255);
  png.data[0] = 245; png.data[1] = 235; png.data[2] = 170;
  const faint = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  assert.equal(receiptLogoBytes(faint)[8], 0x80);
  png.data.fill(255);
  assert.throws(() => receiptLogoBytes('data:image/png;base64,' + PNG.sync.write(png).toString('base64')), /no printable detail/);
  png.data.fill(0);
  assert.throws(() => receiptLogoBytes('data:image/png;base64,' + PNG.sync.write(png).toString('base64')), /no printable detail/);
});

test('direct original receipt guards are tenant scoped and retain uncertain attempts without automatic retry', async () => {
  const storage = new Map(); let tenant = 'one'; let calls = 0;
  const guard = frontend('directPrintGuard.ts', {
    require: name => name.includes('serverConfig') ? { getServerUrl: () => 'https://pos.example', getTerminalId: () => 'counter' } : name.includes('apiClient') ? { apiClient: { post: async () => ({ allowed: true }) } } : name.includes('createId') ? { createId: () => 'claim-fixture' } : { useAuthStore: { getState: () => ({ currentUser: { restaurantId: tenant } }) } },
    navigator: {}, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  });
  await guard.printDirectReceiptOnce('INV-1', async () => { calls++; });
  await assert.rejects(guard.printDirectReceiptOnce('INV-1', async () => { calls++; }), /already sent or attempted/);
  assert.equal(calls, 1);
  await assert.rejects(guard.printDirectReceiptOnce('INV-2', async () => { calls++; throw new Error('Connection interrupted'); }), /interrupted/);
  await assert.rejects(guard.printDirectReceiptOnce('INV-2', async () => { calls++; }), /already sent or attempted/);
  assert.equal(calls, 2);
  tenant = 'two'; await guard.printDirectReceiptOnce('INV-1', async () => { calls++; }); assert.equal(calls, 3);
});

test('automatic checkout uses the authoritative queue before reading logos and does not print unconfirmed sales', async () => {
  const requests = [];
  const printing = frontend('quickPrint.ts', { require: name => {
    if (name.includes('apiClient')) return { apiClient: { get: async () => ({ destinations: [{ role: 'RECEIPT', autoPrint: true }] }), post: async (endpoint, body) => { requests.push({ endpoint, body }); } } };
    if (name.includes('useSettingsStore')) return { useSettingsStore: { getState: () => { throw new Error('Local logo should not be read'); } } };
    if (name.includes('useToastStore')) return { toast: { info() {}, warning() {} } };
    return {};
  } });
  assert.equal(await printing.autoPrintCheckoutReceipt({ billNumber: 'QUEUED', checkoutPrint: { receiptJobId: 'job' } }), true);
  assert.equal(requests.length, 0);
  assert.equal(await printing.autoPrintCheckoutReceipt({ billNumber: 'ORIGINAL' }), true);
  assert.equal(requests.length, 1); assert.equal(requests[0].body.requestId, 'auto:ORIGINAL');
  assert.equal(await printing.autoPrintCheckoutReceipt({ billNumber: 'OFFLINE', pendingConfirmation: true }), false);
  assert.equal(requests.length, 1);
});

test('local checkout kitchen copy uses only the saved unsent items and is omitted for pending payment', () => {
  const builders = frontend('tauriCommands.ts');
  const printing = frontend('quickPrint.ts', { require: name => name.includes('tauriCommands') ? builders : {} });
  const bill = { orderNumber: 'ORDER-1', checkoutPrint: { receiptAndKot: true, kitchenCopy: { reference: 'ORDER-1', items: [{ name: 'Coffee', variant: 'Large', quantity: 2, notes: 'No sugar' }] } } };
  const text = Buffer.from(printing.checkoutKitchenBytes(bill, 58)).toString();
  assert.match(text, /KITCHEN TICKET/); assert.match(text, /Coffee \(Large\)/); assert.match(text, /No sugar/);
  assert.equal(printing.checkoutKitchenBytes({ ...bill, paymentPending: true }, 58).length, 0);
  assert.equal(printing.checkoutKitchenBytes({ ...bill, pendingConfirmation: true }, 80).length, 0);
});
