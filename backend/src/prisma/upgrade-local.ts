import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function upgradeLocalDatabase(databaseUrl: string, schemaPath: string, directory: string) {
  const digest = createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex');
  const stamp = path.join(directory, 'schema-version.sha256');
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === digest) return;
  fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, `before-upgrade-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.db`);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await client.$connect();
    await client.$executeRawUnsafe(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
  } finally { await client.$disconnect(); }
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--schema', schemaPath], { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error(`Database upgrade stopped. Review the schema change before retrying; your pre-upgrade backup is ${backup}`);
  fs.writeFileSync(stamp, digest);
}
