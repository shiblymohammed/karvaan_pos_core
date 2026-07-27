"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BackupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const stream_1 = require("stream");
const util_1 = require("util");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
let BackupService = BackupService_1 = class BackupService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(BackupService_1.name);
        this.DB_PATH = path.resolve(__dirname, '../../prisma/dev.db');
        this.BACKUP_DIR = path.resolve(__dirname, '../../backups');
        this.MAX_BACKUPS = 30;
        if (!fs.existsSync(this.BACKUP_DIR)) {
            fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
            this.logger.log(`📁 Created backup directory: ${this.BACKUP_DIR}`);
        }
    }
    async runDailyBackup() {
        await this.createBackup('scheduled');
    }
    async triggerManualBackup() {
        return this.createBackup('manual');
    }
    async createBackup(source) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
        const filename = `karvaan-${dateStr}-${timeStr}-${source}.db.gz`;
        const destPath = path.join(this.BACKUP_DIR, filename);
        this.logger.log(`💾 [${source.toUpperCase()} BACKUP] Starting backup → ${filename}`);
        try {
            if (!fs.existsSync(this.DB_PATH)) {
                throw new Error(`Database file not found at ${this.DB_PATH}`);
            }
            const readStream = fs.createReadStream(this.DB_PATH);
            const gzip = zlib.createGzip({ level: 9 });
            const writeStream = fs.createWriteStream(destPath);
            await pipelineAsync(readStream, gzip, writeStream);
            const stats = fs.statSync(destPath);
            const sizeKb = Math.round(stats.size / 1024);
            this.logger.log(`✅ Backup complete: ${filename} (${sizeKb} KB)`);
            await this.prisma.backupLog.create({
                data: { filename, sizeBytes: stats.size, status: 'SUCCESS' },
            });
            await this.pruneOldBackups();
            return { success: true, filename, sizeKb };
        }
        catch (err) {
            this.logger.error(`❌ Backup FAILED: ${err.message}`);
            try {
                await this.prisma.backupLog.create({
                    data: { filename, status: 'FAILED', error: err.message },
                });
            }
            catch (_) { }
            return { success: false, filename, sizeKb: 0 };
        }
    }
    async pruneOldBackups() {
        const allBackups = fs
            .readdirSync(this.BACKUP_DIR)
            .filter((f) => f.startsWith('karvaan-') && f.endsWith('.db.gz'))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(this.BACKUP_DIR, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
        const toDelete = allBackups.slice(this.MAX_BACKUPS);
        for (const backup of toDelete) {
            fs.unlinkSync(path.join(this.BACKUP_DIR, backup.name));
            this.logger.log(`🗑️ Pruned old backup: ${backup.name}`);
        }
    }
    async listBackups() {
        if (!fs.existsSync(this.BACKUP_DIR))
            return [];
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
    async getBackupLogs() {
        return this.prisma.backupLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
    }
};
exports.BackupService = BackupService;
__decorate([
    (0, schedule_1.Cron)('0 3 * * *', { name: 'daily-database-backup' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupService.prototype, "runDailyBackup", null);
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BackupService);
//# sourceMappingURL=backup.service.js.map