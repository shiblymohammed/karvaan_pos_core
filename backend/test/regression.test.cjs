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
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
process.env.CLOUDINARY_URL = '';
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
const { TenantService } = require('../src/tenant/tenant.service');
const { WorkflowService } = require('../src/billing/workflow.service');
const { SettingsService } = require('../src/settings/settings.service');
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
  app.useStaticAssets(process.env.UPLOAD_DIR, { prefix: '/uploads/' });
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
  adminToken = (await app.get(AuthService).login('admin-a', 'test-password')).accessToken;
  cashierToken = (await app.get(AuthService).login('cashier-a', 'test-password')).accessToken;
});
after(async () => { if (app) await app.close(); });

async function configFixture(suffix) {
  const restaurantId = `config-${suffix}`, id = `config-admin-${suffix}`;
  await prisma.restaurant.create({ data: { id: restaurantId, name: 'Concurrent editing fixture', ownerId: 'owner' } });
  await prisma.user.create({ data: { id, name: 'Config Admin', username: id, password: 'test-password', pin: '1234', role: 'ADMIN', restaurantId } });
  await prisma.category.create({ data: { id: `config-category-${suffix}`, name: 'Config', restaurantId } });
  await prisma.product.create({ data: { id: `config-product-${suffix}`, name: 'Config Meal', price: 10, categoryId: `config-category-${suffix}`, restaurantId } });
  await prisma.inventoryItem.create({ data: { id: `config-stock-${suffix}`, name: 'Config Stock', category: 'General', currentStock: 10, restaurantId } });
  const token = (await app.get(AuthService).login(id, 'test-password')).accessToken;
  return { user: { id, restaurantId }, client: { handshake: { auth: { token, restaurantId } }, data: {} }, token, productId: `config-product-${suffix}`, stockId: `config-stock-${suffix}` };
}

test('settings compare server versions and idempotent retries never overwrite a later edit', async () => {
  const fixture = await configFixture('settings'), service = app.get(SettingsService);
  const initial = await service.getSettings(fixture.user.restaurantId);
  const original = { actionId: 'settings-first', expectedRevision: initial.serverRevision, orderPrefix: 'FIRST', parcelChargeAmount: 2 };
  assert.equal((await service.updateSettings(original, fixture.user.restaurantId)).serverRevision, 1);
  await assert.rejects(service.updateSettings({ ...original, actionId: 'settings-stale', orderPrefix: 'STALE' }, fixture.user.restaurantId), /changed on another terminal/);
  assert.equal((await service.getSettings(fixture.user.restaurantId)).orderPrefix, 'FIRST');
  await service.updateSettings({ actionId: 'settings-new', expectedRevision: 1, orderPrefix: 'NEW' }, fixture.user.restaurantId);
  await service.updateSettings(original, fixture.user.restaurantId);
  const final = await service.getSettings(fixture.user.restaurantId);
  assert.equal(final.orderPrefix, 'NEW'); assert.equal(final.serverRevision, 2);
  const stale = await fetch(url + '/settings', { method: 'PUT', headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ actionId: 'http-stale-settings', expectedRevision: 0, orderPrefix: 'BAD' }) });
  assert.equal(stale.status, 409);
  assert.equal((await app.get(KdsGateway).handleUpdateSettings({ actionId: 'socket-settings', expectedRevision: 2, settings: { orderPrefix: 'SOCKET' } }, fixture.client)).status, 'OK');
  await assert.rejects(service.updateSettings({ orderPrefix: 'UNVERSIONED' }, fixture.user.restaurantId), /stable action ID and revision/);
});

test('concurrent settings saves produce a single winner without partial table updates', async () => {
  const fixture = await configFixture('simultaneous-settings'), service = app.get(SettingsService);
  const results = await Promise.allSettled(['one', 'two'].map(name => service.updateSettings({ actionId: name, expectedRevision: 0, orderPrefix: name, tableConfig: [{ id: `config-table-${name}`, number: name, capacity: 2 }] }, fixture.user.restaurantId)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await prisma.table.count({ where: { restaurantId: fixture.user.restaurantId } }), 1);
  assert.equal((await service.getSettings(fixture.user.restaurantId)).serverRevision, 1);
});

test('stale staff edits cannot remove newer staff, and retries preserve the latest roster', async () => {
  const fixture = await configFixture('staff'), gateway = app.get(KdsGateway), workflow = app.get(WorkflowService);
  const baseline = await workflow.adminConfig(fixture.user.restaurantId);
  const first = { actionId: 'staff-first', expectedRevision: 0, staff: [...baseline.staff, { id: 'config-new-staff', username: 'config-new-staff', name: 'New Cashier', role: 'CASHIER', pin: '5678', isActive: true }] };
  assert.equal((await gateway.handleSyncStaff(first, fixture.client)).status, 'OK');
  const stale = await gateway.handleSyncStaff({ actionId: 'staff-stale', expectedRevision: 0, staff: baseline.staff }, fixture.client);
  assert.equal(stale.code, 409);
  assert.equal((await prisma.user.findUnique({ where: { id: 'config-new-staff' } })).isActive, true);
  const current = await workflow.adminConfig(fixture.user.restaurantId);
  assert.equal(current.staffRevision, 1);
  assert.ok(current.staff.every(row => row.pin === '' && !('password' in row)));
  assert.equal((await gateway.handleSyncStaff({ actionId: 'staff-second', expectedRevision: 1, staff: current.staff.map(row => row.id === 'config-new-staff' ? { ...row, name: 'Latest Name' } : row) }, fixture.client)).status, 'OK');
  assert.equal((await gateway.handleSyncStaff(first, fixture.client)).status, 'OK');
  assert.equal((await prisma.user.findUnique({ where: { id: 'config-new-staff' } })).name, 'Latest Name');
  assert.ok((await app.get(AuthService).login('config-new-staff', undefined, '5678')).accessToken);
  assert.equal((await gateway.handleSyncStaff({ actionId: 'duplicate-staff-username', expectedRevision: 2, staff: [...(await workflow.adminConfig(fixture.user.restaurantId)).staff, { id: 'config-duplicate-staff', username: 'config-new-staff', name: 'Duplicate', role: 'CASHIER', pin: '1234' }] }, fixture.client)).code, 409);
  assert.equal((await gateway.handleSyncStaff(baseline.staff, fixture.client)).status, 'ERROR');
});

test('recipe versions reject stale replacement and ingredient removal invalidates older recipes', async () => {
  const fixture = await configFixture('recipes'), gateway = app.get(KdsGateway), workflow = app.get(WorkflowService);
  const first = { actionId: 'recipe-first', expectedRevision: 0, recipes: [{ menuItemId: fixture.productId, menuItemName: 'Config Meal', ingredients: [{ ingredientId: fixture.stockId, quantity: 1 }] }] };
  assert.equal((await gateway.handleSyncRecipes(first, fixture.client)).status, 'OK');
  assert.equal((await gateway.handleSyncRecipes({ actionId: 'recipe-stale', expectedRevision: 0, recipes: [] }, fixture.client)).code, 409);
  assert.equal((await workflow.adminConfig(fixture.user.restaurantId)).recipes[0].ingredients[0].quantity, 1);
  const second = { ...first, actionId: 'recipe-second', expectedRevision: 1, recipes: [{ ...first.recipes[0], ingredients: [{ ingredientId: fixture.stockId, quantity: 2 }] }] };
  assert.equal((await gateway.handleSyncRecipes(second, fixture.client)).status, 'OK');
  assert.equal((await gateway.handleSyncRecipes(first, fixture.client)).status, 'OK');
  assert.equal((await workflow.adminConfig(fixture.user.restaurantId)).recipes[0].ingredients[0].quantity, 2);
  await workflow.inventory({ actionId: 'recipe-stock-remove', changes: [{ id: fixture.stockId, remove: true, expectedRevision: 0 }] }, fixture.user);
  assert.equal((await workflow.adminConfig(fixture.user.restaurantId)).recipeRevision, 3);
  assert.equal((await gateway.handleSyncRecipes({ ...second, actionId: 'recipe-after-removal' }, fixture.client)).code, 409);
  assert.equal((await gateway.handleSyncRecipes({ ...second, actionId: 'recipe-inactive-stock', expectedRevision: 3 }, fixture.client)).status, 'ERROR');
  assert.equal(await prisma.recipeIngredient.count({ where: { productId: fixture.productId } }), 0);
  const api = await fetch(url + '/billing/admin-config', { headers: { Authorization: `Bearer ${fixture.token}` } });
  assert.equal(api.status, 200); assert.equal((await api.json()).recipeRevision, 3);
  assert.equal((await fetch(url + '/billing/admin-config', { headers: { Authorization: `Bearer ${cashierToken}` } })).status, 403);
});

async function stockChallenge(operation) {
  try { await operation(); assert.fail('Expected a stock approval challenge'); }
  catch (error) { const details = error.getResponse?.(); assert.equal(details?.reason, 'STOCK_APPROVAL_REQUIRED'); return details; }
}

test('short sales require a scoped manager approval and audit the stock exception once', async () => {
  const fixture = await configFixture('stock-approval'), billing = app.get(BillingService), auth = app.get(AuthService);
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 1, costPrice: 2 } });
  await prisma.recipeIngredient.create({ data: { productId: fixture.productId, inventoryItemId: fixture.stockId, quantity: 2, unit: 'pcs' } });
  const sale = { billNumber: 'STOCK-APPROVAL', orderNumber: 'STOCK-ORDER', orderType: 'DINE_IN', items: [{ productId: fixture.productId, quantity: 1 }], grandTotal: 10.5, paymentMethod: 'CASH' };
  const challenge = await stockChallenge(() => billing.processDirectCheckout(sale, fixture.user.restaurantId, fixture.user.id));
  assert.equal(challenge.shortages[0].shortfall, 1);
  assert.equal(await prisma.bill.count({ where: { restaurantId: fixture.user.restaurantId } }), 0);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, 1);
  await assert.rejects(auth.authorizeStockShortage({ ...fixture.user, restaurantId: 'restaurant-b' }, { challenge: challenge.stockChallenge, pin: '1234', reason: 'Verified stock count differs' }), /Invalid stock approval/);
  await assert.rejects(auth.authorizeStockShortage(fixture.user, { challenge: challenge.stockChallenge, pin: '1234', reason: 'x' }), /reason/);
  const approvalResponse = await fetch(url + '/auth/authorize-stock-shortage', { method: 'POST', headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: challenge.stockChallenge, pin: '1234', reason: 'Verified stock count differs' }) });
  assert.equal(approvalResponse.status, 201);
  const grant = await approvalResponse.json();
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, billNumber: 'DIFFERENT-BILL', stockAuthorization: grant.authorization }, fixture.user.restaurantId, fixture.user.id));
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, items: [{ productId: fixture.productId, quantity: 2 }], grandTotal: 21, stockAuthorization: grant.authorization }, fixture.user.restaurantId, fixture.user.id));
  await billing.processDirectCheckout({ ...sale, stockAuthorization: grant.authorization }, fixture.user.restaurantId, fixture.user.id);
  await billing.processDirectCheckout(sale, fixture.user.restaurantId, fixture.user.id);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, -1);
  const logs = await prisma.stockLog.findMany({ where: { itemId: fixture.stockId } });
  assert.equal(logs.length, 1); assert.equal(logs[0].reason, 'MANAGER_APPROVED_SHORTAGE');
  assert.equal(JSON.parse(logs[0].notes).approvedBy, fixture.user.id);
  const audit = await prisma.systemSetting.findMany({ where: { restaurantId: fixture.user.restaurantId, settingKey: { startsWith: 'stock_override:' } } });
  assert.equal(audit.length, 1); assert.equal(JSON.parse(audit[0].data).reason, 'Verified stock count differs');
});

test('a worsening stock shortage or revoked manager requires fresh approval', async () => {
  const fixture = await configFixture('stock-change'), billing = app.get(BillingService), auth = app.get(AuthService);
  const cashier = { id: 'stock-shortage-cashier', restaurantId: fixture.user.restaurantId };
  await prisma.user.create({ data: { ...cashier, name: 'Cashier', role: 'CASHIER' } });
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 1 } });
  await prisma.recipeIngredient.create({ data: { productId: fixture.productId, inventoryItemId: fixture.stockId, quantity: 2, unit: 'pcs' } });
  const sale = { billNumber: 'WORSENING-STOCK', orderNumber: 'WORSENING-ORDER', items: [{ productId: fixture.productId, quantity: 1 }], grandTotal: 10.5 };
  const challenge = await stockChallenge(() => billing.processDirectCheckout(sale, cashier.restaurantId, cashier.id));
  const grant = await auth.authorizeStockShortage(cashier, { challenge: challenge.stockChallenge, pin: '1234', reason: 'Physical count checked' });
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, stockAuthorization: grant.authorization }, fixture.user.restaurantId, fixture.user.id));
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 0 } });
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, stockAuthorization: grant.authorization }, cashier.restaurantId, cashier.id));
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 1 } });
  await prisma.user.update({ where: { id: fixture.user.id }, data: { isActive: false } });
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, stockAuthorization: grant.authorization }, cashier.restaurantId, cashier.id));
  assert.equal(await prisma.bill.count({ where: { restaurantId: cashier.restaurantId } }), 0);
  const context = app.get(JwtService).verify(grant.authorization); delete context.iat; delete context.exp;
  const expired = app.get(JwtService).sign(context, { expiresIn: -1 });
  await stockChallenge(() => billing.processDirectCheckout({ ...sale, stockAuthorization: expired }, cashier.restaurantId, cashier.id));
});

test('delivery dispatch shortages return a retryable challenge through the socket gateway', async () => {
  const fixture = await configFixture('delivery-shortage'), gateway = app.get(KdsGateway), auth = app.get(AuthService);
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 0 } });
  await prisma.recipeIngredient.create({ data: { productId: fixture.productId, inventoryItemId: fixture.stockId, quantity: 1, unit: 'pcs' } });
  const delivery = { actionId: 'dispatch-short-stock', orderNumber: 'SHORT-DISPATCH', billNumber: 'SHORT-DISPATCH-BILL', orderType: 'DELIVERY', items: [{ productId: fixture.productId, quantity: 1 }], grandTotal: 10.5 };
  const response = await gateway.handleCreateDelivery(delivery, fixture.client);
  assert.equal(response.code, 409); assert.equal(response.reason, 'STOCK_APPROVAL_REQUIRED');
  assert.equal(await prisma.deliveryOrder.count({ where: { restaurantId: fixture.user.restaurantId } }), 0);
  const grant = await auth.authorizeStockShortage(fixture.user, { challenge: response.stockChallenge, pin: '1234', reason: 'Confirmed extra uncounted ingredient' });
  assert.equal((await gateway.handleCreateDelivery({ ...delivery, stockAuthorization: grant.authorization }, fixture.client)).status, 'OK');
  assert.equal((await gateway.handleCreateDelivery(delivery, fixture.client)).status, 'OK');
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, -1);
  assert.equal(await prisma.stockLog.count({ where: { itemId: fixture.stockId } }), 1);
});

test('recipe waste allowance and instructions survive reload and match consumption snapshots', async () => {
  const fixture = await configFixture('recipe-allowance'), gateway = app.get(KdsGateway), workflow = app.get(WorkflowService);
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { currentStock: 100, costPrice: 2 } });
  const recipe = { menuItemId: fixture.productId, menuItemName: 'Config Meal', ingredients: [{ ingredientId: fixture.stockId, quantity: 10, wasteFactorPercent: 20 }], prepInstructions: 'Keep chilled until cooking.', batchSize: 2 };
  assert.equal((await gateway.handleSyncRecipes({ actionId: 'allowance-recipe', expectedRevision: 0, recipes: [recipe] }, fixture.client)).status, 'OK');
  const reloaded = (await workflow.adminConfig(fixture.user.restaurantId)).recipes[0];
  assert.equal(reloaded.prepInstructions, recipe.prepInstructions); assert.equal(reloaded.batchSize, 2); assert.equal(reloaded.ingredients[0].wasteFactorPercent, 20);
  const bill = await app.get(BillingService).processDirectCheckout({ billNumber: 'ALLOWANCE-BILL', orderNumber: 'ALLOWANCE-ORDER', items: [{ productId: fixture.productId, quantity: 2 }], grandTotal: 21 }, fixture.user.restaurantId, fixture.user.id);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, 76);
  assert.equal(JSON.parse(bill.invoiceItems)[0].recipe[0].quantity, 12);
  assert.equal((await gateway.handleSyncRecipes({ actionId: 'bad-allowance', expectedRevision: 1, recipes: [{ ...recipe, ingredients: [{ ...recipe.ingredients[0], wasteFactorPercent: -1 }] }] }, fixture.client)).status, 'ERROR');
  await workflow.refund({ actionId: 'allowance-return', billNumber: bill.billNumber, items: [{ id: JSON.parse(bill.invoiceItems)[0].id, quantity: 1 }], reason: 'Cooked portion returned', action: 'WASTE', refundDest: 'CASH' }, { ...fixture.user, role: 'ADMIN' });
  assert.equal((await workflow.wasteState(fixture.user.restaurantId))[0].costLoss, 24);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, 76);
});

test('waste loss and stock deduction are atomic, tenant scoped, and idempotent', async () => {
  const fixture = await configFixture('waste'), workflow = app.get(WorkflowService);
  await prisma.inventoryItem.update({ where: { id: fixture.stockId }, data: { costPrice: 2.5 } });
  const request = { actionId: 'waste-once', ingredientId: fixture.stockId, quantity: 3, reason: 'BURNT', loggedBy: 'Spoofed name' };
  await workflow.recordWaste(request, fixture.user); await workflow.recordWaste(request, fixture.user);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: fixture.stockId } })).currentStock, 7);
  const records = await workflow.wasteState(fixture.user.restaurantId);
  assert.equal(records.length, 1); assert.equal(records[0].costLoss, 7.5); assert.notEqual(records[0].loggedBy, 'Spoofed name');
  assert.equal(await prisma.stockLog.count({ where: { itemId: fixture.stockId } }), 1);
  await assert.rejects(workflow.recordWaste({ ...request, actionId: 'too-much-waste', quantity: 100 }, fixture.user), /exceeds recorded stock/);
  await assert.rejects(workflow.recordWaste({ ...request, actionId: 'foreign-waste', ingredientId: 'stock-b' }, fixture.user), /not found/);
  await assert.rejects(workflow.recordWaste({ ...request, actionId: 'missing-waste-item', ingredientId: undefined }, fixture.user), /valid stock item/);
  assert.equal((await workflow.wasteState(fixture.user.restaurantId)).length, 1);
  const api = await fetch(url + '/billing/waste', { headers: { Authorization: `Bearer ${fixture.token}` } });
  assert.equal(api.status, 200); assert.equal((await api.json())[0].costLoss, 7.5);
});

test('parked board versions advance once for save and removal, while drafts keep their billing metadata', async () => {
  const fixture = await configFixture('parked-version'), workflow = app.get(WorkflowService);
  const action = { actionId: 'parked-version-save', expectedRevision: 0, order: { id: 'parked-version-order', items: [], customerName: 'Guest', customerPhone: '55555', discount: 5, checkoutBillNumber: 'ORIGINAL-INVOICE' } };
  await workflow.park(action, fixture.user); await workflow.park(action, fixture.user);
  const saved = await workflow.parkedSnapshot(fixture.user.restaurantId);
  assert.equal(saved.revision, 1); assert.equal(saved.orders[0].discount, 5); assert.equal(saved.orders[0].customerPhone, '55555');
  const remove = { actionId: 'parked-version-remove', id: action.order.id, expectedRevision: 1 };
  await workflow.park(remove, fixture.user, true); await workflow.park(remove, fixture.user, true);
  const empty = await workflow.parkedSnapshot(fixture.user.restaurantId);
  assert.equal(empty.revision, 2); assert.equal(empty.orders.length, 0);
});

test('manually unavailable menu items reject new orders but still allow already sent food to be billed', async () => {
  const fixture = await configFixture('manual-unavailable'), billing = app.get(BillingService);
  await billing.saveKitchenOrder({ id: 'manual-unavailable-ticket', orderNumber: 'MANUAL-ORDER', items: [{ productId: fixture.productId, quantity: 1 }] }, fixture.user.restaurantId, fixture.user.id);
  await prisma.product.update({ where: { id: fixture.productId }, data: { isAvailable: false } });
  const sale = { billNumber: 'MANUAL-BILL', orderNumber: 'MANUAL-ORDER', items: [{ productId: fixture.productId, quantity: 1, status: 'SENT' }], grandTotal: 10.5 };
  assert.ok(await billing.processDirectCheckout(sale, fixture.user.restaurantId, fixture.user.id));
  await assert.rejects(billing.processDirectCheckout({ ...sale, billNumber: 'NEW-MANUAL-BILL', orderNumber: 'NEW-MANUAL-ORDER' }, fixture.user.restaurantId, fixture.user.id), /marked unavailable/);
});

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

test('menu uploads work without Cloudinary and their returned paths serve the original image', async () => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.append('file', new Blob([image], { type: 'image/png' }), 'menu.png');
  const response = await fetch(url + '/upload?type=menu', {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form,
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.url, /^\/uploads\/[^/]+\.png$/);
  const preview = await fetch(url + result.url);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-type'), /^image\/png/);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), image);
});

test('menu upload validation rejects absent or unsupported files', async () => {
  const headers = { Authorization: `Bearer ${adminToken}` };
  const missing = await fetch(url + '/upload?type=menu', { method: 'POST', headers });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).message, 'File required');
  const form = new FormData();
  form.append('file', new Blob(['invalid'], { type: 'text/plain' }), 'menu.txt');
  const invalid = await fetch(url + '/upload?type=menu', { method: 'POST', headers, body: form });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).message, 'Only image and video files are allowed');
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

test('counter checkout publishes its kitchen ticket and accepts the next kitchen action without refiring the settled sale', async () => {
  const socket = io(url, { transports: ['websocket'], reconnection: false, auth: { token: adminToken, restaurantId: 'restaurant-a' } });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Snapshot was not received')), 5000);
      socket.once('sync_master_state', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    const tickets = [];
    socket.on('kds_new_ticket', ticket => { if (ticket.orderNumber === 'ORDER-counter-kitchen') tickets.push(ticket); });
    const sale = { ...checkout('counter-kitchen'), items: [{ productId: 'product-a', quantity: 2, status: 'NEW' }] };
    const result = await socket.timeout(5000).emitWithAck('settle_bill', sale);
    assert.equal(result.status, 'OK');
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0].status, 'COOKING');
    assert.equal(tickets[0].items[0].productId, 'product-a');
    const ready = { actionId: 'counter-ready', orderId: tickets[0].id, status: 'READY' };
    const next = await socket.timeout(5000).emitWithAck('update_kds_status', ready);
    assert.equal(next.status, 'OK');
    assert.equal((await socket.timeout(5000).emitWithAck('update_kds_status', { ...ready, actionId: 'counter-served', status: 'SERVED' })).status, 'OK');
    assert.equal((await socket.timeout(5000).emitWithAck('update_kds_status', ready)).status, 'OK');
    assert.equal((await socket.timeout(5000).emitWithAck('update_kds_status', { ...ready, actionId: 'counter-stale-ready' })).status, 'ERROR');
    const order = await prisma.order.findUnique({ where: { id: tickets[0].id }, include: { items: true } });
    assert.equal(order.status, 'SERVED');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].quantity, 2);
  } finally { socket.disconnect(); }
});

test('new owner and restaurant admin accounts cannot silently receive a default password', async () => {
  const tenant = app.get(TenantService);
  await assert.rejects(tenant.createOwner({ name: 'Unconfigured', username: 'unconfigured-owner' }), /password/);
  await assert.rejects(tenant.createAdminForRestaurant('restaurant-a', { name: 'Unconfigured', username: 'unconfigured-admin' }, 'owner'), /password/);
});

test('cloud seeding creates only a private hashed super admin and is idempotent', async () => {
  const seedUrl = `file:${path.join(directory, 'seed.db')}`;
  const { PrismaClient } = require('@prisma/client');
  const seedDb = new PrismaClient({ datasources: { db: { url: seedUrl } } });
  try {
    for (const statement of schemaSql.split(';').filter(sql => sql.trim())) await seedDb.$executeRawUnsafe(statement);
    const seed = () => spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', path.resolve('prisma/seed.ts')], {
      env: { ...process.env, DATABASE_URL: seedUrl, SUPER_ADMIN_USERNAME: 'private-admin', SUPER_ADMIN_PASSWORD: 'private-seed-test-password' },
      encoding: 'utf8', timeout: 30000,
    });
    const result = seed();
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes('private-seed-test-password'));
    const users = await seedDb.user.findMany();
    assert.equal(users.length, 1);
    assert.equal(users[0].role, 'SUPER_ADMIN');
    assert.ok(await require('bcryptjs').compare('private-seed-test-password', users[0].password));
    assert.equal(await seedDb.restaurant.count(), 0);
    assert.equal(seed().status, 0);
    assert.equal(await seedDb.user.count(), 1);
  } finally { await seedDb.$disconnect(); }
});

test('credit settlement and partial repayment are durable, tenant scoped, and idempotent', async () => {
  const bill = await app.get(BillingService).processDirectCheckout({ ...checkout('credit'), customerName: 'Credit Guest', customerPhone: '9000000001', tenders: { CASH: 60, CREDIT: 150 }, paymentMethod: 'SPLIT' }, 'restaurant-a', 'admin-a');
  assert.deepEqual(JSON.parse(bill.tenders), { CASH: 60, CREDIT: 150 });
  const workflow = app.get(WorkflowService);
  const user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const entry = (await workflow.ledger('restaurant-a')).find(row => row.billNumber === bill.billNumber);
  assert.equal(entry.amount, 150);
  const payment = { actionId: 'partial-credit-payment', entryId: entry.id, amount: 40, paymentMethod: 'UPI' };
  await workflow.repay(payment, user);
  await workflow.repay(payment, user);
  assert.equal((await workflow.ledger('restaurant-a')).find(row => row.id === entry.id).amount, 110);
  assert.equal(await prisma.ledgerEntry.count({ where: { sourceEntryId: entry.id } }), 1);
  await assert.rejects(workflow.repay({ ...payment, actionId: 'foreign-credit-payment' }, { id: 'admin-b', restaurantId: 'restaurant-b' }), /not found/);
  await assert.rejects(workflow.repay({ ...payment, actionId: 'excess-credit-payment', amount: 111 }, user), /exceeds/);
});

test('delivery dispatch consumes stock once and assigned-rider collection creates one immutable sale', async () => {
  await prisma.user.create({ data: { id: 'rider-a', restaurantId: 'restaurant-a', name: 'Rider', role: 'DELIVERY' } });
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const data = { actionId: 'delivery-dispatch', orderNumber: 'DELIVERY-WORKFLOW', billNumber: 'DELIVERY-BILL', orderType: 'DELIVERY', customerName: 'Delivery Guest', customerPhone: '9000000002', items: [{ productId: 'product-a', quantity: 1 }], deliveryFee: 10, grandTotal: 115 };
  const stock = (await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock;
  const row = await workflow.createDelivery(data, user);
  await workflow.createDelivery(data, user);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock, stock - 1);
  assert.equal(await prisma.bill.count({ where: { billNumber: data.billNumber } }), 0);
  await workflow.updateDelivery({ actionId: 'delivery-prepare', id: row.id, expectedRevision: 0, status: 'READY' }, user);
  await workflow.updateDelivery({ actionId: 'delivery-assign', id: row.id, expectedRevision: 1, status: 'OUT_FOR_DELIVERY', riderId: 'rider-a' }, user);
  const pay = { actionId: 'delivery-collection', id: row.id, amount: 115, paymentMethod: 'CASH', complete: true };
  await assert.rejects(workflow.collectDelivery(pay, { id: 'admin-b', restaurantId: 'restaurant-b', role: 'ADMIN' }), /not found/);
  await prisma.product.update({ where: { id: 'product-a' }, data: { price: 150 } });
  try {
    await workflow.collectDelivery(pay, { id: 'rider-a', restaurantId: 'restaurant-a', role: 'DELIVERY' });
    await workflow.collectDelivery(pay, { id: 'rider-a', restaurantId: 'restaurant-a', role: 'DELIVERY' });
    const bill = await prisma.bill.findFirst({ where: { billNumber: data.billNumber } });
    assert.equal(bill.grandTotal, 115);
    assert.equal(JSON.parse(bill.invoiceItems)[0].price, 100);
    assert.equal(await prisma.bill.count({ where: { billNumber: data.billNumber } }), 1);
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock, stock - 1);
    assert.equal((await prisma.deliveryOrder.findUnique({ where: { id: row.id } })).status, 'DELIVERED');
  } finally { await prisma.product.update({ where: { id: 'product-a' }, data: { price: 100 } }); }
});

test('archived deliveries retain split cash custody and remittance is validated and idempotent', async () => {
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  await prisma.user.create({ data: { id: 'rider-remit', restaurantId: 'restaurant-a', name: 'Cash rider', role: 'DELIVERY' } });
  const rider = { id: 'rider-remit', restaurantId: 'restaurant-a', role: 'DELIVERY' };
  const row = await workflow.createDelivery({ actionId: 'remit-dispatch', orderNumber: 'REMIT-ORDER', billNumber: 'REMIT-BILL', orderType: 'DELIVERY', customerName: 'Guest', items: [{ productId: 'product-a', quantity: 1 }], grandTotal: 105 }, user);
  await workflow.kitchenStatus({ actionId: 'remit-ready', orderNumber: 'REMIT-ORDER', status: 'READY' }, user);
  assert.equal((await prisma.deliveryOrder.findUnique({ where: { id: row.id } })).status, 'READY');
  await workflow.updateDelivery({ actionId: 'remit-assign', id: row.id, expectedRevision: 1, status: 'OUT_FOR_DELIVERY', riderId: rider.id }, rider);
  await workflow.updateDelivery({ actionId: 'remit-unassign', id: row.id, expectedRevision: 2, status: 'READY', riderId: null }, rider);
  await workflow.updateDelivery({ actionId: 'remit-reassign', id: row.id, expectedRevision: 3, status: 'OUT_FOR_DELIVERY', riderId: rider.id }, rider);
  await workflow.collectDelivery({ actionId: 'remit-collection', id: row.id, paymentMethod: 'SPLIT', tenders: { CASH: 40, UPI: 65 }, complete: true }, rider);
  const saved = await prisma.deliveryOrder.findUnique({ where: { id: row.id } });
  await workflow.updateDelivery({ actionId: 'remit-archive', id: row.id, expectedRevision: saved.revision, archived: true }, user);
  const summary = await workflow.riderRemittanceSummary(rider.id, user);
  assert.equal(summary.cash, 40); assert.equal(summary.digital, 65); assert.equal(summary.trips, 1);
  const data = { actionId: 'remit-cash', riderId: rider.id, amount: summary.cash, deliveryIds: summary.deliveryIds };
  await assert.rejects(workflow.remitRiderCash(data, rider), /cashier or manager/);
  await assert.rejects(workflow.remitRiderCash({ ...data, amount: 39 }, user), /changed/);
  await assert.rejects(workflow.riderRemittanceSummary(rider.id, { ...user, restaurantId: 'restaurant-b' }), /not found/);
  await workflow.remitRiderCash(data, user); await workflow.remitRiderCash(data, user);
  assert.equal((await workflow.riderRemittanceSummary(rider.id, user)).trips, 0);
  assert.equal(await prisma.systemSetting.count({ where: { restaurantId: 'restaurant-a', settingKey: 'command:rider-remit:remit-cash' } }), 1);
  assert.equal((await prisma.bill.findFirst({ where: { billNumber: 'REMIT-BILL' } })).grandTotal, 105);
});

test('refunds are based on saved invoice lines and cannot duplicate money or inventory', async () => {
  const billing = app.get(BillingService), workflow = app.get(WorkflowService);
  const user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const bill = await billing.processDirectCheckout(checkout('return'), 'restaurant-a', 'admin-a');
  const line = JSON.parse(bill.invoiceItems)[0];
  const stock = (await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock;
  const data = { actionId: 'partial-refund', billNumber: bill.billNumber, items: [{ id: line.id, quantity: 1 }], action: 'RESTOCK', reason: 'Wrong item', refundDest: 'CASH' };
  assert.equal((await workflow.refund(data, user)).totalRefund, 105);
  await workflow.refund(data, user);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock, stock + 1);
  await assert.rejects(workflow.refund({ ...data, actionId: 'too-many-refunds', items: [{ id: line.id, quantity: 2 }] }, user), /exceeds/);
  await assert.rejects(workflow.refund({ ...data, actionId: 'unauthorized-refund' }, { id: 'cashier-a', restaurantId: 'restaurant-a', role: 'CASHIER' }), /authorization/);
  await workflow.refund({ ...data, actionId: 'remaining-refund' }, user);
  assert.equal((await prisma.bill.findUnique({ where: { id: bill.id } })).refundedAmount, 210);
});

test('checkout rejects a stale cart that omits another waiter’s kitchen additions', async () => {
  const billing = app.get(BillingService);
  await billing.saveKitchenOrder({ id: 'shared-kitchen-one', orderNumber: 'SHARED-ORDER', items: [{ productId: 'product-a', quantity: 2 }] }, 'restaurant-a', 'admin-a');
  await billing.saveKitchenOrder({ id: 'shared-kitchen-two', orderNumber: 'SHARED-ORDER', items: [{ productId: 'product-a', quantity: 1 }] }, 'restaurant-a', 'admin-a');
  await assert.rejects(billing.processDirectCheckout({ ...checkout('stale-cart'), orderNumber: 'SHARED-ORDER' }, 'restaurant-a', 'admin-a'), /changed on another terminal/);
  assert.equal(await prisma.bill.count({ where: { billNumber: 'BILL-stale-cart' } }), 0);
  assert.equal((await prisma.orderItem.aggregate({ where: { order: { orderNumber: 'SHARED-ORDER' } }, _sum: { quantity: true } }))._sum.quantity, 3);
});

test('prepaid delivery creates its bill before dispatch and consumes ingredients once', async () => {
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const data = { actionId: 'prepaid-dispatch', orderNumber: 'PREPAID-ORDER', billNumber: 'PREPAID-BILL', orderType: 'DELIVERY', customerName: 'Prepaid Guest', items: [{ productId: 'product-a', quantity: 1 }], paymentStatus: 'COLLECTED', paymentMethod: 'UPI', grandTotal: 105 };
  const before = (await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock;
  await workflow.createDelivery(data, user);
  await workflow.createDelivery(data, user);
  assert.equal((await prisma.bill.findFirst({ where: { billNumber: data.billNumber } })).paymentMethod, 'UPI');
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'stock-a' } })).currentStock, before - 1);
  assert.equal((await prisma.deliveryOrder.findFirst({ where: { orderNumber: data.orderNumber } })).paymentStatus, 'COLLECTED');
});

test('concurrent inventory movements add deltas, deduplicate retries, and reject stale metadata', async () => {
  await prisma.inventoryItem.create({ data: { id: 'concurrent-stock', restaurantId: 'restaurant-a', name: 'Concurrent stock', category: 'General', currentStock: 10 } });
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  await workflow.inventory({ actionId: 'stock-use', changes: [{ id: 'concurrent-stock', delta: -3 }] }, user);
  const purchase = { actionId: 'stock-purchase', changes: [{ id: 'concurrent-stock', delta: 5 }] };
  await workflow.inventory(purchase, user); await workflow.inventory(purchase, user);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: 'concurrent-stock' } })).currentStock, 12);
  await assert.rejects(workflow.inventory({ actionId: 'stale-stock-details', changes: [{ id: 'concurrent-stock', delta: 0, expectedRevision: 0, metadata: { name: 'Wrong', category: 'General', unit: 'kg', costPrice: 1, minThreshold: 2 } }] }, user), /changed on another terminal/);
});

test('resuming one parked order never deletes another terminal’s parked order', async () => {
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  await workflow.park({ actionId: 'park-one', expectedRevision: 0, order: { id: 'parked-one', items: [] } }, user);
  await workflow.park({ actionId: 'park-two', expectedRevision: 0, order: { id: 'parked-two', items: [] } }, user);
  await assert.rejects(workflow.park({ actionId: 'stale-park', expectedRevision: 0, order: { id: 'parked-one', items: [{ quantity: 3 }] } }, user), /changed or resumed/);
  const resume = { actionId: 'resume-one', id: 'parked-one', expectedRevision: 1 };
  await workflow.park(resume, user, true); await workflow.park(resume, user, true);
  assert.deepEqual((await workflow.parkedState('restaurant-a')).map(row => row.id), ['parked-two']);
});

test('inventory PO invoices convert units, preserve supplier details, and receive stock once on retry', async () => {
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  await prisma.inventoryItem.create({ data: { id: 'po-rice', restaurantId: 'restaurant-a', name: 'PO rice', category: 'PRODUCE', unit: 'g', currentStock: 1000 } });
  const data = { actionId: 'rice-po', id: 'po-rice', purchaseUnits: 2, purchaseUnit: 'kg', conversionFactor: 1000, invoiceCost: 120, vendor: 'Rice Supplier' };
  await workflow.receiveInventoryPurchase(data, user); await workflow.receiveInventoryPurchase(data, user);
  const stock = (await workflow.inventoryState('restaurant-a')).find(row => row.id === data.id);
  assert.equal(stock.currentStock, 3000); assert.equal(stock.costPrice, 0.06);
  assert.equal(stock.purchaseUnit, 'kg'); assert.equal(stock.conversionFactor, 1000); assert.equal(stock.lastVendor, 'Rice Supplier');
  const logs = await prisma.stockLog.findMany({ where: { itemId: data.id, reason: 'PURCHASE' } });
  assert.equal(logs.length, 1); assert.equal(JSON.parse(logs[0].notes).invoiceCost, 120);
  await assert.rejects(workflow.receiveInventoryPurchase({ ...data, actionId: 'invalid-po', purchaseUnits: null }, user), /positive/);
  await assert.rejects(workflow.receiveInventoryPurchase({ ...data, actionId: 'foreign-po' }, { ...user, restaurantId: 'restaurant-b' }), /not found/);
  await assert.rejects(workflow.receiveInventoryPurchase({ ...data, actionId: 'changed-conversion', conversionFactor: 10 }, user), /changed/);
  assert.equal((await prisma.inventoryItem.findUnique({ where: { id: data.id } })).currentStock, 3000);
});

test('PO socket commands acknowledge durable purchases and reject another restaurant’s stock', async () => {
  await prisma.inventoryItem.create({ data: { id: 'socket-po-rice', restaurantId: 'restaurant-a', name: 'Socket PO rice', category: 'PRODUCE', unit: 'g', currentStock: 0, purchaseUnit: 'kg', conversionFactor: 1000 } });
  const socket = io(url, { transports: ['websocket'], reconnection: false, auth: { token: adminToken, restaurantId: 'restaurant-a' } });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Restaurant snapshot was not received')), 5000);
      socket.once('sync_master_state', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    const purchase = { actionId: 'socket-po', id: 'socket-po-rice', purchaseUnits: 1, purchaseUnit: 'kg', conversionFactor: 1000, invoiceCost: 60, vendor: 'Supplier' };
    const result = await socket.timeout(5000).emitWithAck('receive_inventory_purchase', purchase);
    assert.equal(result.status, 'OK'); assert.equal(result.data.quantityReceived, 1000);
    assert.equal((await socket.timeout(5000).emitWithAck('receive_inventory_purchase', purchase)).status, 'OK');
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: purchase.id } })).currentStock, 1000);
    assert.equal(await prisma.stockLog.count({ where: { itemId: purchase.id, reason: 'PURCHASE' } }), 1);
    const foreign = await socket.timeout(5000).emitWithAck('receive_inventory_purchase', { ...purchase, actionId: 'socket-po-foreign', id: 'stock-b' });
    assert.equal(foreign.status, 'ERROR'); assert.match(foreign.message, /not found/);
  } finally { socket.disconnect(); }
});

test('stale menu revisions cannot erase newer edits and lost acknowledgments remain idempotent', async () => {
  const gateway = app.get(KdsGateway);
  const client = { handshake: { auth: { token: adminToken, restaurantId: 'restaurant-a' } }, data: {} };
  const data = { actionId: 'menu-one', expectedRevision: 0, categories: [{ id: 'category-a', name: 'Main', sortOrder: 0 }], products: [{ id: 'product-a', name: 'Meal', category: 'Main', price: 100, gstRate: 5 }] };
  assert.equal((await gateway.handleSyncMenu(data, client)).status, 'OK');
  assert.equal((await gateway.handleSyncMenu(data, client)).status, 'OK');
  assert.equal((await gateway.handleSyncMenu({ ...data, actionId: 'stale-menu', products: [] }, client)).status, 'ERROR');
  assert.equal((await prisma.product.findUnique({ where: { id: 'product-a' } })).isAvailable, true);
});

test('menu deletion stays hidden after sync and reconnect while preserving sales and already-sent food', async () => {
  const billing = app.get(BillingService), workflow = app.get(WorkflowService), gateway = app.get(KdsGateway);
  for (const [id, name, isAvailable] of [['delete-menu-used', 'Previously sold item', true], ['delete-menu-unused', 'Unused item', true], ['menu-temporary-86', 'Temporarily unavailable', false]]) {
    await prisma.product.create({ data: { id, name, isAvailable, restaurantId: 'restaurant-b', categoryId: 'category-b', price: 40 } });
  }
  const bill = await billing.processDirectCheckout({ billNumber: 'DELETE-MENU-BILL', orderNumber: 'DELETE-MENU-SALE', items: [{ productId: 'delete-menu-used', quantity: 1 }], grandTotal: 42, paymentMethod: 'CASH' }, 'restaurant-b', 'admin-b');
  await billing.saveKitchenOrder({ id: 'delete-menu-pending', orderNumber: 'DELETE-MENU-PENDING', items: [{ productId: 'delete-menu-used', quantity: 2 }] }, 'restaurant-b', 'admin-b');
  const token = (await app.get(AuthService).login('admin-b', 'test-password')).accessToken;
  const client = { handshake: { auth: { token, restaurantId: 'restaurant-b' } }, data: {} };
  const before = await workflow.menu('restaurant-b');
  const deletion = { actionId: 'delete-menu-items', expectedRevision: before.serverRevision, categories: before.categories, products: before.products.filter(product => !['delete-menu-used', 'delete-menu-unused'].includes(product.id)) };
  assert.equal((await gateway.handleSyncMenu(deletion, client)).status, 'OK');
  assert.equal((await gateway.handleSyncMenu(deletion, client)).status, 'OK');
  const after = await workflow.menu('restaurant-b');
  assert.equal(after.products.some(product => product.id === 'delete-menu-used'), false);
  assert.equal(after.products.some(product => product.id === 'delete-menu-unused'), false);
  assert.equal(after.products.find(product => product.id === 'menu-temporary-86').isAvailable, false);
  assert.equal((await prisma.product.findUnique({ where: { id: 'delete-menu-used' } })).isArchived, true);
  assert.equal((await billing.getOrderHistory('restaurant-b')).find(row => row.id === bill.id).order.items[0].product.name, 'Previously sold item');
  const revived = await gateway.handleSyncMenu({ ...deletion, actionId: 'revive-deleted-menu', expectedRevision: after.serverRevision, products: before.products }, client);
  assert.equal(revived.status, 'ERROR'); assert.match(revived.message, /deleted/);
  await assert.rejects(billing.processDirectCheckout({ billNumber: 'NEW-DELETED-SALE', orderNumber: 'NEW-DELETED-ORDER', items: [{ productId: 'delete-menu-used', quantity: 1 }], grandTotal: 42, paymentMethod: 'CASH' }, 'restaurant-b', 'admin-b'), /deleted/);
  await assert.rejects(billing.processDirectCheckout({ billNumber: 'EXTRA-DELETED-SALE', orderNumber: 'DELETE-MENU-PENDING', items: [{ productId: 'delete-menu-used', quantity: 3 }], grandTotal: 126, paymentMethod: 'CASH' }, 'restaurant-b', 'admin-b'), /deleted/);
  await billing.processDirectCheckout({ billNumber: 'EXISTING-DELETED-SALE', orderNumber: 'DELETE-MENU-PENDING', items: [{ productId: 'delete-menu-used', quantity: 2 }], grandTotal: 84, paymentMethod: 'CASH' }, 'restaurant-b', 'admin-b');
  const socket = io(url, { transports: ['websocket'], reconnection: false, auth: { token, restaurantId: 'restaurant-b' } });
  try {
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Snapshot was not received')), 5000);
      socket.once('sync_master_state', state => { clearTimeout(timer); resolve(state); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    assert.equal(state.products.some(product => product.id === 'delete-menu-used'), false);
    assert.equal(state.products.some(product => product.id === 'menu-temporary-86'), true);
  } finally { socket.disconnect(); }
});

test('replication tombstones keep menu items archived even when newer stale rows arrive', async () => {
  const sync = app.get(SyncService), workflow = app.get(WorkflowService);
  await prisma.product.create({ data: { id: 'replica-deleted-menu', name: 'Deleted replica item', restaurantId: 'restaurant-b', categoryId: 'category-b', price: 10 } });
  await sync.receiveSyncData({ restaurantId: 'restaurant-b', data: { tombstones: [{ model: 'product', id: 'replica-deleted-menu', deletedAt: new Date().toISOString() }] } });
  const saved = await prisma.product.findUnique({ where: { id: 'replica-deleted-menu' } });
  await sync.receiveSyncData({ restaurantId: 'restaurant-b', data: { products: [{ ...saved, isArchived: false, isAvailable: true, updatedAt: new Date(Date.now() + 10000).toISOString() }] } });
  assert.equal((await prisma.product.findUnique({ where: { id: saved.id } })).isArchived, true);
  assert.equal((await workflow.menu('restaurant-b')).products.some(product => product.id === saved.id), false);
});

test('manager refund grants are bound to the cashier, invoice, and action', async () => {
  // These refund tests need physical stock; shortage approvals have isolated fixtures above.
  await prisma.inventoryItem.update({ where: { id: 'stock-a' }, data: { currentStock: 100 } });
  const auth = app.get(AuthService), workflow = app.get(WorkflowService), user = { id: 'cashier-a', restaurantId: 'restaurant-a', role: 'CASHIER' };
  const bill = await app.get(BillingService).processDirectCheckout(checkout('manager-refund'), 'restaurant-a', 'admin-a');
  const line = JSON.parse(bill.invoiceItems)[0];
  const authorization = (await auth.authorizeRefund(user, { pin: '1234', actionId: 'authorized-return', billNumber: bill.billNumber })).authorization;
  const data = { actionId: 'authorized-return', billNumber: bill.billNumber, authorization, items: [{ id: line.id, quantity: 1 }], action: 'WASTE', reason: 'Reviewed return', refundDest: 'CASH' };
  await assert.rejects(workflow.refund({ ...data, actionId: 'another-return' }, user), /authorization/);
  await workflow.refund(data, user);
  await workflow.refund({ ...data, authorization: 'expired-or-lost-token' }, user);
  assert.equal(await prisma.returnRecord.count({ where: { billNumber: bill.billNumber } }), 1);
});

test('standalone add-ons use server catalogue prices and immutable historical item names', async () => {
  const billing = app.get(BillingService);
  const bill = await billing.processDirectCheckout({ billNumber: 'ADDON-BILL', orderNumber: 'ADDON-ORDER', items: [{ productId: 'standalone-a1', quantity: 1 }], grandTotal: 21, paymentMethod: 'CASH' }, 'restaurant-a', 'admin-a');
  const line = JSON.parse(bill.invoiceItems)[0];
  await prisma.product.update({ where: { id: line.productId }, data: { name: 'Renamed later' } });
  const history = await billing.getOrderHistory('restaurant-a');
  assert.equal(history.find(row => row.billNumber === bill.billNumber).order.items[0].product.name, '+ Extra Mayonnaise');
  await assert.rejects(billing.processDirectCheckout({ billNumber: 'SHORT-PAYMENT', orderNumber: 'SHORT-ORDER', items: [{ productId: 'product-a', quantity: 1 }], tenders: { CASH: 104.99 }, paymentMethod: 'CASH' }, 'restaurant-a', 'admin-a'), /Insufficient/);
});

test('ledger refunds reduce credit once without counting the same reduction twice', async () => {
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const bill = await app.get(BillingService).processDirectCheckout({ ...checkout('credit-refund'), customerName: 'Refund Credit Guest', customerPhone: '9000000003', tenders: { CREDIT: 210 }, paymentMethod: 'CREDIT' }, 'restaurant-a', 'admin-a');
  const line = JSON.parse(bill.invoiceItems)[0];
  await workflow.refund({ actionId: 'credit-return', billNumber: bill.billNumber, items: [{ id: line.id, quantity: 1 }], action: 'WASTE', reason: 'Credit adjustment', refundDest: 'LEDGER' }, user);
  const entries = (await workflow.ledger('restaurant-a')).filter(row => row.customerPhone === '9000000003' && row.status === 'UNPAID');
  assert.equal(entries.reduce((sum, row) => sum + row.amount, 0), 105);
  assert.equal((await prisma.customer.findUnique({ where: { restaurantId_mobile: { restaurantId: 'restaurant-a', mobile: '9000000003' } } })).creditBalance, 105);
});

test('split sales and partial refunds preserve exact report totals and tax reversal', async () => {
  const { financialSummary } = require('../src/billing/financial');
  const workflow = app.get(WorkflowService), user = { id: 'admin-a', restaurantId: 'restaurant-a', role: 'ADMIN' };
  const reportTime = new Date('2020-01-02T12:00:00.000Z');
  const bill = await app.get(BillingService).processDirectCheckout({ ...checkout('split-report'), tenders: { CASH: 120, UPI: 90 }, paymentMethod: 'SPLIT' }, 'restaurant-a', 'admin-a');
  const line = JSON.parse(bill.invoiceItems)[0];
  const refund = await workflow.refund({ actionId: 'report-refund', billNumber: bill.billNumber, items: [{ id: line.id, quantity: 1 }], action: 'WASTE', reason: 'Partial return', refundDest: 'CASH' }, user);
  await prisma.bill.update({ where: { id: bill.id }, data: { settledAt: reportTime } });
  await prisma.returnRecord.update({ where: { id: refund.id }, data: { createdAt: reportTime } });
  const report = await financialSummary(prisma, 'restaurant-a', new Date('2020-01-02T00:00:00.000Z'), new Date('2020-01-03T00:00:00.000Z'));
  assert.equal(report.grossRevenue, 210);
  assert.equal(report.netRevenue, 105);
  assert.equal(report.byPayment.CASH, 15);
  assert.equal(report.byPayment.UPI, 90);
  assert.equal(report.refundGst, 5);
});

test('print jobs use validated local targets and send the provided receipt bytes exactly once', async () => {
  const net = require('node:net'); const { PrinterService } = require('../src/printer/printer.service');
  const service = app.get(PrinterService);
  await assert.rejects(service.printJob({ ip: '127.0.0.1', port: 9100, type: 'RECEIPT' }), /Cloud printing/);
  const oldCloud = process.env.IS_CLOUD; process.env.IS_CLOUD = 'false';
  let server;
  try {
    await assert.rejects(service.printJob({ ip: '8.8.8.8', port: 9100, type: 'RECEIPT' }), /Invalid local/);
    let received;
    const data = new Promise(resolve => { received = resolve; });
    server = net.createServer(socket => { const chunks = []; socket.on('data', chunk => chunks.push(chunk)); socket.on('end', () => received(Buffer.concat(chunks))); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const bytes = [27, 64, 82, 101, 99, 101, 105, 112, 116, 10];
    assert.equal(await service.printJob({ ip: '127.0.0.1', port: server.address().port, type: 'RECEIPT', data: bytes }), true);
    assert.deepEqual([...await data], bytes);
  } finally { process.env.IS_CLOUD = oldCloud; if (server) await new Promise(resolve => server.close(resolve)); }
});

test('new restaurants receive backup schedules in the business timezone immediately', async () => {
  const restaurant = await app.get(TenantService).createRestaurant({ name: 'Scheduled restaurant', ownerId: 'owner' });
  try {
    const { SchedulerRegistry } = require('@nestjs/schedule');
    const job = app.get(SchedulerRegistry).getCronJob(`database-backup-${restaurant.id}`);
    assert.equal(job.cronTime.timeZone, 'Asia/Kolkata');
  } finally { await prisma.restaurant.delete({ where: { id: restaurant.id } }); }
});

test('a local database upgrade preserves old rows and creates a readable pre-upgrade restore point', async () => {
  const oldSchema = fs.readFileSync(path.join(__dirname, 'fixtures/previous-schema.prisma'), 'utf8');
  const schema = path.join(directory, 'old-schema.prisma'); fs.writeFileSync(schema, oldSchema);
  const ddl = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script'], { encoding: 'utf8', timeout: 60000, env: process.env });
  assert.equal(ddl.status, 0, ddl.stderr);
  const database = `file:${path.join(directory, 'old-install.db')}`;
  const { PrismaClient } = require('@prisma/client');
  const local = new PrismaClient({ datasources: { db: { url: database } } });
  const upgrades = path.join(directory, 'upgrades');
  try {
    for (const statement of ddl.stdout.split(';').filter(sql => sql.trim())) await local.$executeRawUnsafe(statement);
    await local.$executeRawUnsafe("INSERT INTO User (id, name, role, updatedAt) VALUES ('upgrade-owner', 'Owner', 'OWNER', CURRENT_TIMESTAMP)");
    await local.$executeRawUnsafe("INSERT INTO Restaurant (id, name, ownerId, updatedAt) VALUES ('upgrade-restaurant', 'Restaurant', 'upgrade-owner', CURRENT_TIMESTAMP)");
    await local.$executeRawUnsafe("INSERT INTO InventoryItem (id, name, category, currentStock, unit, minThreshold, costPrice, updatedAt, restaurantId) VALUES ('upgrade-stock', 'Saved stock', 'General', 12, 'kg', 1, 1, CURRENT_TIMESTAMP, 'upgrade-restaurant')");
    await local.$disconnect();
    const { upgradeLocalDatabase } = require('../src/prisma/upgrade-local');
    await upgradeLocalDatabase(database, path.resolve('prisma/schema.prisma'), upgrades);
    assert.equal((await local.inventoryItem.findUnique({ where: { id: 'upgrade-stock' } })).currentStock, 12);
    assert.equal((await local.inventoryItem.findUnique({ where: { id: 'upgrade-stock' } })).revision, 0);
    await upgradeLocalDatabase(database, path.resolve('prisma/schema.prisma'), upgrades);
    const backups = fs.readdirSync(upgrades).filter(name => name.endsWith('.db'));
    assert.equal(backups.length, 1);
    const restoredPath = path.join(directory, 'restored-upgrade.db'); fs.copyFileSync(path.join(upgrades, backups[0]), restoredPath);
    const restored = new PrismaClient({ datasources: { db: { url: `file:${restoredPath}` } } });
    try { assert.equal((await restored.$queryRawUnsafe("SELECT currentStock FROM InventoryItem WHERE id = 'upgrade-stock'"))[0].currentStock, 12); } finally { await restored.$disconnect(); }
  } finally { await local.$disconnect(); }
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
  await assert.rejects(backup.updateSettings({ enabled: true, time: '03:00', location: path.join(process.env.UPLOAD_DIR, 'private') }, 'restaurant-a'), /public uploads/);
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
