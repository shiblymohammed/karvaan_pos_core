import { PrismaService } from '../prisma/prisma.service';
export declare class BackupService {
    private readonly prisma;
    private readonly logger;
    private readonly DB_PATH;
    private readonly BACKUP_DIR;
    private readonly MAX_BACKUPS;
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
        filename: string;
        sizeBytes: number | null;
        status: string;
        createdAt: Date;
    }[]>;
}
