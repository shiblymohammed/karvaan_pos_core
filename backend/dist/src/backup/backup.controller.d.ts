import { BackupService } from './backup.service';
export declare class BackupController {
    private readonly backupService;
    constructor(backupService: BackupService);
    triggerBackup(user: any): Promise<{
        success: boolean;
        filename: string;
        sizeKb: number;
    }>;
    listBackups(user: any): Promise<{
        filename: string;
        sizeKb: number;
        createdAt: string;
    }[]>;
    getBackupLogs(user: any): import(".prisma/client").Prisma.PrismaPromise<{
        error: string | null;
        id: string;
        status: string;
        createdAt: Date;
        restaurantId: string;
        filename: string;
        sizeBytes: number | null;
    }[]>;
    getSettings(user: any): Promise<{
        enabled: any;
        time: any;
        location: string;
    }>;
    updateSettings(settings: any, user: any): Promise<{
        enabled: any;
        time: any;
        location: string;
    }>;
}
