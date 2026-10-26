'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { processJob, reconcile, serverUrl, atomicJson, historyStore } = require('../agent.cjs');
const { sendTcp, validDestination } = require('../transport.cjs');
const { packageAgent, files, crc32 } = require('../package.cjs');
const job = { id: 'job-one', claimToken: 'claim-one', destination: {}, data: Buffer.from('receipt').toString('base64') };
function harness(overrides = {}) {
  let deliveries = 0, saves = 0;
  const calls = [], journal = {};
  const dependencies = { journal, save: () => { saves++; }, call: async (endpoint, body) => { calls.push({ endpoint, body }); }, deliver: async () => { deliveries++; return { state: 'SENT' }; }, ...overrides };
  return { dependencies, calls, get deliveries() { return deliveries; }, get saves() { return saves; } };
}
test('start is confirmed before bytes and delivery is journaled before result acknowledgment', async () => {
  const sequence = [], journal = {};
  await processJob(job, { journal, save: () => sequence.push(journal[job.id]?.result ? 'saved-result' : 'saved-intent'), call: async endpoint => sequence.push(endpoint.endsWith('/start') ? 'start' : 'result'), deliver: async () => { sequence.push('send'); return { state: 'SENT' }; } });
  assert.deepEqual(sequence.slice(0, 5), ['saved-intent', 'start', 'send', 'saved-result', 'result']);
  assert.deepEqual(journal, {});
});
test('lost result acknowledgment retries the report without sending another physical copy', async () => {
  const h = harness(), realCall = h.dependencies.call; let rejectOnce = true;
  h.dependencies.call = async (endpoint, body) => { if (endpoint.endsWith('/result') && rejectOnce) { rejectOnce = false; throw new Error('Disconnected'); } return realCall(endpoint, body); };
  await assert.rejects(processJob(job, h.dependencies), /Disconnected/);
  assert.equal(h.deliveries, 1); assert.equal(h.dependencies.journal[job.id].result.state, 'SENT');
  await processJob(job, h.dependencies);
  assert.equal(h.deliveries, 1); assert.deepEqual(h.dependencies.journal, {});
});
test('uncertain permission to start never sends bytes and reconciles conservatively', async () => {
  const h = harness(); h.dependencies.call = async () => { throw new Error('Lost start acknowledgment'); };
  await processJob(job, h.dependencies); assert.equal(h.deliveries, 0);
  assert.equal(h.dependencies.journal[job.id].result.state, 'UNCERTAIN');
  h.dependencies.call = async (endpoint, body) => { assert.equal(body.state, 'UNCERTAIN'); };
  await reconcile(h.dependencies); assert.equal(h.deliveries, 0);
});
test('restart with a persisted delivery intent reports uncertainty, never retransmits', async () => {
  const h = harness(); h.dependencies.journal[job.id] = { claimToken: job.claimToken };
  await reconcile(h.dependencies); assert.equal(h.deliveries, 0); assert.equal(h.calls[0].body.state, 'UNCERTAIN');
});
test('expired start claim is rejected without delivery', async () => {
  const h = harness(); h.dependencies.call = async () => { const error = new Error('Expired'); error.status = 409; throw error; };
  await assert.rejects(processJob(job, h.dependencies), /Expired/);
  assert.equal(h.deliveries, 0); assert.deepEqual(h.dependencies.journal, {});
});
test('unexpected transport exception is retained as uncertainty', async () => {
  const h = harness({ deliver: async () => { throw new Error('Crash'); } });
  await processJob(job, h.dependencies); assert.equal(h.calls.at(-1).body.state, 'UNCERTAIN');
});
test('a restored server claim never resends a previously attempted local job', async () => {
  const h = harness(); h.dependencies.journal[job.id] = { claimToken: 'different', result: { state: 'SENT' } };
  await processJob(job, h.dependencies); assert.equal(h.deliveries, 0);
  assert.equal(h.calls.at(-1).body.state, 'UNCERTAIN');
});
test('acknowledged jobs remain remembered after a local service restart and a VPS restore', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karvaan-attempt-history-'));
  const first = harness(historyStore(directory)); await processJob(job, first.dependencies); assert.equal(first.deliveries, 1);
  assert.deepEqual(first.dependencies.journal, {});
  const restarted = harness(historyStore(directory)); await processJob({ ...job, claimToken: 'restored-server-claim' }, restarted.dependencies);
  assert.equal(restarted.deliveries, 0); assert.equal(restarted.calls.at(-1).body.state, 'UNCERTAIN');
});
test('printer destinations reject public addresses and remote Windows shares', () => {
  const destination = { transport: 'TCP', address: '192.168.1.20', port: 9100, paperWidth: 80 };
  assert.equal(validDestination(destination), true);
  for (const address of ['8.8.8.8', '169.254.169.254', '127.0.0.1', 'printer.example', '192.168.1.20\n']) assert.equal(validDestination({ ...destination, address }), false);
  assert.equal(validDestination({ ...destination, transport: 'WINDOWS', address: 'EPSON receipt' }), true);
  assert.equal(validDestination({ ...destination, transport: 'WINDOWS', address: '\\\\other-pc\\share' }), false);
});
test('TCP distinguishes failed connection from ambiguous partial write', async () => {
  class Socket extends EventEmitter {
    setTimeout() {} destroy() {}
    connect() { queueMicrotask(() => this.emit(this.mode === 'connect-fail' ? 'error' : 'connect', new Error('Disconnected'))); }
    end(data, callback) { if (this.mode === 'write-fail') this.emit('error', new Error('Partial write')); else callback(); }
  }
  for (const [mode, state] of [['connect-fail', 'FAILED'], ['write-fail', 'UNCERTAIN'], ['success', 'SENT']]) {
    const result = await sendTcp({}, Buffer.from('data'), () => { const socket = new Socket(); socket.mode = mode; return socket; });
    assert.equal(result.state, state);
  }
});
test('agent requires HTTPS and rejects credentials, redirects embedded in the URL, and remote HTTP', () => {
  assert.equal(serverUrl('https://pos.example/'), 'https://pos.example');
  assert.equal(serverUrl('http://127.0.0.1:3001'), 'http://127.0.0.1:3001');
  for (const value of ['http://pos.example', 'https://user:password@pos.example', 'https://pos.example/?token=private', 'file:///tmp/a']) assert.throws(() => serverUrl(value));
});
test('atomic journal and deterministic package keep credentials outside the download', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karvaan-agent-test-'));
  const state = path.join(directory, 'journal.json'); atomicJson(state, { id: 1 }); atomicJson(state, { id: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(state)), { id: 2 });
  const archive = packageAgent(path.join(directory, 'agent.zip')), bytes = fs.readFileSync(archive);
  assert.equal(bytes.readUInt32LE(0), 0x04034b50); assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), files.length);
  assert.equal(files.includes('config.json'), false); assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.deepEqual(fs.readFileSync(packageAgent(path.join(directory, 'again.zip'))), bytes);
});
