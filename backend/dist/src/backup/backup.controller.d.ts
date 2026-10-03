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
        status: string;
        createdAt: Date;
        filename: string;
        sizeBytes: number | null;
    }[]>;
}
