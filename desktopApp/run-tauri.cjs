const { spawnSync } = require('node:child_process');
const path = require('node:path');
const directory = __dirname;
const cli = require.resolve('@tauri-apps/cli/tauri.js', { paths: [path.join(directory, '../frontend')] });
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { cwd: directory, stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;