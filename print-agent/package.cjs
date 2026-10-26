'use strict';
// Dependency-free deterministic ZIP with stored entries. Never packages local credentials.
const fs = require('node:fs');
const path = require('node:path');
const files = ['agent.cjs', 'transport.cjs', 'windows-print.ps1', 'install-windows.ps1', 'run-windows.ps1', 'SETUP.txt', 'package.json'];
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function packageAgent(output = path.join(__dirname, '..', 'frontend', 'public', 'karvaan-print-agent.zip')) {
  const entries = [], directory = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file), data = fs.readFileSync(path.join(__dirname, file)), crc = crc32(data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12); // fixed DOS date 1980-01-01
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    entries.push(header, name, data); directory.push(central, name); offset += header.length + name.length + data.length;
  }
  const centralDirectory = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralDirectory.length, 12); end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, Buffer.concat([...entries, centralDirectory, end])); return output;
}
if (require.main === module) console.log('Packaged local printing service: ' + packageAgent(process.argv[2] ? path.resolve(process.argv[2]) : undefined));
module.exports = { packageAgent, files, crc32 };
