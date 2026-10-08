import { BackupService } from './backup.service';
export declare class BackupController {
    private readonly backupService;
    constructor(backupService: BackupService);
    triggerBackup(): Promise<{
        success: boolean;
        filename: string;
        sizeKb: number;
    }>;
    listBackups(): Promise<{
        filename: string;
        sizeKb: number;
        createdAt: string;
    }[]>;
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
