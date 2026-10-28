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
const cron_1 = require("cron");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const promises_1 = require("stream/promises");
const crypto_1 = require("crypto");
let BackupService = BackupService_1 = class BackupService {
    constructor(prisma, schedulerRegistry) {
        this.prisma = prisma;
        this.schedulerRegistry = schedulerRegistry;
        this.logger = new common_1.Logger(BackupService_1.name);
        this.running = new Set();
    }
    defaultDirectory(restaurantId) {
        const url = process.env.DATABASE_URL;
        if (!url?.startsWith('file:'))
            throw new Error('SQLite DATABASE_URL is required for backups');
        const dbPath = path.resolve(url.slice(5));
        return path.join(path.dirname(dbPath), 'backups', restaurantId);
    }
    async onModuleInit() {
        const restaurants = await this.prisma.restaurant.findMany({ where: { isActive: true }, select: { id: true } });
        for (const restaurant of restaurants)
            await this.applyBackupSettings(restaurant.id);
    }
    async getSettings(restaurantId) {
        const defaults = { enabled: true, time: '03:00', location: this.defaultDirectory(restaurantId) };
        const record = await this.prisma.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'backup' } } });
        let saved = {};
        try {
            saved = JSON.parse(record?.data || '{}');
        }
        catch { }
        const location = typeof saved?.location === 'string' && saved.location.trim() ? path.resolve(saved.location) : defaults.location;
        const scoped = path.basename(location) === restaurantId ? location : path.join(location, restaurantId);
        return { enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : defaults.enabled, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(saved?.time) ? saved.time : defaults.time, location: this.isPublicDirectory(scoped) ? defaults.location : scoped };
    }
    isPublicDirectory(directory) {
        const relative = path.relative(path.resolve(process.env.UPLOAD_DIR || './uploads'), directory);
        return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    }
    async updateSettings(settings, restaurantId) {
        if (typeof settings?.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) || typeof settings.location !== 'string' || !settings.location.trim()) {
            throw new common_1.BadRequestException('Valid backup time and directory are required');
        }
        const location = path.resolve(settings.location.trim());
        if (this.isPublicDirectory(location))
            throw new common_1.BadRequestException('Backups must be outside the public uploads directory');
        const data = { enabled: settings.enabled, time: settings.time, location: path.basename(location) === restaurantId ? location : path.join(location, restaurantId) };
        fs.mkdirSync(data.location, { recursive: true });
        await this.prisma.systemSetting.upsert({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'backup' } }, update: { data: JSON.stringify(data) }, create: { restaurantId, settingKey: 'backup', data: JSON.stringify(data) } });
        await this.applyBackupSettings(restaurantId);
        return this.getSettings(restaurantId);
    }
    async applyBackupSettings(restaurantId) {
        const settings = await this.getSettings(restaurantId);
        const jobName = `database-backup-${restaurantId}`;
        try {
            this.schedulerRegistry.deleteCronJob(jobName);
        }
        catch { }
        if (settings.enabled) {
            const [hour, minute] = settings.time.split(':');
            const job = new cron_1.CronJob(`${minute} ${hour} * * *`, () => { void this.createBackup(restaurantId, 'scheduled').catch(error => this.logger.error(error.message)); }, null, false, 'Asia/Kolkata');
            this.schedulerRegistry.addCronJob(jobName, job);
            job.start();
        }
    }
    triggerManualBackup(restaurantId) { return this.createBackup(restaurantId, 'manual'); }
    async createBackup(restaurantId, source) {
        const settings = await this.getSettings(restaurantId);
        const singleRestaurant = await this.prisma.restaurant.count() === 1;
        if (this.running.has(restaurantId))
            throw new common_1.BadRequestException('A backup is already running');
        this.running.add(restaurantId);
        const directory = path.resolve(settings.location);
        const filename = `karvaan-${new Date().toISOString().replace(/[:.]/g, '-')}-${source}-${(0, crypto_1.randomUUID)()}.${singleRestaurant ? 'db' : 'json'}.gz`;
        const dest = path.join(directory, filename);
        const snapshot = path.join(directory, `${(0, crypto_1.randomUUID)()}.snapshot.db`);
        try {
            fs.mkdirSync(directory, { recursive: true });
            if (singleRestaurant) {
                await this.prisma.$executeRawUnsafe('VACUUM INTO ?', snapshot);
                await (0, promises_1.pipeline)(fs.createReadStream(snapshot), zlib.createGzip({ level: 9 }), fs.createWriteStream(dest));
            }
            else {
                const data = await this.prisma.$transaction(async (tx) => ({
                    restaurant: await tx.restaurant.findUnique({ where: { id: restaurantId } }),
                    users: await tx.user.findMany({ where: { restaurantId } }),
                    tables: await tx.table.findMany({ where: { restaurantId } }),
                    categories: await tx.category.findMany({ where: { restaurantId } }),
                    products: await tx.product.findMany({ where: { restaurantId } }),
                    customers: await tx.customer.findMany({ where: { restaurantId } }),
                    orders: await tx.order.findMany({ where: { restaurantId }, include: { items: true } }),
                    bills: await tx.bill.findMany({ where: { restaurantId } }),
                    deliveries: await tx.deliveryOrder.findMany({ where: { restaurantId } }),
                    parkedOrders: await tx.parkedOrder.findMany({ where: { restaurantId } }),
                    inventory: await tx.inventoryItem.findMany({ where: { restaurantId }, include: { logs: true, recipeItems: true } }),
                    ledgers: await tx.ledgerEntry.findMany({ where: { customer: { restaurantId } } }),
                    waste: await tx.wasteLog.findMany({ where: { restaurantId } }),
                    returns: await tx.returnRecord.findMany({ where: { restaurantId } }),
                    settings: await tx.systemSetting.findMany({ where: { restaurantId } }),
                    printAgents: await tx.printAgent.findMany({ where: { restaurantId }, select: { id: true, restaurantId: true, name: true, lastSeenAt: true, revokedAt: true, createdAt: true } }),
                    printDestinations: await tx.printDestination.findMany({ where: { restaurantId } }),
                    printJobs: await tx.printJob.findMany({ where: { restaurantId } }),
                }), { timeout: 30000 });
                fs.writeFileSync(dest, zlib.gzipSync(JSON.stringify({ version: 1, restaurantId, createdAt: new Date().toISOString(), data })));
            }
            const sizeBytes = fs.statSync(dest).size;
            await this.prisma.backupLog.create({ data: { filename, sizeBytes, status: 'SUCCESS', restaurantId } });
            const backups = await this.listBackups(restaurantId);
            for (const old of backups.slice(30))
                fs.unlinkSync(path.join(directory, old.filename));
            return { success: true, filename, sizeKb: Math.round(sizeBytes / 1024) };
        }
        catch (error) {
            if (fs.existsSync(dest))
                fs.unlinkSync(dest);
            await this.prisma.backupLog.create({ data: { filename, status: 'FAILED', error: error.message, restaurantId } }).catch(() => { });
            throw error;
        }
        finally {
            if (fs.existsSync(snapshot))
                fs.unlinkSync(snapshot);
            this.running.delete(restaurantId);
        }
    }
    async listBackups(restaurantId) {
        const { location } = await this.getSettings(restaurantId);
        if (!fs.existsSync(location))
            return [];
        return fs.readdirSync(location).filter(name => name.startsWith('karvaan-') && /\.(db|json)\.gz$/.test(name)).map(filename => {
            const stat = fs.statSync(path.join(location, filename));
            return { filename, sizeKb: Math.round(stat.size / 1024), createdAt: stat.mtime.toISOString() };
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getBackupLogs(restaurantId) { return this.prisma.backupLog.findMany({ where: { restaurantId }, orderBy: { createdAt: 'desc' }, take: 10 }); }
};
exports.BackupService = BackupService;
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, schedule_1.SchedulerRegistry])
], BackupService);
//# sourceMappingURL=backup.service.js.map