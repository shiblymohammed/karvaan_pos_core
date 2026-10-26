const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
process.env.DATABASE_URL = `file:${path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'karvaan-printing-')), 'test.db')}`;
process.env.JWT_SECRET = 'isolated-printing-test-secret'; process.env.NODE_ENV = 'test'; process.env.IS_CLOUD = 'true';
require('ts-node/register/transpile-only'); require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { PrismaService } = require('../src/prisma/prisma.service');
const { AuthService } = require('../src/auth/auth.service');
const { BillingService } = require('../src/billing/billing.service');
const { WorkflowService } = require('../src/billing/workflow.service');
const { PrintQueueService } = require('../src/printer/print-queue.service');
const { renderPrintDocument } = require('../src/printer/print-document');
let app, db, queue, url, adminToken, cashierToken;
const admin = { id: 'print-admin', restaurantId: 'print-a', role: 'ADMIN' };
async function api(endpoint, token, body, method = 'POST') {
  const response = await fetch(url + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function agentFixture(name) {
  const pairing = await queue.createPairing(admin, name), paired = await queue.pair(pairing.code), agent = await queue.authenticate(`Bearer ${paired.token}`);
  return { paired, agent };
}
async function assign(agent, role = 'RECEIPT', autoPrint = false) {
  const existing = await db.printDestination.findUnique({ where: { restaurantId_role: { restaurantId: admin.restaurantId, role } } });
  return queue.saveDestination(admin, { role, agentId: agent.id, name: role, transport: 'TCP', address: '192.168.1.50', port: 9100, paperWidth: 80, autoPrint, revision: existing?.revision || 0 });
}
async function enqueue(agent, key) {
  await assign(agent);
  return db.$transaction(tx => queue.enqueue(tx, admin.restaurantId, 'RECEIPT', key, { kind: 'TEST', reference: key, createdAt: new Date().toISOString(), items: [] }, admin.id, false));
}
before(async () => {
  const schema = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.resolve('prisma/schema.prisma'), '--script'], { encoding: 'utf8', env: process.env, timeout: 60000 });
  assert.equal(schema.status, 0, schema.stderr);
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false }); db = app.get(PrismaService); await db.$connect();
  for (const statement of schema.stdout.split(';').filter(sql => sql.trim())) await db.$executeRawUnsafe(statement);
  await db.user.create({ data: { id: 'print-owner', name: 'Owner', role: 'OWNER' } });
  for (const suffix of ['a', 'b']) await db.restaurant.create({ data: { id: `print-${suffix}`, name: `Print ${suffix}`, ownerId: 'print-owner' } });
  for (const [id, role] of [['print-admin', 'ADMIN'], ['print-cashier', 'CASHIER']]) await db.user.create({ data: { id, username: id, name: id, password: 'test-password', role, restaurantId: 'print-a' } });
  await db.category.create({ data: { id: 'print-category', name: 'Menu', restaurantId: 'print-a' } });
  await db.product.create({ data: { id: 'print-product', name: 'Meal with a long descriptive name', price: 100, restaurantId: 'print-a', categoryId: 'print-category' } });
  queue = app.get(PrintQueueService); await app.listen(0, '127.0.0.1'); url = await app.getUrl();
  adminToken = (await app.get(AuthService).login('print-admin', 'test-password')).accessToken;
  cashierToken = (await app.get(AuthService).login('print-cashier', 'test-password')).accessToken;
});
after(async () => { if (app) await app.close(); });
test('pairing is single-use, expires, and cashier JWTs cannot impersonate agents or configure printers', async () => {
  const pairing = await api('/printer/queue/pairing', adminToken, { name: 'Counter' }); assert.equal(pairing.status, 201);
  const paired = await api('/printer/agent/pair', null, { code: pairing.body.code }); assert.equal(paired.status, 201);
  assert.equal((await api('/printer/agent/pair', null, { code: pairing.body.code })).status, 401);
  const record = await db.printAgent.findUnique({ where: { id: paired.body.agentId } }); assert.ok(record.tokenHash); assert.equal(record.pairingHash, null); assert.ok(!record.tokenHash.includes(paired.body.token));
  assert.equal((await api('/printer/agent/claim', cashierToken, {})).status, 401);
  assert.equal((await api('/printer/queue/pairing', cashierToken, { name: 'Bad' })).status, 403);
  const expired = await queue.createPairing(admin, 'Expired'); await db.printAgent.update({ where: { id: expired.id }, data: { pairingExpiresAt: new Date(0) } }); await assert.rejects(queue.pair(expired.code), /expired/);
});
test('printer assignments enforce ownership, local targets, and optimistic revisions', async () => {
  const { agent } = await agentFixture('Assignment'); const saved = await assign(agent);
  await assert.rejects(queue.saveDestination(admin, { ...saved, revision: saved.revision - 1 }), /another device/);
  await assert.rejects(queue.saveDestination({ ...admin, restaurantId: 'print-b' }, { ...saved, revision: 0 }), /Pair this computer/);
  await assert.rejects(queue.saveDestination(admin, { ...saved, address: '169.254.169.254' }), /valid local address/);
});
test('durable claims expire safely before sending; after start, lease expiry requires paper review', async () => {
  const { agent } = await agentFixture('Lease'); const job = await enqueue(agent, 'lease');
  const first = (await queue.claim(agent)).job; assert.equal(first.id, job.id);
  assert.equal((await queue.claim(agent)).job, null);
  await db.printJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(0) } });
  const second = (await queue.claim(agent)).job; assert.notEqual(second.claimToken, first.claimToken);
  await assert.rejects(queue.start(agent, job.id, first.claimToken), /expired/);
  await queue.start(agent, job.id, second.claimToken); await queue.start(agent, job.id, second.claimToken);
  await db.printJob.update({ where: { id: job.id }, data: { leaseUntil: new Date(0) } });
  assert.equal((await queue.claim(agent)).job, null);
  assert.equal((await db.printJob.findUnique({ where: { id: job.id } })).state, 'UNCERTAIN');
  await queue.report(agent, job.id, { claimToken: second.claimToken, state: 'SENT' });
  await queue.report(agent, job.id, { claimToken: second.claimToken, state: 'SENT' });
  await assert.rejects(queue.report(agent, job.id, { claimToken: first.claimToken, state: 'FAILED' }), /active claim/);
});
test('simultaneous workers sharing an agent cannot claim two copies of one job', async () => {
  const { agent } = await agentFixture('Concurrent workers'); const job = await enqueue(agent, 'concurrent-worker');
  const results = await Promise.allSettled([queue.claim(agent), queue.claim(agent)]);
  const claimed = results.filter(result => result.status === 'fulfilled' && result.value.job).map(result => result.value.job);
  assert.equal(claimed.length, 1); assert.equal(claimed[0].id, job.id);
  assert.equal(await db.printJob.count({ where: { agentId: agent.id, state: 'CLAIMED' } }), 1);
  assert.equal((await queue.claim(agent)).job, null);
});
test('revocation cancels waiting jobs, disables auto printing, and rejects the old credential', async () => {
  const { agent, paired } = await agentFixture('Revoked'); const job = await enqueue(agent, 'revoke');
  await queue.revoke(admin, agent.id);
  await assert.rejects(queue.authenticate(`Bearer ${paired.token}`), /revoked/);
  assert.equal((await db.printJob.findUnique({ where: { id: job.id } })).state, 'CANCELLED');
  assert.equal((await db.printDestination.findUnique({ where: { restaurantId_role: { restaurantId: 'print-a', role: 'RECEIPT' } } })).autoPrint, false);
});
test('order/payment commit and print jobs are atomic and retries never print a second original', async () => {
  const { agent } = await agentFixture('Transactions'); await assign(agent, 'RECEIPT', true); await assign(agent, 'KITCHEN', true);
  const billing = app.get(BillingService);
  const sale = { billNumber: 'PRINT-BILL', orderNumber: 'PRINT-ORDER', items: [{ productId: 'print-product', quantity: 2, notes: 'No onion please, sauce in a separate container' }], paymentMethod: 'CASH', orderType: 'DINE_IN' };
  await billing.processDirectCheckout(sale, admin.restaurantId, admin.id); await billing.processDirectCheckout(sale, admin.restaurantId, admin.id);
  const receipt = await db.printJob.findMany({ where: { reference: 'PRINT-BILL' } }); assert.equal(receipt.length, 1);
  assert.equal(await db.printJob.count({ where: { reference: 'PRINT-ORDER', kind: 'KOT' } }), 1);
  const count = await db.printJob.count();
  await assert.rejects(billing.processDirectCheckout({ ...sale, billNumber: 'BAD', orderNumber: 'BAD', tenders: { CASH: 1 } }, admin.restaurantId, admin.id));
  assert.equal(await db.printJob.count(), count); assert.equal(await db.bill.count({ where: { billNumber: 'BAD' } }), 0);
  const requested = await queue.manualReceipt(admin, { requestId: 'same-original', billNumber: sale.billNumber }); assert.equal(requested.id, receipt[0].id);
});
test('kitchen append prints only new items and checkout does not reprint already sent food', async () => {
  const { agent } = await agentFixture('Kitchen'); await assign(agent, 'KITCHEN', true); await assign(agent, 'RECEIPT', false);
  const billing = app.get(BillingService), data = { id: 'KOT-ONE', orderNumber: 'KITCHEN-ORDER', orderType: 'DINE_IN', items: [{ productId: 'print-product', quantity: 1 }] };
  const initial = await billing.saveKitchenOrder(data, admin.restaurantId, admin.id); assert.ok(initial.printJobId);
  assert.equal((await billing.saveKitchenOrder(data, admin.restaurantId, admin.id)).printJobId, initial.printJobId);
  await billing.saveKitchenOrder({ ...data, id: 'KOT-TWO' }, admin.restaurantId, admin.id);
  await assert.rejects(billing.processDirectCheckout({ ...data, billNumber: 'KITCHEN-BAD-NOTES', paymentMethod: 'CASH', items: [{ productId: 'print-product', quantity: 2, notes: 'Changed after the kitchen received it' }] }, admin.restaurantId, admin.id), /Cooking instructions/);
  assert.equal(await db.bill.count({ where: { billNumber: 'KITCHEN-BAD-NOTES' } }), 0);
  await billing.processDirectCheckout({ ...data, billNumber: 'KITCHEN-BILL', paymentMethod: 'CASH', items: [{ productId: 'print-product', quantity: 2 }] }, admin.restaurantId, admin.id);
  assert.equal(await db.printJob.count({ where: { kind: 'KOT', reference: data.orderNumber } }), 2);
});
test('delivery dispatch and later collection print distinct unpaid and paid documents without duplicate kitchen items', async () => {
  const { agent } = await agentFixture('Delivery'); await assign(agent, 'RECEIPT', true); await assign(agent, 'KITCHEN', true);
  const workflow = app.get(WorkflowService), data = { actionId: 'print-dispatch', orderNumber: 'PRINT-DELIVERY', billNumber: 'PRINT-DELIVERY-BILL', orderType: 'DELIVERY', customerName: 'Guest', deliveryAddress: 'Address', items: [{ productId: 'print-product', quantity: 1 }], paymentStatus: 'PENDING' };
  const delivery = await workflow.createDelivery(data, admin); await workflow.createDelivery(data, admin);
  assert.equal(await db.printJob.count({ where: { kind: 'DISPATCH', reference: data.billNumber } }), 1);
  assert.equal(await db.printJob.count({ where: { kind: 'KOT', reference: data.orderNumber } }), 1);
  await db.deliveryOrder.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', riderId: admin.id } });
  await workflow.collectDelivery({ actionId: 'print-collection', id: delivery.id, paymentMethod: 'CASH', amount: 105 }, admin);
  assert.equal(await db.printJob.count({ where: { kind: 'RECEIPT', reference: data.billNumber } }), 1);
  assert.equal(await db.printJob.count({ where: { kind: 'KOT', reference: data.orderNumber } }), 1);
});
test('marked reprints use immutable snapshots, stable request IDs and original destination remains frozen', async () => {
  const { agent } = await agentFixture('Copies'); const assignment = await assign(agent, 'RECEIPT', true);
  const original = await db.printJob.findFirst({ where: { reference: 'PRINT-BILL' } });
  await assert.rejects(queue.manualReceipt(admin, { requestId: 'copy-too-soon', billNumber: 'PRINT-BILL', reprint: true, confirmed: true, reason: 'Another copy' }), /already waiting/);
  await db.printJob.update({ where: { id: original.id }, data: { state: 'SENT' } });
  await db.product.update({ where: { id: 'print-product' }, data: { name: 'Changed menu name', price: 999 } });
  await assert.rejects(queue.manualReceipt(admin, { requestId: 'copy-missing-review', billNumber: 'PRINT-BILL', reprint: true }), /reason/);
  const request = { requestId: 'copy-once', billNumber: 'PRINT-BILL', reprint: true, confirmed: true, reason: 'Customer needs another copy' };
  const first = await queue.manualReceipt(admin, request), again = await queue.manualReceipt(admin, request);
  assert.equal(first.id, again.id); const document = JSON.parse(first.document); assert.equal(document.reprint, true); assert.notEqual(document.items[0].name, 'Changed menu name'); assert.equal(document.grandTotal, 210);
  await queue.saveDestination(admin, { ...assignment, address: '192.168.1.99' });
  assert.equal(JSON.parse((await db.printJob.findUnique({ where: { id: original.id } })).destination).address, '192.168.1.50');
  const foreign = (await agentFixture('foreign')).agent;
  await assert.rejects(queue.start({ ...foreign, restaurantId: 'print-b' }, original.id, 'anything'), /revoked/);
});
test('uncertain delivery needs explicit recovery and creates one marked child on repeated requests', async () => {
  const { agent } = await agentFixture('Recovery'); const job = await enqueue(agent, 'uncertain-review');
  const claim = (await queue.claim(agent)).job; await queue.start(agent, claim.id, claim.claimToken); await queue.report(agent, claim.id, { claimToken: claim.claimToken, state: 'UNCERTAIN', error: 'Partial write' });
  await assert.rejects(queue.recover(admin, job.id, { requestId: 'review' }), /confirm/);
  const request = { requestId: 'review', confirmed: true, reason: 'Checked paper, no copy received' };
  const first = await queue.recover(admin, job.id, request), second = await queue.recover(admin, job.id, request);
  assert.equal(first.id, second.id); assert.equal(first.parentId, job.id); assert.equal(JSON.parse(first.document).reprint, true);
  await assert.rejects(queue.recover(admin, job.id, { ...request, requestId: 'another-device' }), /already waiting/);
  assert.ok((await db.printJob.findUnique({ where: { id: job.id } })).reviewedAt);
  const reviewOnly = await enqueue(agent, 'review-no-copy');
  await db.printJob.update({ where: { id: reviewOnly.id }, data: { state: 'UNCERTAIN' } });
  const jobCount = await db.printJob.count();
  await queue.review(admin, reviewOnly.id, { confirmed: true, reason: 'The original paper copy was found' });
  assert.equal(await db.printJob.count(), jobCount);
  assert.ok((await db.printJob.findUnique({ where: { id: reviewOnly.id } })).reviewedAt);
  const waiting = await enqueue(agent, 'cancel-once');
  await queue.cancel(admin, waiting.id, { reason: 'Obsolete waiting copy' });
  await queue.cancel(admin, waiting.id, { reason: 'Retry after lost acknowledgment' });
  assert.equal((await db.printJob.findUnique({ where: { id: waiting.id } })).resolution, `${admin.id}: Obsolete waiting copy`);
});

test('prebill pricing comes from the server and repeated requests create one unpaid document', async () => {
  const { agent } = await agentFixture('Prebill'); await assign(agent, 'RECEIPT', false);
  const billing = app.get(BillingService), input = { requestId: 'prebill-one', orderType: 'PARCEL', items: [{ productId: 'print-product', quantity: 1, price: 1 }], discount: 0 };
  const first = await billing.printPrebill(input, admin), second = await billing.printPrebill(input, admin);
  assert.equal(first.id, second.id);
  const job = await db.printJob.findUnique({ where: { id: first.id } }), document = JSON.parse(job.document);
  assert.equal(document.kind, 'PREBILL'); assert.equal(document.paymentMethod, 'UNPAID'); assert.equal(document.items[0].price, 999);
  assert.equal(await db.bill.count({ where: { billNumber: document.reference } }), 0);
});
test('thermal output wraps modifiers/instructions, strips commands, and marks unpaid/prebill copies', () => {
  const document = { kind: 'PREBILL', reference: 'PRE-1', reprint: true, createdAt: '2026-10-15T08:00:00Z', items: [{ name: 'A sufficiently long menu item name that must not disappear', quantity: 1, notes: '\x1b\x40Keep every part of this long cooking instruction visible to the kitchen', addons: [{ name: 'Extra sauce in a separate cup' }] }], grandTotal: 12 };
  const rendered = renderPrintDocument(document, 58).subarray(2, -3).toString();
  assert.match(rendered, /PRE-BILL - UNPAID/); assert.match(rendered, /REPRINT/); assert.match(rendered.replace(/\n/g, ' '), /instruction visible to the kitchen/); assert.match(rendered, /Extra sauce/); assert.ok(!rendered.includes('\x1b'));
});
