import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly DB_PATH = path.resolve(__dirname, '../../prisma/dev.db');
  private readonly BACKUP_DIR = path.resolve(__dirname, '../../backups');
  private readonly MAX_BACKUPS = 30; // Keep 30 days of history

  constructor(private readonly prisma: PrismaService) {
    // Ensure backup directory exists at startup
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
      this.logger.log(`📁 Created backup directory: ${this.BACKUP_DIR}`);
    }
  }

  /**
   * Automatic daily backup at 3:00 AM every night.
   * Compresses dev.db into backups/karvaan-YYYY-MM-DD.db.gz
   */
  @Cron('0 3 * * *', { name: 'daily-database-backup' })
  async runDailyBackup(): Promise<void> {
    await this.createBackup('scheduled');
  }

  /**
   * Manual backup trigger — callable from AdminController or HTTP endpoint.
   */
  async triggerManualBackup(): Promise<{ success: boolean; filename: string; sizeKb: number }> {
    return this.createBackup('manual');
  }

  private async createBackup(source: 'scheduled' | 'manual'): Promise<{ success: boolean; filename: string; sizeKb: number }> {
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const filename = `karvaan-${dateStr}-${timeStr}-${source}.db.gz`;
    const destPath = path.join(this.BACKUP_DIR, filename);

    this.logger.log(`💾 [${source.toUpperCase()} BACKUP] Starting backup → ${filename}`);

    try {
      if (!fs.existsSync(this.DB_PATH)) {
        throw new Error(`Database file not found at ${this.DB_PATH}`);
      }

      // Compress using gzip stream
      const readStream = fs.createReadStream(this.DB_PATH);
      const gzip = zlib.createGzip({ level: 9 });
      const writeStream = fs.createWriteStream(destPath);

      await pipelineAsync(readStream, gzip, writeStream);

      const stats = fs.statSync(destPath);
      const sizeKb = Math.round(stats.size / 1024);

      this.logger.log(`✅ Backup complete: ${filename} (${sizeKb} KB)`);

      // Log to database
      await this.prisma.backupLog.create({
        data: { filename, sizeBytes: stats.size, status: 'SUCCESS' },
      });

      // Prune old backups beyond MAX_BACKUPS
      await this.pruneOldBackups();

      return { success: true, filename, sizeKb };
    } catch (err) {
      this.logger.error(`❌ Backup FAILED: ${err.message}`);

      // Log failure to database
      try {
        await this.prisma.backupLog.create({
          data: { filename, status: 'FAILED', error: err.message },
        });
      } catch (_) {}

      return { success: false, filename, sizeKb: 0 };
    }
  }

  private async pruneOldBackups(): Promise<void> {
    const allBackups = fs
      .readdirSync(this.BACKUP_DIR)
      .filter((f) => f.startsWith('karvaan-') && f.endsWith('.db.gz'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(this.BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    const toDelete = allBackups.slice(this.MAX_BACKUPS);
    for (const backup of toDelete) {
      fs.unlinkSync(path.join(this.BACKUP_DIR, backup.name));
      this.logger.log(`🗑️ Pruned old backup: ${backup.name}`);
    }
  }

  /**
   * Get list of all backup archives with metadata.
   */
  async listBackups(): Promise<Array<{ filename: string; sizeKb: number; createdAt: string }>> {
    if (!fs.existsSync(this.BACKUP_DIR)) return [];

    return fs
      .readdirSync(this.BACKUP_DIR)
      .filter((f) => f.startsWith('karvaan-') && f.endsWith('.db.gz'))
      .map((f) => {
        const stat = fs.statSync(path.join(this.BACKUP_DIR, f));
        return {
          filename: f,
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /**
   * Get the last 10 backup log entries from the database.
   */
  async getBackupLogs() {
    return this.prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
