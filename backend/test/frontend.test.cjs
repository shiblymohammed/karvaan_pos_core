const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function browserHarness() {
  const storage = new Map();
  const rows = new Map();
  let nextId = 1;
  const cache = new Map();
  const emitted = [];
  let ack = async () => ({ status: 'OK' });
  let uploadResponse;
  let inventoryResponse;
  const uploads = [];
  const socket = { connected: true, on: () => {}, timeout: () => ({ emitWithAck: async (type, payload) => { emitted.push({ type, payload }); return ack(type, payload); } }) };
  const db = {
    add: async (_store, row) => { const id = nextId++; rows.set(id, { ...row, id }); return id; },
    getAllFromIndex: async () => [...rows.values()].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id),
    delete: async (_store, id) => rows.delete(id), get: async (_store, id) => rows.get(id),
    put: async (_store, row) => rows.set(row.id, row),
  };
  const context = vm.createContext({
    console, crypto: require('node:crypto').webcrypto, FormData, Error, URL, TextEncoder, AbortSignal,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { dispatchEvent: () => {}, location: { origin: 'http://127.0.0.1:5173' } }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setInterval: () => 1, setTimeout, clearTimeout,
  });
  function load(relative) {
    const filename = path.resolve(__dirname, '../../frontend/src', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '{}'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const localRequire = name => {
      if (name === 'idb') return { openDB: async () => db };
      if (name === 'zustand') return require('../../frontend/node_modules/zustand');
      if (name === 'zustand/middleware') return require('../../frontend/node_modules/zustand/middleware');
      if (name === 'socket.io-client') return { io: () => socket };
      if (name.endsWith('serverConfig')) return { getServerUrl: () => storage.get('server') || 'http://server-a:3001', getOperatingMode: () => 'NODE_SERVER', getTerminalId: () => 'test-terminal' };
      if (name.endsWith('useAuthStore')) return { useAuthStore: { getState: () => ({ currentUser: JSON.parse(storage.get('pos-auth-storage') || '{}').state?.currentUser }) } };
      if (name.endsWith('authFetch')) return { authorizedFetch: async (endpoint, options) => { uploads.push({ endpoint, options }); if (endpoint === '/billing/inventory') return inventoryResponse || new Response('[]', { status: 200 }); return uploadResponse; } };
      if (name.endsWith('useSettingsStore')) return { useSettingsStore: { setState: () => {} }, applyRemoteSettings: () => {} };
      if (name.endsWith('useLedgerStore')) return { applyLedgerSnapshot: () => {} };
      if (name.endsWith('useToastStore')) return { toast: { error: () => {} } };
      if (name.endsWith('apiClient')) return { apiClient: {} };
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../../frontend/src'), path.resolve(path.dirname(filename), name + '.ts')));
      throw new Error('Unexpected browser dependency: ' + name);
    };
    vm.runInContext(`(function(require, module, exports) { ${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  function login(restaurantId = 'tenant-a', userId = 'cashier-a') { storage.set('pos-auth-storage', JSON.stringify({ state: { currentUser: { restaurantId, id: userId } } })); }
  login();
  return { load, storage, rows, emitted, socket, login, uploads, setOrigin: value => { context.window.location.origin = value; }, setUploadResponse: value => { uploadResponse = value; }, setInventoryResponse: value => { inventoryResponse = value; }, setAck: fn => { ack = fn; } };
}

test('a VPS web deployment uses its origin without repeatedly opening setup, while local terminals still require setup', () => {
  const h = browserHarness();
  const config = h.load('services/serverConfig.ts');
  assert.equal(config.isServerConfigured(), false);
  assert.equal(config.getServerUrl(), 'http://127.0.0.1:3001');
  h.setOrigin('https://pos.example.com');
  assert.equal(config.isServerConfigured(), true);
  assert.equal(config.getServerUrl(), 'https://pos.example.com');
  h.setOrigin('tauri://localhost');
  assert.equal(config.isServerConfigured(), false);
  config.setServerUrl('http://192.168.1.10:3001/');
  assert.equal(config.isServerConfigured(), true);
  assert.equal(config.getServerUrl(), 'http://192.168.1.10:3001');
});

test('menu image paths load from the configured backend on separate frontend and LAN terminals', () => {
  const h = browserHarness();
  const { resolveMediaUrl } = h.load('services/mediaUrl.ts');
  h.storage.set('server', 'https://api.example.com/');
  assert.equal(resolveMediaUrl('/uploads/menu.png'), 'https://api.example.com/uploads/menu.png');
  h.storage.set('server', 'http://192.168.1.10:3001');
  assert.equal(resolveMediaUrl('/uploads/category.png'), 'http://192.168.1.10:3001/uploads/category.png');
  for (const value of [undefined, '', 'https://res.cloudinary.com/menu.png', 'data:image/png;base64,image']) {
    assert.equal(resolveMediaUrl(value), value);
  }
});

test('menu image uploads send multipart files and preserve portable server paths', async () => {
  const h = browserHarness();
  h.setUploadResponse(new Response(JSON.stringify({ url: '/uploads/menu.png' }), { status: 201 }));
  const { uploadMenuImage } = h.load('services/menuImageUpload.ts');
  const file = new File(['image'], 'menu.png', { type: 'image/png' });
  assert.equal(await uploadMenuImage(file), '/uploads/menu.png');
  assert.equal(h.uploads[0].endpoint, '/upload?type=menu');
  assert.equal(h.uploads[0].options.method, 'POST');
  assert.equal(h.uploads[0].options.body.get('file').name, 'menu.png');
  assert.equal(h.uploads[0].options.headers, undefined);
});

test('menu image upload failures explain proxy, size, and backend errors without accepting SPA HTML', async () => {
  const h = browserHarness();
  const { uploadMenuImage } = h.load('services/menuImageUpload.ts');
  const file = new File(['image'], 'menu.png', { type: 'image/png' });
  for (const [response, message] of [
    [new Response('<html>405 Not Allowed</html>', { status: 405 }), /proxy configuration/],
    [new Response('<html>Too large</html>', { status: 413 }), /size limit/],
    [new Response(JSON.stringify({ message: 'Only image and video files are allowed' }), { status: 400 }), /Only image/],
    [new Response('<html>POS application</html>', { status: 200 }), /did not return an image URL/],
  ]) {
    h.setUploadResponse(response);
    await assert.rejects(uploadMenuImage(file), message);
  }
});

test('tenant persistence reads the actual auth namespace and keeps restaurants separate', () => {
  const h = browserHarness();
  const storage = h.load('store/tenantStorage.ts').tenantStorage;
  storage.setItem('cart', 'tenant-a-cart');
  h.login('tenant-b', 'cashier-b');
  assert.equal(storage.getItem('cart'), null);
  storage.setItem('cart', 'tenant-b-cart');
  h.login();
  assert.equal(storage.getItem('cart'), 'tenant-a-cart');
});

test('offline actions are scoped to server, restaurant, and user; legacy actions are never guessed', async () => {
  const h = browserHarness(); const queue = h.load('services/offlineQueue.ts');
  await queue.enqueueAction('settle_bill', { billNumber: 'BILL-1' });
  h.rows.set(99, { id: 99, type: 'settle_bill', payload: {}, timestamp: 0 });
  assert.equal((await queue.getPendingActions()).length, 1);
  h.login('tenant-b', 'cashier-b'); assert.equal((await queue.getPendingActions()).length, 0);
  h.login('tenant-a', 'cashier-b'); assert.equal((await queue.getPendingActions()).length, 0);
  h.login(); h.storage.set('server', 'http://another-server:3001'); assert.equal((await queue.getPendingActions()).length, 0);
});

test('a lost acknowledgment retains the bill and retries its original identity', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.setAck(async () => { throw new Error('Acknowledgment lost'); });
  assert.equal((await actions.emitAction('settle_bill', { billNumber: 'BILL-1', orderNumber: 'ORDER-1' })).status, 'QUEUED');
  assert.equal((await queue.getPendingActions()).length, 1);
  h.setAck(async () => ({ status: 'OK', data: { billNumber: 'BILL-1' } }));
  await actions.flushPendingActions();
  assert.equal((await queue.getPendingActions()).length, 0);
  assert.ok(h.emitted.every(action => action.payload.billNumber === 'BILL-1'));
});

test('rejected writes stay reviewable and are not presented as committed', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.setAck(async () => ({ status: 'ERROR', message: 'Invalid price' }));
  assert.equal((await actions.emitAction('settle_bill', { billNumber: 'BILL-1' })).status, 'ERROR');
  const pending = await queue.getPendingActions();
  assert.equal(pending.length, 1); assert.equal(pending[0].error, 'Invalid price');
  h.setAck(async () => ({ status: 'OK' }));
  await actions.flushPendingActions();
  assert.equal((await queue.getPendingActions()).length, 1);
});

test('a rejected order blocks its dependent commands while another bill continues', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('settle_bill', { billNumber: 'BAD', orderNumber: 'ORDER-A' });
  await actions.emitAction('fire_order', { orderNumber: 'ORDER-A' });
  await actions.emitAction('settle_bill', { billNumber: 'GOOD', orderNumber: 'ORDER-B' });
  h.setAck(async (_type, payload) => payload.billNumber === 'BAD' ? { status: 'ERROR', message: 'Review this cart' } : { status: 'OK' });
  h.socket.connected = true;
  await actions.flushPendingActions();
  assert.equal(h.emitted.length, 2);
  assert.equal(h.emitted[1].payload.billNumber, 'GOOD');
  const pending = await queue.getPendingActions();
  assert.equal(pending.length, 2);
  await queue.replaceActionPayload(pending[0].id, { billNumber: 'FIXED', orderNumber: 'ORDER-A' });
  await actions.flushPendingActions();
  assert.equal((await queue.getPendingActions()).length, 0);
});

test('a lost acknowledgment preserves its action identity without stopping an unrelated sale', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('ledger_payment', { entryId: 'credit-a', amount: 40, paymentMethod: 'CASH' });
  await actions.emitAction('settle_bill', { billNumber: 'OTHER', orderNumber: 'OTHER-ORDER' });
  h.socket.connected = true;
  h.setAck(async type => { if (type === 'ledger_payment') throw new Error('Ack lost'); return { status: 'OK' }; });
  await actions.flushPendingActions();
  assert.equal((await queue.getPendingActions()).length, 1);
  assert.equal(h.emitted.length, 2);
  const identity = h.emitted[0].payload.actionId;
  h.setAck(async () => ({ status: 'OK' }));
  await actions.flushPendingActions();
  assert.equal(h.emitted[2].payload.actionId, identity);
});

test('printer selection is scoped to its server, restaurant, and terminal', () => {
  const h = browserHarness(); const profile = h.load('services/printerProfile.ts');
  h.storage.set('server', 'https://cloud.example.com');
  profile.savePrinterProfile({ printers: [], receiptPort: 'COM4' });
  assert.equal(profile.getPrinterProfile().receiptPort, 'COM4');
  assert.equal(profile.canBackendPrintLocally(), false);
  h.login('tenant-b'); assert.equal(profile.getPrinterProfile().receiptPort, undefined);
  h.login(); h.storage.set('server', 'http://192.168.1.10:3001');
  assert.equal(profile.getPrinterProfile().receiptPort, undefined);
  assert.equal(profile.canBackendPrintLocally(), true);
});

test('printed invoice bytes contain configured business details and individual item prices', () => {
  const h = browserHarness(); const printing = h.load('services/tauriCommands.ts');
  const bytes = printing.buildBillReceipt({ restaurantName: 'Real Restaurant', restaurantAddress: 'Real Address', gstin: 'Configured GST Number', billNumber: 'TEST-1', orderType: 'PARCEL', tableName: 'Counter', cashier: 'Cashier', items: [{ name: 'Menu Item', qty: 2, price: 100 }], subtotal: 200, discount: 0, gst: 10, grandTotal: 210, paymentMethod: 'SPLIT', tenders: { CASH: 50, UPI: 160 }, pendingConfirmation: true, time: '12:00' });
  const receipt = Buffer.from(bytes).toString('utf8');
  assert.match(receipt, /Real Restaurant/);
  assert.match(receipt, /Real Address/);
  assert.match(receipt, /Configured GST Number/);
  assert.match(receipt, /CASH: Rs.50.00/);
  assert.match(receipt, /UPI: Rs.160.00/);
  assert.match(receipt, /AWAITING SERVER CONFIRMATION/);
  assert.ok(!receipt.includes('27AADCK1234F1Z9'));
});

test('a different login cannot flush another cashier’s pending actions', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('settle_bill', { billNumber: 'BILL-1' });
  h.login('tenant-b', 'cashier-b'); h.socket.connected = true;
  await actions.flushPendingActions();
  assert.equal(h.emitted.length, 0);
  h.login(); assert.equal((await queue.getPendingActions()).length, 1);
});

test('Force Sync keeps rejected originals and reports only server-confirmed actions', async () => {
  const h = browserHarness(), actions = h.load('services/socket.ts'), queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('apply_inventory_changes', { changes: [{ id: 'rice', delta: null }] });
  await actions.emitAction('settle_bill', { billNumber: 'INDEPENDENT', orderNumber: 'INDEPENDENT' });
  const original = (await queue.getPendingActions())[0];
  h.setAck(async type => type === 'apply_inventory_changes' ? { status: 'ERROR', message: 'Invalid inventory quantity' } : { status: 'OK' });
  h.socket.connected = true;
  const first = await actions.syncPendingNow();
  assert.equal(first.confirmed, 1); assert.equal(first.pending, 1); assert.equal(first.failed, 1);
  const pending = await queue.getPendingActions();
  assert.equal(pending[0].id, original.id); assert.equal(pending[0].actionId, original.actionId);
  const emitted = h.emitted.length;
  const again = await actions.syncPendingNow();
  assert.equal(again.confirmed, 0); assert.equal(again.failed, 1); assert.equal(h.emitted.length, emitted);
  h.socket.connected = false;
  await assert.rejects(actions.syncPendingNow(), /no connection/);
});

test('inventory reloads retain purchase conversions and quarantine invalid saved quantities', () => {
  const { normalizeInventoryItem } = browserHarness().load('services/inventoryData.ts');
  const rice = normalizeInventoryItem({ id: 'rice', unit: 'g', currentStock: 2000, costPrice: 0.05, minThreshold: 500 });
  assert.equal(rice.purchaseUnit, 'kg'); assert.equal(rice.conversionFactor, 1000);
  assert.equal(rice.costPerUnit, 0.05); assert.equal(rice.reorderLevel, 500);
  const packaging = normalizeInventoryItem({ unit: 'pcs', currentStock: 20, purchaseUnit: 'box', conversionFactor: 50, lastVendor: 'Supplier' });
  assert.equal(packaging.conversionFactor, 50); assert.equal(packaging.lastVendor, 'Supplier');
  const corrupted = normalizeInventoryItem({ unit: 'g', currentStock: null, costPerUnit: NaN, conversionFactor: null });
  assert.equal(corrupted.stockNeedsReview, true); assert.ok(Number.isFinite(corrupted.currentStock * corrupted.costPerUnit));
  assert.equal(normalizeInventoryItem(corrupted).stockNeedsReview, true);
});

test('old inventory snapshots are preserved for their owner without blocking new PO receipts', async () => {
  const h = browserHarness(), actions = h.load('services/socket.ts'), queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('sync_inventory', [{ id: 'rice', currentStock: null }]);
  const original = [...h.rows.values()][0];
  await actions.emitAction('receive_inventory_purchase', { id: 'rice', purchaseUnits: 2, conversionFactor: 1000, purchaseUnit: 'kg', invoiceCost: 120 });
  assert.equal(await queue.getQueueCount(), 1);
  const recovery = await queue.getRecoveryActions();
  assert.equal(recovery.length, 1); assert.equal(recovery[0].id, original.id); assert.equal(recovery[0].actionId, original.actionId);
  assert.equal(recovery[0].payload[0].currentStock, null);
  h.socket.connected = true;
  const result = await actions.syncPendingNow();
  assert.equal(result.confirmed, 1); assert.equal(result.pending, 0);
  assert.equal(h.emitted.length, 1); assert.equal(h.emitted[0].type, 'receive_inventory_purchase');
  h.login('tenant-b', 'cashier-b'); assert.equal((await queue.getRecoveryActions()).length, 0);
  h.login(); assert.equal((await queue.getRecoveryActions()).length, 1);
});

test('PO intake queues an invoice total without speculative stock changes or duplicate snapshot writes', async () => {
  const h = browserHarness(), inventory = h.load('store/useInventoryStore.ts'), queue = h.load('services/offlineQueue.ts');
  inventory.initializeInventorySync();
  inventory.applyInventorySnapshot([{ id: 'rice', name: 'Rice', category: 'PRODUCE', unit: 'g', currentStock: 1000, costPrice: 0.05, minThreshold: 100, revision: 0 }]);
  h.socket.connected = false;
  assert.equal((await inventory.useInventoryStore.getState().addStockPO('rice', 2, 120, 'Supplier')).status, 'QUEUED');
  const pending = await queue.getPendingActions();
  assert.equal(pending.length, 1); assert.equal(pending[0].type, 'receive_inventory_purchase');
  assert.equal(pending[0].payload.conversionFactor, 1000); assert.equal(pending[0].payload.invoiceCost, 120);
  assert.equal(inventory.useInventoryStore.getState().ingredients[0].currentStock, 1000);
  assert.equal((await inventory.useInventoryStore.getState().addStockPO('rice', NaN, 120)).status, 'ERROR');
  assert.equal((await queue.getPendingActions()).length, 1);
  assert.equal(inventory.useInventoryStore.getState().addIngredient({ name: 'Invalid ingredient', currentStock: 0, reorderLevel: 0, costPerUnit: 0, conversionFactor: 0, unit: 'g', purchaseUnit: 'kg' }), false);
  assert.equal((await queue.getPendingActions()).length, 1);
});

test('an older VPS reports missing inventory support and saved PO retries retain their identity after upgrade', async () => {
  const h = browserHarness(), actions = h.load('services/socket.ts'), queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('receive_inventory_purchase', { id: 'rice', purchaseUnits: 2, purchaseUnit: 'kg', conversionFactor: 1000, invoiceCost: 120 });
  const original = (await queue.getPendingActions())[0];
  h.socket.connected = true;
  h.setInventoryResponse(new Response('{"message":"Cannot GET /billing/inventory"}', { status: 404 }));
  const rejected = await actions.syncPendingNow();
  assert.equal(rejected.confirmed, 0); assert.equal(rejected.failed, 1); assert.equal(h.emitted.length, 0);
  const pending = (await queue.getPendingActions())[0];
  assert.match(pending.error, /Backend update required/); assert.equal(pending.actionId, original.actionId);
  h.setInventoryResponse(new Response('[]', { status: 200 }));
  await queue.markActionError(pending.id, '');
  const retried = await actions.syncPendingNow();
  assert.equal(retried.confirmed, 1); assert.equal(retried.pending, 0);
  assert.equal(h.emitted[0].payload.actionId, original.actionId);
});

test('inventory connectivity checks distinguish expired sessions and proxy HTML', async () => {
  const h = browserHarness(), backend = h.load('services/inventoryBackend.ts');
  h.setInventoryResponse(new Response('{}', { status: 401 }));
  await assert.rejects(backend.verifyInventoryBackend(), /session expired/);
  h.setInventoryResponse(new Response('<html>POS application</html>', { status: 200 }));
  await assert.rejects(backend.verifyInventoryBackend(), /page instead of stock data/);
});

test('saved menu hydration removes archived items while keeping temporarily unavailable items', () => {
  const h = browserHarness(), menu = h.load('store/useMenuStore.ts').useMenuStore;
  const merge = menu.persist.getOptions().merge;
  const saved = { products: [{ id: 'deleted', isArchived: true }, { id: 'temporary', isAvailable: false }, { id: 'active', isAvailable: true }] };
  const state = merge(saved, menu.getInitialState());
  assert.equal(state.products.length, 2);
  assert.equal(state.products.some(product => product.id === 'deleted'), false);
  assert.equal(state.products.find(product => product.id === 'temporary').isAvailable, false);
});
