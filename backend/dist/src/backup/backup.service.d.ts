import { PrismaService } from '../prisma/prisma.service';
export declare class BackupService {
    private readonly prisma;
    private readonly logger;
    private readonly DB_PATH;
    private readonly BACKUP_DIR;
    private readonly MAX_BACKUPS;
    private readonly restaurantId;
    constructor(prisma: PrismaService);
    runDailyBackup(): Promise<void>;
    triggerManualBackup(): Promise<{
        success: boolean;
        filename: string;
        sizeKb: number;
    }>;
    private createBackup;
    private pruneOldBackups;
    listBackups(): Promise<Array<{
        filename: string;
        sizeKb: number;
        createdAt: string;
    }>>;
    getBackupLogs(): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        restaurantId: string;
        status: string;
        filename: string;
        sizeBytes: number | null;
    }[]>;
}
