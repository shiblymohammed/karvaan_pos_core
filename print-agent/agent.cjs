'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { send } = require('./transport.cjs');

function stateDirectory() { return process.env.KARVAAN_PRINT_HOME || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'KarvaanPrint'); }
function atomicJson(file, data) {
  const temporary = file + '.tmp';
  const descriptor = fs.openSync(temporary, 'w', 0o600);
  try { fs.writeFileSync(descriptor, JSON.stringify(data)); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, file);
}
function serverUrl(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use your HTTPS POS server URL (HTTP is allowed only for loopback development)');
  return url.href.replace(/\/$/, '');
}
async function request(config, endpoint, body) {
  const response = await fetch(config.server + '/printer/agent' + endpoint, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', ...(config.token ? { Authorization: 'Bearer ' + config.token } : {}) }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(15000) });
  if (!response.ok) { const error = new Error(`Printing server returned HTTP ${response.status}`); error.status = response.status; throw error; }
  return response.json();
}
async function processJob(job, dependencies) {
  const { journal, save, call, deliver } = dependencies;
  let entry = journal[job.id];
  const remembered = dependencies.readRecord?.(job.id);
  if ((!entry && remembered) || (entry && entry.claimToken !== job.claimToken)) {
    // An older VPS backup may restore an already attempted ID to QUEUED. Obtain
    // permission to resolve the new claim, but never send those bytes again.
    entry = journal[job.id] = { claimToken: job.claimToken, createdAt: new Date().toISOString(), result: { state: 'UNCERTAIN', error: 'This computer remembers an earlier attempt for this job ID. Check for a restored server backup and review the paper.' } };
    save();
    await call(`/jobs/${job.id}/start`, { claimToken: job.claimToken });
  }
  if (entry) {
    if (!entry.result) { entry.result = { state: 'UNCERTAIN', error: 'Printing service restarted after delivery began. Check the paper.' }; save(); }
  } else {
    // Persist intent before telling the server that delivery can begin. Any crash after this
    // point is reviewed, never silently resent. Server must acknowledge start before any bytes.
    entry = journal[job.id] = { claimToken: job.claimToken, createdAt: new Date().toISOString() }; save();
    try { await call(`/jobs/${job.id}/start`, { claimToken: job.claimToken }); }
    catch (error) {
      if ([401, 403, 409].includes(error.status)) { delete journal[job.id]; save(); throw error; }
      entry.result = { state: 'UNCERTAIN', error: 'Could not confirm permission to start. No document was sent by this attempt.' }; save();
      return; // reconcile on reconnect, without sending bytes
    }
    try { entry.result = await deliver(job.destination, Buffer.from(job.data, 'base64'), job.title); }
    catch { entry.result = { state: 'UNCERTAIN', error: 'Unexpected delivery failure. Check the paper before retrying.' }; }
    save(); // a lost result acknowledgement must not cause another physical send
  }
  dependencies.remember?.(job.id, entry);
  await call(`/jobs/${job.id}/result`, { claimToken: entry.claimToken, ...entry.result });
  delete journal[job.id]; save();
}
async function reconcile(dependencies) {
  for (const [id, entry] of Object.entries(dependencies.journal)) {
    if (!entry.result) { entry.result = { state: 'UNCERTAIN', error: 'Printing service restarted during delivery. Check the paper before retrying.' }; dependencies.save(); }
    dependencies.remember?.(id, entry);
    try {
      await dependencies.call(`/jobs/${id}/result`, { claimToken: entry.claimToken, ...entry.result });
      delete dependencies.journal[id]; dependencies.save();
    } catch (error) {
      if (error.status === 409) { delete dependencies.journal[id]; dependencies.save(); }
      else throw error;
    }
  }
}
function historyStore(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const fileFor = id => path.join(directory, createHash('sha256').update(id).digest('hex') + '.json');
  return {
    readRecord: id => { const file = fileFor(id); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; },
    // Small individual records keep each write bounded as years of jobs accumulate.
    remember: (id, entry) => atomicJson(fileFor(id), { id, createdAt: entry.createdAt, result: entry.result }),
  };
}
async function lock(directory) {
  const hash = createHash('sha256').update(path.resolve(directory).toLowerCase()).digest('hex');
  const address = process.platform === 'win32' ? '\\\\.\\pipe\\karvaan-print-' + hash.slice(0, 24) : { host: '127.0.0.1', port: 30000 + parseInt(hash.slice(0, 6), 16) % 20000 };
  const server = net.createServer(socket => socket.end());
  await new Promise((resolve, reject) => { server.once('error', () => reject(new Error('Another printing service is already running for this profile'))); server.listen(address, resolve); });
  return server;
}
async function main(args = process.argv.slice(2)) {
  const directory = stateDirectory(); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lockHandle = await lock(directory);
  const configFile = path.join(directory, 'config.json'), journalFile = path.join(directory, 'journal.json');
  try {
    if (args[0] === 'pair') {
      if (!args[1] || !args[2]) throw new Error('Usage: node agent.cjs pair https://your-pos.example PAIRING-CODE');
      // Do not overwrite an existing identity or unresolved delivery journal.
      if (fs.existsSync(configFile)) throw new Error('This profile is already paired. Revoke it in the POS and use a new profile directory to pair another identity.');
      const server = serverUrl(args[1]);
      const paired = await request({ server }, '/pair', { code: args[2] });
      atomicJson(configFile, { server, token: paired.token, agentId: paired.agentId });
      console.log(`Paired: ${paired.name}. Keep this profile private. Start the printing service to connect.`);
      return;
    }
    if (args[0] === 'printers') {
      if (process.platform !== 'win32') throw new Error('Use your operating system printer settings to find queue names');
      const { execFileSync } = require('node:child_process');
      process.stdout.write(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'], { windowsHide: true })); return;
    }
    if (args[0] !== 'run') throw new Error('Commands: pair, run, printers');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.server = serverUrl(config.server);
    const journal = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, 'utf8')) : {};
    const dependencies = { journal, ...historyStore(path.join(directory, 'attempted-jobs')), save: () => atomicJson(journalFile, journal), call: (endpoint, body) => request(config, endpoint, body), deliver: send };
    console.log('Karvaan printing service connected. SENT means accepted by the transport, not verified paper output.');
    let stopping = false, failures = 0;
    const stop = () => { stopping = true; }; process.once('SIGINT', stop); process.once('SIGTERM', stop);
    while (!stopping) {
      try {
        await reconcile(dependencies);
        const { job } = await dependencies.call('/claim');
        if (job) { await processJob(job, dependencies); console.log(`${new Date().toISOString()} Job ${job.id} processed`); }
        failures = 0;
        if (!job) await delay(2000);
      } catch (error) {
        if ([401, 403].includes(error.status)) throw new Error('Printing service access was revoked. Pair a new profile in admin settings.');
        console.error(`${new Date().toISOString()} ${error.message}. Waiting to reconnect.`);
        await delay(Math.min(30000, 2000 * 2 ** Math.min(failures++, 4)));
      }
    }
  } finally { lockHandle.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { atomicJson, serverUrl, processJob, reconcile, historyStore, main };
