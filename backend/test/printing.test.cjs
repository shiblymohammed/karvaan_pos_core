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
const { PNG } = require('pngjs');
const { SettingsService } = require('../src/settings/settings.service');
const { receiptLogoBytes } = require('../src/printer/receipt-logo');
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

async function pairedMode(enabled) {
  const settings = app.get(SettingsService), current = await settings.getSettings(admin.restaurantId);
  await settings.updateSettings({ actionId: `pair-mode:${enabled}:${current.serverRevision}`, expectedRevision: current.serverRevision, checkoutReceiptAndKot: enabled, receiptName: 'Structured Cafe', receiptPhone: '+94 123 456789', receiptAddress: '12 Main Street', receiptFooterNote: 'Thank you from our team' }, admin.restaurantId);
}
const cuts = bytes => { let count = 0; for (let i = 0; i < bytes.length - 2; i++) if (bytes[i] === 0x1d && bytes[i + 1] === 0x56 && bytes[i + 2] === 0) count++; return count; };
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


test('saved receipt logo survives settings reload and is frozen in queued print data', async () => {
  const png = new PNG({ width: 8, height: 1 }); png.data.fill(0); png.data[3] = 255;
  const receiptLogo = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  const settings = app.get(SettingsService), current = await settings.getSettings(admin.restaurantId);
  await settings.updateSettings({ actionId: 'save-receipt-logo', expectedRevision: current.serverRevision, receiptLogo }, admin.restaurantId);
  assert.equal((await settings.getSettings(admin.restaurantId)).receiptLogo, receiptLogo);
  const { agent } = await agentFixture('Logo'); await assign(agent);
  await db.$transaction(async tx => queue.enqueue(tx, admin.restaurantId, 'RECEIPT', 'logo-snapshot', { ...await queue.branding(tx, admin.restaurantId), kind: 'PREBILL', reference: 'LOGO', createdAt: new Date().toISOString(), items: [] }, admin.id, false));
  const updated = await settings.getSettings(admin.restaurantId);
  await settings.updateSettings({ actionId: 'clear-receipt-logo', expectedRevision: updated.serverRevision, receiptLogo: '' }, admin.restaurantId);
  const claimed = await queue.claim(agent);
  assert.ok(Buffer.from(claimed.job.data, 'base64').includes(receiptLogoBytes(receiptLogo)));
  await assert.rejects(settings.updateSettings({ actionId: 'bad-logo', expectedRevision: updated.serverRevision + 1, receiptLogo: 'data:image/png;base64,AAAA' }, admin.restaurantId), /Invalid receipt logo/);
});

test('cafe checkout commits one ordered receipt/KOT bundle, retains its plan on retry and supports selective recovery', async () => {
  await pairedMode(true);
  const { agent } = await agentFixture('Cafe pair'); await assign(agent, 'RECEIPT', true); await assign(agent, 'KITCHEN', true);
  const billing = app.get(BillingService);
  const sale = { billNumber: 'CAFE-BILL', orderNumber: 'CAFE-ORDER', items: [{ productId: 'print-product', quantity: 2, notes: 'No onion' }], paymentMethod: 'CASH', orderType: 'DINE_IN' };
  const bill = await billing.processDirectCheckout(sale, admin.restaurantId, admin.id);
  const retry = await billing.processDirectCheckout(sale, admin.restaurantId, admin.id);
  assert.deepEqual(retry.checkoutPrint, bill.checkoutPrint);
  const jobs = await db.printJob.findMany({ where: { reference: { in: ['CAFE-BILL', 'CAFE-ORDER'] } } });
  assert.equal(jobs.length, 1); assert.equal(jobs[0].kind, 'RECEIPT');
  assert.equal(bill.checkoutPrint.receiptJobId, jobs[0].id);
  const document = JSON.parse(jobs[0].document);
  assert.equal(document.kitchenCopy.items[0].quantity, 2);
  for (const width of [58, 80]) {
    const bytes = renderPrintDocument(document, width), text = bytes.toString();
    assert.equal(cuts(bytes), 2);
    assert.ok(text.indexOf('CUSTOMER RECEIPT') < text.indexOf('KITCHEN TICKET'));
    assert.match(text, /Tel: \+94 123 456789/); assert.match(text, /Thank you from our team/);
    assert.match(text, /PAID/); assert.match(text, /No onion/);
    assert.doesNotMatch(text.slice(text.indexOf('KITCHEN TICKET')), /TOTAL Rs\.|Payment:|100\.00/);
  }
  const overview = await queue.overview(admin);
  assert.equal(overview.jobs.find(job => job.id === jobs[0].id).paired, true);
  assert.equal('document' in overview.jobs.find(job => job.id === jobs[0].id), false);
  await db.printJob.update({ where: { id: jobs[0].id }, data: { state: 'SENT' } });
  const customerCopy = await queue.manualReceipt(admin, { billNumber: 'CAFE-BILL', requestId: 'customer-only', reprint: true, confirmed: true, reason: 'Customer asks for copy' });
  assert.equal(JSON.parse(customerCopy.document).kitchenCopy, undefined);
  assert.equal(cuts(renderPrintDocument(JSON.parse(customerCopy.document), 80)), 1);
  await db.printJob.update({ where: { id: customerCopy.id }, data: { state: 'SENT' } });
  await assert.rejects(queue.recover(admin, jobs[0].id, { requestId: 'choose-copy', reason: 'Checked paper', confirmed: true }), /choose/);
  const kitchenCopy = await queue.recover(admin, jobs[0].id, { requestId: 'kitchen-only', reason: 'Kitchen paper missing', confirmed: true, copy: 'KOT' });
  assert.equal(kitchenCopy.kind, 'KOT'); assert.equal(JSON.parse(kitchenCopy.document).reprint, true);
  assert.equal(cuts(renderPrintDocument(JSON.parse(kitchenCopy.document), 58)), 1);
  assert.equal((await queue.recover(admin, jobs[0].id, { requestId: 'kitchen-only', reason: 'Retry same request', confirmed: true, copy: 'KOT' })).id, kitchenCopy.id);
  assert.equal(await db.bill.count({ where: { billNumber: 'CAFE-BILL' } }), 1);
  await pairedMode(false);
});

test('paired checkout sends only unsent variant quantities and omits an empty kitchen copy', async () => {
  await pairedMode(true);
  const { agent } = await agentFixture('Cafe variants'); await assign(agent, 'RECEIPT', true); await assign(agent, 'KITCHEN', true);
  await db.product.update({ where: { id: 'print-product' }, data: { variants: JSON.stringify([{ id: 'large', name: 'Large', price: 120 }, { id: 'small', name: 'Small', price: 80 }]) } });
  const billing = app.get(BillingService);
  await billing.saveKitchenOrder({ id: 'cafe-first-kot', orderNumber: 'CAFE-SENT', items: [{ productId: 'print-product', quantity: 1, variantId: 'large' }] }, admin.restaurantId, admin.id);
  const originalKot = await db.printJob.findFirst({ where: { reference: 'CAFE-SENT', kind: 'KOT' } });
  const kotText = renderPrintDocument(JSON.parse(originalKot.document), 58).toString().replace(/\n/g, ' ');
  assert.ok(kotText.includes((await db.product.findUnique({ where: { id: 'print-product' } })).name));
  assert.match(kotText, /\(Large\)/);
  const sale = await billing.processDirectCheckout({ billNumber: 'CAFE-VARIANTS', orderNumber: 'CAFE-SENT', items: [{ productId: 'print-product', quantity: 1, variantId: 'large' }, { productId: 'print-product', quantity: 2, variantId: 'small' }], paymentMethod: 'CASH' }, admin.restaurantId, admin.id);
  assert.equal(sale.checkoutPrint.kitchenCopy.items.length, 1);
  assert.equal(sale.checkoutPrint.kitchenCopy.items[0].variant, 'Small'); assert.equal(sale.checkoutPrint.kitchenCopy.items[0].quantity, 2);
  assert.equal(await db.printJob.count({ where: { reference: 'CAFE-SENT', kind: 'KOT' } }), 1);
  await billing.saveKitchenOrder({ id: 'cafe-all-sent-kot', orderNumber: 'CAFE-ALL-SENT', items: [{ productId: 'print-product', quantity: 1 }] }, admin.restaurantId, admin.id);
  const sent = await billing.processDirectCheckout({ billNumber: 'CAFE-NO-NEW', orderNumber: 'CAFE-ALL-SENT', items: [{ productId: 'print-product', quantity: 1 }], paymentMethod: 'CASH' }, admin.restaurantId, admin.id);
  assert.equal(sent.checkoutPrint.kitchenCopy, undefined);
  const job = await db.printJob.findUnique({ where: { id: sent.checkoutPrint.receiptJobId } });
  assert.equal(cuts(renderPrintDocument(JSON.parse(job.document), 80)), 1);
  await db.product.update({ where: { id: 'print-product' }, data: { variants: null } });
  await pairedMode(false);
});

test('paired mode retains a manual print plan without a receipt auto destination and validates settings per restaurant', async () => {
  await pairedMode(true);
  const { agent } = await agentFixture('Manual pair'); await assign(agent, 'RECEIPT', false); await assign(agent, 'KITCHEN', true);
  const billing = app.get(BillingService);
  const sale = { billNumber: 'MANUAL-PAIR', orderNumber: 'MANUAL-PAIR-ORDER', items: [{ productId: 'print-product', quantity: 1 }], paymentMethod: 'CASH' };
  const saved = await billing.processDirectCheckout(sale, admin.restaurantId, admin.id);
  assert.equal(saved.checkoutPrint.receiptJobId, null); assert.equal(saved.checkoutPrint.kitchenCopy.items.length, 1);
  assert.equal(await db.printJob.count({ where: { reference: { in: ['MANUAL-PAIR', 'MANUAL-PAIR-ORDER'] } } }), 0);
  const manual = await queue.manualReceipt(admin, { billNumber: 'MANUAL-PAIR', requestId: 'manual-pair' });
  assert.equal(cuts(renderPrintDocument(JSON.parse(manual.document), 58)), 2);
  const settings = app.get(SettingsService), current = await settings.getSettings(admin.restaurantId);
  assert.equal((await settings.getSettings('print-b')).checkoutReceiptAndKot, false);
  await assert.rejects(settings.updateSettings({ actionId: 'bad-pair-setting', expectedRevision: current.serverRevision, checkoutReceiptAndKot: 'true' }, admin.restaurantId), /Invalid checkout/);
  await assert.rejects(settings.updateSettings({ actionId: 'bad-phone-setting', expectedRevision: current.serverRevision, receiptPhone: 123 }, admin.restaurantId), /receiptPhone/);
  await pairedMode(false);
});

test('prepaid delivery respects the receipt/KOT bundle while unpaid dispatch stays a separate unpaid slip', async () => {
  await pairedMode(true);
  const { agent } = await agentFixture('Prepaid pair'); await assign(agent, 'RECEIPT', true); await assign(agent, 'KITCHEN', true);
  const workflows = app.get(WorkflowService);
  const data = { id: 'cafe-prepaid', actionId: 'cafe-prepaid-action', orderNumber: 'CAFE-PREPAID-ORDER', billNumber: 'CAFE-PREPAID-BILL', orderType: 'DELIVERY', customerName: 'Guest', paymentStatus: 'COLLECTED', paymentMethod: 'CASH', items: [{ productId: 'print-product', quantity: 1 }] };
  const result = await workflows.createDelivery(data, { ...admin, name: 'Admin', permissions: {} });
  assert.equal(result.checkoutPrint.kitchenCopy.items.length, 1);
  assert.equal(await db.printJob.count({ where: { reference: 'CAFE-PREPAID-ORDER', kind: 'KOT' } }), 0);
  const receipt = await db.printJob.findFirst({ where: { reference: 'CAFE-PREPAID-BILL' } });
  assert.equal(cuts(renderPrintDocument(JSON.parse(receipt.document), 80)), 2);
  await workflows.createDelivery({ ...data, id: 'cafe-cod', actionId: 'cafe-cod-action', orderNumber: 'CAFE-COD-ORDER', billNumber: 'CAFE-COD-BILL', paymentStatus: 'PENDING' }, { ...admin, name: 'Admin', permissions: {} });
  const dispatch = await db.printJob.findFirst({ where: { reference: 'CAFE-COD-BILL' } });
  assert.equal(dispatch.kind, 'DISPATCH'); assert.match(renderPrintDocument(JSON.parse(dispatch.document), 80).toString(), /PAYMENT PENDING/);
  assert.equal(await db.bill.count({ where: { billNumber: 'CAFE-COD-BILL' } }), 0);
  await pairedMode(false);
});

test('direct original print claims fence other terminals and normal queue requests without changing the sale', async () => {
  const { agent } = await agentFixture('Direct ownership'); await assign(agent, 'RECEIPT', false); await assign(agent, 'KITCHEN', false);
  const billing = app.get(BillingService);
  const sale = { billNumber: 'DIRECT-ORIGINAL', orderNumber: 'DIRECT-ORDER', items: [{ productId: 'print-product', quantity: 1 }], paymentMethod: 'CASH' };
  await billing.processDirectCheckout(sale, admin.restaurantId, admin.id);
  const claim = { billNumber: sale.billNumber, terminalId: 'counter-one', requestId: 'direct-original' };
  assert.equal((await queue.claimDirectReceipt(admin, claim)).allowed, true);
  assert.equal((await queue.claimDirectReceipt(admin, claim)).allowed, true);
  await assert.rejects(queue.claimDirectReceipt(admin, { ...claim, terminalId: 'counter-two', requestId: 'different' }), /already claimed/);
  await assert.rejects(queue.claimDirectReceipt({ ...admin, restaurantId: 'print-b' }, claim), /saved bill/);
  await assert.rejects(queue.manualReceipt(admin, { billNumber: sale.billNumber, requestId: 'another-original' }), /already claimed/);
  const copy = await queue.manualReceipt(admin, { billNumber: sale.billNumber, requestId: 'direct-marked', reprint: true, confirmed: true, reason: 'Paper was checked' });
  assert.equal(JSON.parse(copy.document).reprint, true);
  assert.equal(await db.bill.count({ where: { billNumber: sale.billNumber } }), 1);
  await assign(agent, 'RECEIPT', true);
  await billing.processDirectCheckout({ ...sale, billNumber: 'QUEUED-ORIGINAL', orderNumber: 'QUEUED-ORDER' }, admin.restaurantId, admin.id);
  await assert.rejects(queue.claimDirectReceipt(admin, { ...claim, billNumber: 'QUEUED-ORIGINAL', requestId: 'local-duplicate' }), /already owns/);
});

test('destination test tickets include the saved logo and business details without becoming sales', async () => {
  const png = new PNG({ width: 8, height: 1 }); png.data.fill(255); png.data[0] = png.data[1] = png.data[2] = 0;
  const receiptLogo = 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
  const settings = app.get(SettingsService), current = await settings.getSettings(admin.restaurantId);
  await settings.updateSettings({ actionId: 'logo-hardware-test', expectedRevision: current.serverRevision, receiptLogo }, admin.restaurantId);
  const { agent } = await agentFixture('Branding test'); await assign(agent, 'RECEIPT', false);
  const bills = await db.bill.count();
  const job = await queue.test(admin, { role: 'RECEIPT', requestId: 'branded-hardware-test' });
  const bytes = renderPrintDocument(JSON.parse(job.document), 58);
  assert.ok(bytes.includes(receiptLogoBytes(receiptLogo)));
  assert.match(bytes.toString(), /Structured Cafe/); assert.match(bytes.toString(), /Tel: \+94 123 456789/);
  assert.match(bytes.toString(), /PRINTER TEST - NOT A SALE/); assert.equal(await db.bill.count(), bills);
  const updated = await settings.getSettings(admin.restaurantId);
  await settings.updateSettings({ actionId: 'clear-hardware-test-logo', expectedRevision: updated.serverRevision, receiptLogo: '' }, admin.restaurantId);
});

test('a corrupt legacy logo fails visibly without blocking later print jobs', async () => {
  const { agent } = await agentFixture('Corrupt logo'); await assign(agent);
  const bad = await db.$transaction(tx => queue.enqueue(tx, admin.restaurantId, 'RECEIPT', 'bad-logo-job', { kind: 'RECEIPT', receiptLogo: 'broken', reference: 'BAD', createdAt: new Date().toISOString(), items: [] }, admin.id, false));
  assert.equal((await queue.claim(agent)).job, null);
  assert.equal((await db.printJob.findUnique({ where: { id: bad.id } })).state, 'FAILED');
  const good = await enqueue(agent, 'after-bad-logo');
  assert.equal((await queue.claim(agent)).job.id, good.id);
});
