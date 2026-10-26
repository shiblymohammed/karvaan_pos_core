const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fakeIndexedDB = require('fake-indexeddb');
Object.assign(globalThis, fakeIndexedDB);
const realIDB = require('../../frontend/node_modules/idb');

function browserHarness(shared = {}) {
  const storage = shared.storage ||= new Map();
  const tabStorage = new Map();
  const factory = shared.factory ||= new fakeIndexedDB.IDBFactory();
  const cache = new Map();
  const emitted = [];
  const timers = new Map();
  let timerId = 0;
  let ack = async () => ({ status: 'OK' });
  let uploadResponse;
  let inventoryResponse;
  const uploads = [];
  const socket = { connected: true, on: () => {}, timeout: () => ({ emitWithAck: async (type, payload) => { emitted.push({ type, payload }); return ack(type, payload); } }) };
  let liveAuth;
  const context = vm.createContext({
    console, crypto: { getRandomValues: value => require('node:crypto').webcrypto.getRandomValues(value) }, FormData, Error, URL, TextEncoder, AbortSignal, Headers,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key), get length() { return storage.size; }, key: index => [...storage.keys()][index] || null },
    sessionStorage: { getItem: key => tabStorage.get(key) || null, setItem: (key, value) => tabStorage.set(key, value), removeItem: key => tabStorage.delete(key) },
    navigator: { onLine: true }, window: { dispatchEvent: () => {}, addEventListener: () => {}, location: { origin: 'http://127.0.0.1:5173' } }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setInterval: () => 1, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  function load(relative) {
    const filename = path.resolve(__dirname, '../../frontend/src', relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '{}'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const localRequire = name => {
      if (name === 'idb') return { openDB: (...args) => { globalThis.indexedDB = factory; return realIDB.openDB(...args); } };
      if (name === 'zustand') return require('../../frontend/node_modules/zustand');
      if (name === 'zustand/middleware') return require('../../frontend/node_modules/zustand/middleware');
      if (name === 'socket.io-client') return { io: () => socket };
      if (name.endsWith('serverConfig')) return { getServerUrl: () => storage.get('server') || 'http://server-a:3001', getOperatingMode: () => 'NODE_SERVER', getTerminalId: () => 'test-terminal' };
      if (name.endsWith('useAuthStore')) return { useAuthStore: { getState: () => liveAuth || JSON.parse(storage.get('pos-auth-storage') || '{}').state || {} } };
      if (name.endsWith('authFetch')) return { authorizedFetch: async (endpoint, options) => { uploads.push({ endpoint, options }); if (endpoint === '/billing/inventory') return inventoryResponse || new Response('[]', { status: 200 }); if (endpoint === '/billing/admin-config') return new Response('{"staffRevision":0,"recipeRevision":0}', { status: 200 }); if (endpoint === '/billing/waste') return new Response('[]', { status: 200 }); return uploadResponse; } };
      if (name.endsWith('catalogConfig')) return { initializeCatalogConfig: () => {}, suspendCatalogConfig: () => {} };
      if (name.endsWith('useSettingsStore')) return { useSettingsStore: { setState: () => {}, getState: () => ({ orderPrefix: 'KOT' }) }, applyRemoteSettings: () => {} };
      if (name.endsWith('useLedgerStore')) return { applyLedgerSnapshot: () => {} };
      if (name.endsWith('useToastStore')) return { toast: { error: () => {}, success: () => {}, info: () => {}, warning: () => {} } };
      if (name.endsWith('apiClient')) return { apiClient: {} };
      if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../../frontend/src'), path.resolve(path.dirname(filename), name + '.ts')));
      throw new Error('Unexpected browser dependency: ' + name);
    };
    vm.runInContext(`(function(require, module, exports) { ${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  function login(restaurantId = 'tenant-a', userId = 'cashier-a') { storage.set('pos-auth-storage', JSON.stringify({ state: { currentUser: { restaurantId, id: userId } } })); }
  login();
  return { load, storage, emitted, socket, login, uploads, setFetch: fn => { context.fetch = fn; }, runTimers: async () => { const scheduled = [...timers.values()]; timers.clear(); for (const fn of scheduled) await fn(); }, setLiveAuth: value => { liveAuth = value; }, setOrigin: value => { context.window.location.origin = value; }, setUploadResponse: value => { uploadResponse = value; }, setInventoryResponse: value => { inventoryResponse = value; }, setAck: fn => { ack = fn; } };
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
  await (await queue.initDB()).put('actions', { id: 99, type: 'settle_bill', payload: {}, timestamp: 0 });
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

test('receipt copies retain modifiers without charging their prices twice', () => {
  const h = browserHarness(), { receiptItemsFromSnapshot } = h.load('services/receiptData.ts');
  const lines = receiptItemsFromSnapshot([{ name: 'Meal', quantity: 2, price: 120, addons: [{ name: 'Extra sauce', price: 20 }] }]);
  assert.equal(lines[0].price, 100); assert.equal(lines[0].addons[0].name, 'Extra sauce');
  assert.equal((lines[0].price + lines[0].addons[0].price) * lines[0].quantity, 240);
});

test('thermal fallback prints full modifiers and marks unpaid prebill and reprint documents', () => {
  const h = browserHarness(), printing = h.load('services/tauriCommands.ts');
  const instruction = 'Keep sauce separately and do not omit the final cooking instruction';
  const kot = Buffer.from(printing.buildKotReceipt({ orderNumber: 'KOT', tableName: '1', time: '12:00', items: [{ name: 'Meal', qty: 1, notes: instruction, addons: [{ name: 'Extra sauce' }] }] })).toString();
  assert.match(kot, /Extra sauce/); assert.match(kot.replace(/\n/g, ' '), /final cooking instruction/);
  const bill = Buffer.from(printing.buildBillReceipt({ restaurantName: 'POS', billNumber: 'PRE', orderType: 'DINE_IN', cashier: 'Staff', time: '12:00', items: [], subtotal: 0, discount: 0, gst: 0, grandTotal: 0, paymentMethod: 'UNPAID', prebill: true, reprint: true })).toString();
  assert.match(bill, /PRE-BILL - UNPAID/); assert.match(bill, /REPRINT/);
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
  const original = (await (await queue.initDB()).getAll('actions'))[0];
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

test('two tabs share their queue but only the lease holder sends pending purchases', async () => {
  const shared = {}, first = browserHarness(shared), second = browserHarness(shared);
  const firstQueue = first.load('services/offlineQueue.ts'), firstActions = first.load('services/socket.ts'), secondActions = second.load('services/socket.ts');
  await firstQueue.enqueueAction('receive_inventory_purchase', { id: 'rice', purchaseUnits: 2 });
  let release, started;
  const sending = new Promise(resolve => { started = resolve; });
  first.setAck(() => { started(); return new Promise(resolve => { release = resolve; }); });
  const pending = firstActions.flushPendingActions();
  await sending;
  await secondActions.flushPendingActions();
  assert.equal(first.emitted.length, 1); assert.equal(second.emitted.length, 0);
  release({ status: 'OK' }); await pending;
  assert.equal((await firstQueue.getPendingActions()).length, 0);
});

test('an expired lease is recoverable and fences the old tab before another action', async () => {
  const shared = {}, first = browserHarness(shared), second = browserHarness(shared);
  const queue = first.load('services/offlineQueue.ts'), actions = first.load('services/socket.ts'), other = second.load('services/socket.ts');
  await queue.enqueueAction('settle_bill', { billNumber: 'A' }); await queue.enqueueAction('settle_bill', { billNumber: 'B' });
  let release, started;
  const sending = new Promise(resolve => { started = resolve; });
  first.setAck(() => { started(); return new Promise(resolve => { release = resolve; }); });
  const pending = actions.flushPendingActions(); await sending;
  const db = await queue.initDB(), lease = (await db.getAll('leases'))[0];
  await db.put('leases', { ...lease, expires: 0 });
  await other.flushPendingActions();
  release({ status: 'OK' }); await pending;
  assert.equal(first.emitted.length, 1); assert.equal(second.emitted.length, 2);
  assert.equal(first.emitted[0].payload.actionId, second.emitted[0].payload.actionId);
  assert.equal((await queue.getPendingActions()).length, 0);
});

test('simultaneous checkout enqueue in two tabs retains one stable invoice identity', async () => {
  const shared = {}, first = browserHarness(shared), second = browserHarness(shared);
  const one = first.load('services/offlineQueue.ts'), two = second.load('services/offlineQueue.ts');
  const ids = await Promise.all([one.enqueueAction('settle_bill', { billNumber: 'SAME' }), two.enqueueAction('settle_bill', { billNumber: 'SAME' })]);
  assert.equal(ids[0], ids[1]); assert.equal((await one.getPendingActions()).length, 1);
});

test('an old tab cannot relabel its action after another tab switches accounts or backend', async () => {
  const h = browserHarness(), queue = h.load('services/offlineQueue.ts'), actions = h.load('services/socket.ts');
  const original = JSON.parse(h.storage.get('pos-auth-storage')).state;
  h.setLiveAuth(original); await queue.enqueueAction('settle_bill', { billNumber: 'ORIGINAL' });
  h.login('tenant-a', 'cashier-b');
  assert.equal((await actions.emitAction('settle_bill', { billNumber: 'WRONG-OWNER' })).status, 'ERROR');
  await actions.flushPendingActions(); assert.equal(h.emitted.length, 0);
  assert.equal((await (await queue.initDB()).getAll('actions')).length, 1);
  h.login(); h.setLiveAuth({ ...original, sessionServerUrl: 'http://server-a:3001' }); h.storage.set('server', 'http://server-b:3001');
  await assert.rejects(queue.enqueueAction('settle_bill', { billNumber: 'WRONG-SERVER' }), /backend connection changed/);
});

test('caches are separated by backend and cashier, and two tabs keep separate carts', () => {
  const shared = {}, first = browserHarness(shared), second = browserHarness(shared);
  const one = first.load('store/tenantStorage.ts'), two = second.load('store/tenantStorage.ts');
  const draft = name => JSON.stringify({ state: { items: [{ name, productId: 'meal', quantity: 1 }] } });
  one.tenantStorage.setItem('pos-cart-storage', draft('First tab'));
  assert.equal(two.tenantStorage.getItem('pos-cart-storage'), null);
  two.tenantStorage.setItem('pos-cart-storage', draft('Second tab'));
  assert.match(one.tenantStorage.getItem('pos-cart-storage'), /First tab/);
  one.tenantStorage.setItem('menu', 'Backend A');
  first.storage.set('server', 'https://server-b'); assert.equal(one.tenantStorage.getItem('menu'), null);
  first.storage.delete('server'); first.login('tenant-a', 'cashier-b'); assert.equal(one.tenantStorage.getItem('menu'), null);
  first.login(); assert.equal(one.tenantStorage.getItem('menu'), 'Backend A');
  first.storage.set('pos-cart-storage-tenant-a', draft('Legacy'));
  assert.match(one.getLegacyCartDraft(), /Legacy/);
  assert.equal(one.getRecoverableCartDrafts().length, 2);
  assert.ok(first.storage.has('pos-cart-storage-tenant-a'));
});

test('unversioned staff and recipe actions remain recoverable without being replayed', async () => {
  const h = browserHarness(), queue = h.load('services/offlineQueue.ts'), actions = h.load('services/socket.ts');
  const id = await queue.enqueueAction('sync_recipes', [{ menuItemId: 'meal', ingredients: [] }]);
  assert.equal((await queue.getPendingActions()).length, 0);
  await actions.flushPendingActions(); assert.equal(h.emitted.length, 0);
  const recovery = await queue.getRecoveryActions(); assert.equal(recovery[0].id, id); assert.match(recovery[0].recoveryReason, /no server version/);
});

test('settings debounce preserves local edits across a remote update and queues a versioned save', async () => {
  const h = browserHarness();
  const auth = JSON.parse(h.storage.get('pos-auth-storage')); auth.state.currentUser.role = 'ADMIN'; h.storage.set('pos-auth-storage', JSON.stringify(auth));
  const settings = h.load('store/useSettingsStore.ts'), queue = h.load('services/offlineQueue.ts');
  settings.applyRemoteSettings({ serverRevision: 4, orderPrefix: 'OLD' });
  h.socket.connected = false;
  settings.useSettingsStore.getState().setOrderPrefix('LOCAL');
  assert.equal(settings.applyRemoteSettings({ serverRevision: 5, orderPrefix: 'OTHER-DEVICE' }), false);
  await h.runTimers();
  const pending = await queue.getPendingActions();
  assert.equal(pending.length, 1); assert.equal(pending[0].type, 'update_settings');
  assert.equal(pending[0].payload.expectedRevision, 4); assert.equal(pending[0].payload.settings.orderPrefix, 'LOCAL');
  assert.equal(settings.getSavedSettingsDraft().settings.orderPrefix, 'LOCAL');
  settings.applyRemoteSettings({ serverRevision: 5, orderPrefix: 'OTHER-DEVICE' }, true);
  assert.equal(settings.useSettingsStore.getState().orderPrefix, 'OTHER-DEVICE');
  assert.equal((await queue.getPendingActions()).length, 1);
});

test('a delayed settings edit cannot move to a different cashier', async () => {
  const h = browserHarness(); const auth = JSON.parse(h.storage.get('pos-auth-storage'));
  auth.state.currentUser.role = 'ADMIN'; h.storage.set('pos-auth-storage', JSON.stringify(auth));
  const settings = h.load('store/useSettingsStore.ts'), queue = h.load('services/offlineQueue.ts');
  settings.useSettingsStore.getState().setOrderPrefix('PRESERVE');
  h.login('tenant-a', 'cashier-b'); await h.runTimers();
  assert.equal((await (await queue.initDB()).getAll('actions')).length, 0);
  assert.ok([...h.storage.values()].some(value => value.includes('PRESERVE')));
});

test('older configuration broadcasts cannot replace a newer queued edit or an already newer snapshot', async () => {
  const h = browserHarness(), queue = h.load('services/offlineQueue.ts'), snapshots = h.load('services/configSnapshot.ts');
  await queue.enqueueAction('sync_recipes', { expectedRevision: 1, recipes: [{ menuItemId: 'meal', ingredients: [] }] });
  let applied = 0;
  assert.equal(await snapshots.applyConfigSnapshot('sync_recipes', 1, () => 1, () => { applied++; }), false);
  assert.equal(await snapshots.applyConfigSnapshot('sync_recipes', 0, () => 1, () => { applied++; }), false);
  assert.equal(applied, 0);
  assert.equal(await snapshots.applyConfigSnapshot('sync_recipes', 2, () => 2, () => { applied++; }), true);
  assert.equal(applied, 1);
  assert.equal((await queue.getPendingActions()).length, 1);
});

test('old socket responses are ignored after the active account changes', () => {
  const h = browserHarness(); const auth = JSON.parse(h.storage.get('pos-auth-storage')).state;
  auth.accessToken = 'original-token'; h.storage.set('pos-auth-storage', JSON.stringify({ state: auth }));
  h.setLiveAuth(auth); h.socket.auth = { token: 'original-token', restaurantId: 'tenant-a' };
  const actions = h.load('services/socket.ts');
  assert.equal(actions.isCurrentSocketSession(), true);
  h.login('tenant-a', 'other-user'); assert.equal(actions.isCurrentSocketSession(), false);
  h.setLiveAuth(JSON.parse(h.storage.get('pos-auth-storage')).state); assert.equal(actions.isCurrentSocketSession(), false);
});

test('HTTP responses from an earlier login cannot hydrate a different account', async () => {
  const h = browserHarness(); const auth = JSON.parse(h.storage.get('pos-auth-storage')).state;
  auth.accessToken = 'original-token'; h.storage.set('pos-auth-storage', JSON.stringify({ state: auth })); h.setLiveAuth(auth);
  let resolve;
  h.setFetch((_url, options) => { assert.equal(options.headers.get('Authorization'), 'Bearer original-token'); return new Promise(done => { resolve = done; }); });
  const pending = h.load('services/authFetch.ts').authorizedFetch('/settings');
  h.login('tenant-a', 'other-user'); resolve(new Response('{}', { status: 200 }));
  await assert.rejects(pending, /account changed in another tab/);
});

test('a fresh account cannot accidentally publish a demo roster as server version zero', () => {
  const h = browserHarness(), staff = h.load('store/useStaffStore.ts').useStaffStore;
  assert.equal(staff.getState().staff.length, 0);
  assert.equal(staff.getState().serverRevision, -1);
  staff.getState().addStaff({ name: 'First', role: 'CASHIER', pin: '1234' });
  staff.getState().addStaff({ name: 'Second', role: 'CASHIER', pin: '4321' });
  assert.equal(staff.getState().staff.length, 0); assert.equal(staff.getState().serverRevision, -1);
  assert.equal(h.load('store/useInventoryStore.ts').useInventoryStore.getState().recipeRevision, -1);
  assert.equal(h.load('store/useSettingsStore.ts').useSettingsStore.getState().serverRevision, -1);
  assert.equal(h.load('store/useMenuStore.ts').useMenuStore.getState().serverRevision, -1);
});

test('LAN clients without randomUUID can still create valid independent action identifiers', () => {
  const createId = browserHarness().load('services/createId.ts').createId;
  const ids = new Set(Array.from({ length: 100 }, createId));
  assert.equal(ids.size, 100);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('staff editing preserves credentials unless a valid replacement is explicitly entered', () => {
  const { validStaffForm } = browserHarness().load('services/staffValidation.ts');
  const profile = { name: 'Cashier', username: 'cashier', password: '', pin: '' };
  assert.equal(validStaffForm(profile, '', true), true);
  assert.equal(validStaffForm(profile, '', false), false);
  assert.equal(validStaffForm({ ...profile, pin: '4321' }, '', false), true);
  assert.equal(validStaffForm({ ...profile, password: 'new-password' }, 'different', true), false);
  assert.equal(validStaffForm({ ...profile, pin: 'letters' }, '', true), false);
});

test('a rejected staff edit keeps the server roster and correcting it retries the same action', async () => {
  const h = browserHarness(), staff = h.load('store/useStaffStore.ts').useStaffStore, queue = h.load('services/offlineQueue.ts');
  staff.setState({ serverRevision: 0, staff: [{ id: 'staff-1', name: 'Original', username: 'original', phone: '1', pin: '', role: 'CASHIER', isActive: true }] });
  h.setAck(async () => ({ status: 'ERROR', message: 'Please correct the phone' }));
  assert.equal((await staff.getState().updateStaff('staff-1', { phone: 'wrong' })).status, 'ERROR');
  assert.equal(staff.getState().staff[0].phone, '1'); assert.equal(staff.getState().serverRevision, 0);
  const original = (await queue.getPendingActions())[0];
  h.setAck(async () => ({ status: 'OK' }));
  assert.equal((await staff.getState().updateStaff('staff-1', { phone: 'correct' })).status, 'OK');
  assert.equal(h.emitted[1].payload.actionId, original.actionId); assert.equal((await queue.getPendingActions()).length, 0);
});

test('delivery refresh reads current server data without sending a legacy snapshot', async () => {
  const h = browserHarness(), delivery = h.load('store/useDeliveryStore.ts').useDeliveryStore, queue = h.load('services/offlineQueue.ts');
  h.setUploadResponse(new Response(JSON.stringify([{ id: 'server-delivery', status: 'READY' }]), { status: 200 }));
  await delivery.getState().fetchOrders();
  assert.equal(delivery.getState().orders[0].id, 'server-delivery'); assert.equal(h.emitted.length, 0); assert.equal((await queue.getPendingActions()).length, 0);
});

test('an offline delivery assignment stays unconfirmed and does not queue repeated transitions', async () => {
  const h = browserHarness(), delivery = h.load('store/useDeliveryStore.ts').useDeliveryStore, queue = h.load('services/offlineQueue.ts');
  delivery.setState({ orders: [{ id: 'run', orderNumber: 'RUN', status: 'READY', revision: 0 }] });
  h.socket.connected = false;
  assert.equal((await delivery.getState().assignDeliveryBoy('run', 'rider', 'Rider')).status, 'QUEUED');
  assert.equal(delivery.getState().orders[0].status, 'READY'); assert.equal(delivery.getState().orders[0].pendingConfirmation, true);
  await delivery.getState().updateOrderStatus('run', 'DELIVERED');
  assert.equal((await queue.getPendingActions()).length, 1);
});

test('KDS readiness is confirmed once and does not emit a second delivery status command', async () => {
  const h = browserHarness(), kitchen = h.load('store/useKdsStore.ts').useKdsStore;
  kitchen.setState({ tickets: [{ id: 'ticket', orderNumber: 'KDS-ORDER', orderType: 'DELIVERY', status: 'COOKING', items: [] }] });
  let started, finish;
  const sending = new Promise(resolve => { started = resolve; });
  h.setAck(() => { started(); return new Promise(resolve => { finish = resolve; }); });
  const update = kitchen.getState().updateTicketStatus('ticket', 'READY'); await sending;
  assert.equal(kitchen.getState().tickets[0].status, 'COOKING');
  assert.equal((await kitchen.getState().updateTicketStatus('ticket', 'SERVED')).status, 'QUEUED');
  finish({ status: 'OK' }); await update;
  assert.equal(kitchen.getState().tickets[0].status, 'READY'); assert.equal(h.emitted.length, 1); assert.equal(h.emitted[0].type, 'update_kds_status');
});

test('failed parking and kitchen sends preserve the cart and do not mark unsent food as sent', async () => {
  const h = browserHarness(), cart = h.load('store/cartStore.ts').useCartStore;
  cart.setState({ items: [{ productId: 'meal', name: 'Meal', quantity: 1, price: 10, status: 'NEW' }], customer: { name: 'Guest', phone: '12345' }, discount: 1, selectedTableId: 'real-table' });
  h.setAck(async () => ({ status: 'ERROR', message: 'Server rejected the operation' }));
  assert.equal(await cart.getState().holdCurrentOrder(), false);
  assert.equal(cart.getState().items.length, 1); assert.equal(cart.getState().customer.phone, '12345'); assert.equal(cart.getState().discount, 1);
  // A failed park is retained for review; use a separate table/order resource for the kitchen attempt.
  cart.setState({ selectedTableId: 'another-table' });
  await cart.getState().sendKot();
  assert.equal(cart.getState().items[0].status, 'NEW'); assert.equal(cart.getState().heldOrders.length, 0);
  assert.equal(cart.getState().isSendingKot, false);
  assert.equal(h.emitted.find(row => row.type === 'fire_order').payload.tableId, 'another-table');
});

test('parking and resuming retain customer phone, discount, and invoice identity', async () => {
  const h = browserHarness(), cart = h.load('store/cartStore.ts').useCartStore;
  cart.setState({ items: [{ productId: 'meal', name: 'Meal', quantity: 1, price: 10, status: 'NEW' }], customer: { name: 'Guest', phone: '55555' }, discount: 2, checkoutBillNumber: 'SAVED-INVOICE' });
  assert.equal(await cart.getState().holdCurrentOrder(), true);
  assert.equal(cart.getState().items.length, 0);
  const parked = cart.getState().heldOrders[0];
  assert.equal(parked.customerPhone, '55555'); assert.equal(parked.discount, 2);
  await cart.getState().resumeOrder(parked.id);
  assert.equal(cart.getState().customer.phone, '55555'); assert.equal(cart.getState().discount, 2); assert.equal(cart.getState().checkoutBillNumber, 'SAVED-INVOICE');
  const persisted = cart.persist.getOptions().partialize(cart.getState());
  assert.equal('isParking' in persisted, false); assert.equal('isResuming' in persisted, false);
});

test('pending parked drafts survive a reconnect snapshot and older board versions cannot resurrect an order', async () => {
  const h = browserHarness(), queue = h.load('services/offlineQueue.ts'), snapshots = h.load('services/parkedSnapshot.ts');
  await queue.enqueueAction('park_order', { order: { id: 'draft', customerPhone: '555', discount: 5, items: [] }, expectedRevision: 0 });
  let rows;
  await snapshots.applyParkedSnapshot([], value => { rows = value; }, 1);
  assert.equal(rows[0].customerPhone, '555'); assert.equal(rows[0].discount, 5);
  const id = (await queue.getPendingActions())[0].id; await queue.clearAction(id);
  await snapshots.applyParkedSnapshot([], value => { rows = value; }, 3);
  await snapshots.applyParkedSnapshot([{ id: 'draft', revision: 1 }], value => { rows = value; }, 2);
  assert.equal(rows.length, 0);
});

test('waste is one durable command and never speculatively clamps stock or invents loss costs', async () => {
  const h = browserHarness(), inventory = h.load('store/useInventoryStore.ts'), queue = h.load('services/offlineQueue.ts');
  inventory.applyInventorySnapshot([{ id: 'stock', name: 'Stock', unit: 'g', currentStock: 10, costPrice: 2 }]);
  h.socket.connected = false;
  assert.equal((await inventory.useInventoryStore.getState().logWaste({ ingredientId: 'stock', quantity: 3, reason: 'BURNT' })).status, 'QUEUED');
  const pending = await queue.getPendingActions(); assert.equal(pending.length, 1); assert.equal(pending[0].type, 'record_inventory_waste');
  assert.equal(inventory.useInventoryStore.getState().ingredients[0].currentStock, 10);
  assert.equal((await inventory.useInventoryStore.getState().logWaste({ ingredientId: 'stock', quantity: 30, reason: 'BURNT' })).status, 'ERROR');
  assert.equal(h.load('services/inventoryData.ts').normalizeWasteLog({ itemName: 'Old record', quantity: 1 }).costLoss, null);
});

test('stock approval challenges remain with the failed original and approval retries that identity', async () => {
  const h = browserHarness(), actions = h.load('services/socket.ts'), queue = h.load('services/offlineQueue.ts');
  h.setAck(async () => ({ status: 'ERROR', reason: 'STOCK_APPROVAL_REQUIRED', stockChallenge: 'signed-challenge', shortages: [{ name: 'Rice', available: 1, required: 2 }], message: 'Manager approval required' }));
  const result = await actions.emitAction('settle_bill', { billNumber: 'SHORTAGE-BILL' });
  assert.equal(result.reason, 'STOCK_APPROVAL_REQUIRED');
  const original = (await queue.getPendingActions())[0]; assert.equal(original.errorDetails.stockChallenge, 'signed-challenge');
  await queue.replaceActionPayload(original.id, { ...original.payload, stockAuthorization: 'scoped-approval' });
  h.setAck(async () => ({ status: 'OK' })); await actions.flushPendingActions();
  assert.equal(h.emitted[1].payload.actionId, original.actionId); assert.equal(h.emitted[1].payload.stockAuthorization, 'scoped-approval');
  assert.equal((await queue.getPendingActions()).length, 0);
});

test('report dates use the restaurant day during the hours when UTC is still yesterday', () => {
  const { businessDate, calendarDate } = browserHarness().load('services/businessDate.ts');
  assert.equal(businessDate(new Date('2026-10-14T20:00:00Z')), '2026-10-15');
  assert.equal(businessDate(new Date('2026-10-14T18:29:00Z')), '2026-10-14');
  const date = calendarDate('2026-10-15'); assert.equal(date.getDate(), 15); assert.equal(date.getMonth(), 9);
});

test('old waste and delivery snapshots stay available for review without being replayed', async () => {
  const h = browserHarness(), queue = h.load('services/offlineQueue.ts'), actions = h.load('services/socket.ts');
  await queue.enqueueAction('sync_waste', [{ id: 'old-waste', quantity: 1 }]);
  await queue.enqueueAction('sync_delivery_orders', [{ id: 'old-delivery' }]);
  await actions.flushPendingActions();
  assert.equal(h.emitted.length, 0); assert.equal((await queue.getPendingActions()).length, 0);
  assert.equal((await queue.getRecoveryActions()).length, 2);
});
