'use strict';
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function validDestination(destination) {
  if (!destination || ![58, 80].includes(destination.paperWidth)) return false;
  const address = destination.address;
  if (typeof address !== 'string' || !address.trim() || address.length > 200 || /[\x00-\x1f]/.test(address)) return false;
  if (destination.transport === 'WINDOWS') return !address.startsWith('\\\\');
  return destination.transport === 'TCP' && net.isIP(address) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) && Number.isInteger(destination.port) && destination.port > 0 && destination.port < 65536;
}
function sendTcp(destination, data, socketFactory = () => new net.Socket()) {
  return new Promise(resolve => {
    const socket = socketFactory();
    let attempted = false, finished = false;
    const finish = (state, error) => { if (finished) return; finished = true; socket.destroy(); resolve({ state, error }); };
    socket.setTimeout(10000);
    socket.once('error', error => finish(attempted ? 'UNCERTAIN' : 'FAILED', error.message));
    socket.once('timeout', () => finish(attempted ? 'UNCERTAIN' : 'FAILED', 'Printer connection timed out'));
    socket.once('close', () => { if (!finished) finish(attempted ? 'UNCERTAIN' : 'FAILED', 'Printer connection closed'); });
    socket.once('connect', () => {
      attempted = true;
      socket.end(data, () => finish('SENT'));
    });
    try { socket.connect(destination.port, destination.address); } catch (error) { finish(attempted ? 'UNCERTAIN' : 'FAILED', error.message); }
  });
}
async function sendWindows(destination, data, title) {
  if (process.platform !== 'win32') return { state: 'FAILED', error: 'Windows spooler transport requires Windows' };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karvaan-print-'));
  const file = path.join(directory, 'job.bin');
  fs.writeFileSync(file, data, { mode: 0o600 });
  try {
    return await new Promise(resolve => {
      // Queue names and file paths are separate arguments, never interpolated PowerShell source.
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-print.ps1'), '-PrinterName', destination.address, '-DataPath', file, '-JobName', String(title || 'Karvaan POS document').replace(/[\x00-\x1f]/g, ' ').slice(0, 200)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', errors = '', settled = false;
      const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
      const timer = setTimeout(() => { child.kill(); finish({ state: 'UNCERTAIN', error: 'Spooler timeout. Check the Windows queue and paper.' }); }, 45000);
      child.stdout.on('data', chunk => { output = (output + chunk).slice(-2000); });
      child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000); });
      child.once('error', error => finish({ state: 'FAILED', error: error.message }));
      child.once('exit', code => finish(code === 0 && output.includes('KARVAAN_SPOOL_ACCEPTED') ? { state: 'SENT' } : { state: code === 10 ? 'FAILED' : 'UNCERTAIN', error: errors.trim() || 'Windows spooler did not confirm acceptance. Check its queue before retrying.' }));
    });
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
}
async function send(destination, data, title) {
  if (!validDestination(destination) || !Buffer.isBuffer(data) || !data.length || data.length > 1000000) return { state: 'FAILED', error: 'Invalid local destination or document' };
  return destination.transport === 'TCP' ? sendTcp(destination, data) : sendWindows(destination, data, title);
}
module.exports = { send, sendTcp, validDestination };
