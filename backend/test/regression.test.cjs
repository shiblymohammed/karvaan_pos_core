const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karvaan-regression-'));
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db')}`;
process.env.JWT_SECRET = 'isolated-regression-test-secret';
process.env.RESTAURANT_ID = 'restaurant-a';
process.env.CLOUD_SYNC_API_KEY = 'restaurant-a-test-key';
process.env.CLOUD_SYNC_KEYS = JSON.stringify({ 'restaurant-a': 'restaurant-a-test-key', 'restaurant-b': 'restaurant-b-test-key' });
process.env.IS_CLOUD = 'true';
process.env.NODE_ENV = 'test';
require('ts-node/register/transpile-only');
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { PrismaService } = require('../src/prisma/prisma.service');
const { AuthService } = require('../src/auth/auth.service');
const { BillingService } = require('../src/billing/billing.service');
const { KdsGateway } = require('../src/kds/kds.gateway');
const { BackupService } = require('../src/backup/backup.service');
const { SyncService } = require('../src/sync/sync.service');
const { JwtService } = require('@nestjs/jwt');
const { io } = require('../../frontend/node_modules/socket.io-client');
let app, prisma, url, adminToken, cashierToken, schemaSql;
const checkout = (suffix = '1') => ({ billNumber: `BILL-${suffix}`, orderNumber: `ORDER-${suffix}`, orderType: 'DINE_IN', grandTotal: 210, items: [{ productId: 'product-a', quantity: 2 }], paymentMethod: 'CASH' });

before(async () => {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.resolve('prisma/schema.prisma'), '--script'], { env: process.env, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  schemaSql = result.stdout;
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  prisma = app.get(PrismaService);
  await prisma.$connect();
  for (const statement of result.stdout.split(';').filter(sql => sql.trim())) await prisma.$executeRawUnsafe(statement);
  await prisma.user.create({ data: { id: 'owner', name: 'Owner', username: 'owner', password: 'owner-password', role: 'OWNER' } });
  for (const suffix of ['a', 'b']) {
    await prisma.restaurant.create({ data: { id: `restaurant-${suffix}`, name: suffix, ownerId: 'owner' } });
    await prisma.user.create({ data: { id: `admin-${suffix}`, name: `Admin ${suffix}`, username: `admin-${suffix}`, password: 'test-password', pin: '1234', role: 'ADMIN', restaurantId: `restaurant-${suffix}` } });
    await prisma.category.create({ data: { id: `category-${suffix}`, name: 'Main', restaurantId: `restaurant-${suffix}` } });
    await prisma.product.create({ data: { id: `product-${suffix}`, name: 'Meal', price: 100, categoryId: `category-${suffix}`, restaurantId: `restaurant-${suffix}` } });
    await prisma.inventoryItem.create({ data: { id: `stock-${suffix}`, name: 'Rice', category: 'General', currentStock: 10, restaurantId: `restaurant-${suffix}` } });
    await prisma.recipeIngredient.create({ data: { productId: `product-${suffix}`, inventoryItemId: `stock-${suffix}`, quantity: 1, unit: 'kg' } });
  }
  await prisma.user.create({ data: { id: 'cashier-a', name: 'Cashier', username: 'cashier-a', password: 'test-password', role: 'CASHIER', restaurantId: 'restaurant-a' } });
  await prisma.user.create({ data: { id: 'inactive', name: 'Inactive', username: 'inactive', password: 'test-password', role: 'ADMIN', isActive: false, restaurantId: 'restaurant-a' } });
  await prisma.user.create({ data: { id: 'pin-only', name: 'PIN', username: 'pin-only', pin: '4321', role: 'WAITER', restaurantId: 'restaurant-a' } });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  adminToken = (await app.get(AuthService).login('admin-a', 'test-password')).accessToken;
  cashierToken = (await app.get(AuthService).login('cashier-a', 'test-password')).accessToken;
});
after(async () => { if (app) await app.close(); });

test('login rejects omitted credentials, inactive accounts, and absent password fields', async () => {
  const auth = app.get(AuthService);
  await assert.rejects(auth.login('admin-a'), /required/);
  await assert.rejects(auth.login('inactive', 'test-password'), /Invalid credentials/);
  await assert.rejects(auth.login('pin-only', 'not-a-password'), /Invalid credentials/);
  assert.ok((await auth.login('pin-only', undefined, '4321')).accessToken);
  assert.match((await prisma.user.findUnique({ where: { id: 'pin-only' } })).pin, /^\$2[ab]\$/);
});

test('administrative HTTP routes require an authenticated authorized restaurant user', async () => {
  for (const [route, method] of [['/backup/settings', 'GET'], ['/upload', 'POST'], ['/sync/trigger', 'POST']]) {
    assert.equal((await fetch(url + route, { method })).status, 401);
  }
  assert.equal((await fetch(url + '/settings', { method: 'PUT', headers: { Authorization: `Bearer ${cashierToken}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url + '/settings', { headers: { Authorization: `Bearer ${adminToken}` } })).status, 200);
});

test('a valid token cannot join another restaurant room', async () => {
  const socket = io(url, { transports: ['websocket'], reconnection: false, auth: { token: adminToken, restaurantId: 'restaurant-b' } });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection was not rejected')), 5000);
      socket.on('sync_master_state', () => { clearTimeout(timer); reject(new Error('Cross-tenant state was exposed')); });
      socket.on('disconnect', () => { clearTimeout(timer); resolve(); });
      socket.on('connect_error', () => { clearTimeout(timer); resolve(); });
    });
  } finally { socket.disconnect(); }
});

test('authorized sockets receive safe tenant state and acknowledge failed checkout without a success event', async () => {
  const socket = io(url, { transports: ['websocket'], reconnection: false, auth: { token: adminToken, restaurantId: 'restaurant-a' } });
  try {
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Authorized socket did not receive state')), 5000);
      socket.on('sync_master_state', data => { clearTimeout(timer); resolve(data); });
      socket.on('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    assert.ok(state.products.every(product => product.restaurantId === 'restaurant-a'));
    assert.ok(state.staffMembers.every(member => !member.password && !member.pin));
    let broadcast = false;
    socket.on('bill_settled', () => { broadcast = true; });
    const ack = await socket.timeout(5000).emitWithAck('settle_bill', { ...checkout('socket-bad'), grandTotal: 1 });
    assert.equal(ack.status, 'ERROR');
    assert.equal(broadcast, false);
  } finally { socket.disconnect(); }
});

test('revoking a user invalidates an already issued token', async () => {
  await prisma.user.update({ where: { id: 'cashier-a' }, data: { isActive: false } });
  try {
    assert.equal((await fetch(url + '/settings', { headers: { Authorization: `Bearer ${cashierToken}` } })).status, 401);
  } finally { await prisma.user.update({ where: { id: 'cashier-a' }, data: { isActive: true } }); }
});

test('cashiers cannot synchronize staff or create global privileges', async () => {
  const client = { handshake: { auth: { token: cashierToken, restaurantId: 'restaurant-a' } }, data: {} };
  const response = await app.get(KdsGateway).handleSyncStaff([{ id: 'cashier-a', name: 'Cashier', role: 'SUPER_ADMIN' }], client);
  assert.equal(response.status, 'ERROR');
  assert.equal((await prisma.user.findUnique({ where: { id: 'cashier-a' } })).role, 'CASHIER');
});

test('failed checkout returns an error without a success broadcast or partial writes', async () => {
  const client = { handshake: { auth: { token: adminToken, restaurantId: 'restaurant-a' } }, data: {} };
  const response = await app.get(KdsGateway).handleSettleBill({ ...checkout('bad'), items: [{ productId: 'product-b', quantity: 2 }] }, client);
  assert.equal(response.status, 'ERROR');
  assert.equal(await prisma.bill.count({ where: { billNumber: 'BILL-bad' } }), 0);
  assert.equal(await prisma.order.count({ where: { orderNumber: 'ORDER-bad' } }), 0);
});

test('checkout calculates catalogue totals, validates discounts, and rejects tampering', async () => {
  const billing = app.get(BillingService);
  await assert.rejects(billing.processDirectCheckout({ ...checkout('tamper'), grandTotal: 1 }, 'restaurant-a', 'admin-a'), /Prices or charges/);
  await assert.rejects(billing.processDirectCheckout({ ...checkout('negative'), items: [{ productId: 'product-a', quantity: -1 }] }, 'restaurant-a', 'admin-a'), /quantity/);
  await assert.rejects(billing.processDirectCheckout({ ...checkout('discount'), discount: 10, grandTotal: 199.5 }, 'restaurant-a', 'cashier-a'), /Discount permission/);
  const bill = await billing.processDirectCheckout(checkout(), 'restaurant-a', 'admin-a');
  assert.equal(bill.subtotal, 200);
  assert.equal(bill.grandTotal, 210);
  assert.equal(bill.cashierId, 'admin-a');
});

test('replaying a committed checkout creates one bill and deducts stock once', async () => {
  const billing = app.get(BillingService);
  const bill = await billing.processDirectCheckout(checkout(), 'restaurant-a', 'admin-a');
  assert.equal(bill.billNumber, 'BILL-1');
  assert.equal(await prisma.bill.count({ where: { billNumber: 'BILL-1' } }), 1);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock, 8);
  assert.equal(await prisma.stockLog.count({ where: { itemId: 'stock-a' } }), 1);
});

test('kitchen ticket retries do not duplicate persisted order items', async () => {
  const ticket = { id: 'ticket-1', orderNumber: 'KITCHEN-1', items: [{ productId: 'product-a', quantity: 1 }] };
  const billing = app.get(BillingService);
  const first = await billing.saveKitchenOrder(ticket, 'restaurant-a', 'admin-a');
  const retry = await billing.saveKitchenOrder(ticket, 'restaurant-a', 'admin-a');
  assert.equal(first.id, retry.id);
  assert.equal(await prisma.orderItem.count({ where: { orderId: first.id } }), 1);
});

test('sync credentials are private and bound to one restaurant', async () => {
  const sync = app.get(SyncService);
  assert.throws(() => sync.authenticate('Bearer restaurant-a-test-key', 'restaurant-b'), /Invalid restaurant/);
  assert.throws(() => sync.authenticate('Bearer default_demo_key', 'restaurant-a'), /Invalid restaurant/);
  sync.authenticate('Bearer restaurant-a-test-key', 'restaurant-a');
});

test('sync rejects foreign records and retains dependent order items', async () => {
  const sync = app.get(SyncService);
  const now = new Date().toISOString();
  await assert.rejects(sync.receiveSyncData({ restaurantId: 'restaurant-a', data: { categories: [{ id: 'category-b', restaurantId: 'restaurant-a', name: 'Hijack', sortOrder: 0, updatedAt: now }] } }), /overwrite/);
  await sync.receiveSyncData({ restaurantId: 'restaurant-a', data: {
    orders: [{ id: 'cloud-order', restaurantId: 'restaurant-a', orderNumber: 'CLOUD-ORDER', orderType: 'DINE_IN', status: 'RECEIVED', totalAmount: 100, discount: 0, createdAt: now, updatedAt: now }],
    orderItems: [{ id: 'cloud-item', orderId: 'cloud-order', productId: 'product-a', quantity: 1, price: 100, status: 'NEW', createdAt: now, updatedAt: now }],
  } });
  assert.equal(await prisma.orderItem.count({ where: { orderId: 'cloud-order' } }), 1);
});

test('backup settings and logs are tenant-scoped', async () => {
  const backup = app.get(BackupService);
  const settings = await backup.getSettings('restaurant-a');
  assert.ok(settings.location.startsWith(directory));
  assert.ok(settings.location.endsWith('restaurant-a'));
  await assert.rejects(backup.updateSettings({ enabled: true, time: '25:00', location: directory }, 'restaurant-a'), /Valid backup/);
  assert.deepEqual(await backup.getBackupLogs('restaurant-b'), []);
  await assert.rejects(backup.updateSettings({ enabled: true, time: '03:00', location: path.resolve('uploads/private') }, 'restaurant-a'), /public uploads/);
});

test('multi-restaurant backups export only the requesting tenant', async () => {
  const backup = app.get(BackupService);
  const result = await backup.triggerManualBackup('restaurant-a');
  assert.match(result.filename, /\.json\.gz$/);
  const settings = await backup.getSettings('restaurant-a');
  const content = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(settings.location, result.filename))));
  assert.equal(content.restaurantId, 'restaurant-a');
  assert.ok(content.data.users.every(user => user.restaurantId === 'restaurant-a'));
  assert.ok(content.data.products.every(product => product.restaurantId === 'restaurant-a'));
  assert.ok(!JSON.stringify(content).includes('product-b'));
  assert.ok(content.data.bills.some(bill => bill.billNumber === 'BILL-1'));
});

test('single-restaurant backups snapshot the active SQLite database including WAL commits', async () => {
  const { PrismaClient } = require('@prisma/client');
  const active = path.join(directory, 'single.db');
  const db = new PrismaClient({ datasources: { db: { url: `file:${active}` } } });
  const originalUrl = process.env.DATABASE_URL;
  let restored;
  try {
    await db.$connect();
    for (const statement of schemaSql.split(';').filter(sql => sql.trim())) await db.$executeRawUnsafe(statement);
    await db.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await db.user.create({ data: { id: 'single-owner', name: 'Owner', role: 'OWNER' } });
    await db.restaurant.create({ data: { id: 'single-restaurant', name: 'Latest committed data', ownerId: 'single-owner' } });
    process.env.DATABASE_URL = `file:${active}`;
    const backup = new BackupService(db, {});
    const result = await backup.triggerManualBackup('single-restaurant');
    const settings = await backup.getSettings('single-restaurant');
    const target = path.join(directory, 'restored.db');
    fs.writeFileSync(target, require('node:zlib').gunzipSync(fs.readFileSync(path.join(settings.location, result.filename))));
    restored = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
    assert.equal((await restored.restaurant.findUnique({ where: { id: 'single-restaurant' } })).name, 'Latest committed data');
  } finally {
    process.env.DATABASE_URL = originalUrl;
    await restored?.$disconnect();
    await db.$disconnect();
  }
});
