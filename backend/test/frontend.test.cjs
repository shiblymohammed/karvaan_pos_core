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
  const uploads = [];
  const socket = { connected: true, on: () => {}, timeout: () => ({ emitWithAck: async (type, payload) => { emitted.push({ type, payload }); return ack(type, payload); } }) };
  const db = {
    add: async (_store, row) => { const id = nextId++; rows.set(id, { ...row, id }); return id; },
    getAllFromIndex: async () => [...rows.values()].sort((a, b) => a.timestamp - b.timestamp || a.id - b.id),
    delete: async (_store, id) => rows.delete(id), get: async (_store, id) => rows.get(id),
    put: async (_store, row) => rows.set(row.id, row),
  };
  const context = vm.createContext({
    console, crypto: require('node:crypto').webcrypto, FormData, Error,
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
      if (name === 'socket.io-client') return { io: () => socket };
      if (name.endsWith('serverConfig')) return { getServerUrl: () => storage.get('server') || 'http://server-a:3001', getOperatingMode: () => 'NODE_SERVER' };
      if (name.endsWith('authFetch')) return { authorizedFetch: async (endpoint, options) => { uploads.push({ endpoint, options }); return uploadResponse; } };
      if (name.endsWith('useSettingsStore')) return { useSettingsStore: { setState: () => {} }, applyRemoteSettings: () => {} };
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
  return { load, storage, rows, emitted, socket, login, uploads, setOrigin: value => { context.window.location.origin = value; }, setUploadResponse: value => { uploadResponse = value; }, setAck: fn => { ack = fn; } };
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

test('a different login cannot flush another cashier’s pending actions', async () => {
  const h = browserHarness(); const actions = h.load('services/socket.ts'); const queue = h.load('services/offlineQueue.ts');
  h.socket.connected = false;
  await actions.emitAction('settle_bill', { billNumber: 'BILL-1' });
  h.login('tenant-b', 'cashier-b'); h.socket.connected = true;
  await actions.flushPendingActions();
  assert.equal(h.emitted.length, 0);
  h.login(); assert.equal((await queue.getPendingActions()).length, 1);
});
