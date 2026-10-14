import { OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
export declare class BackupService implements OnModuleInit {
    private readonly prisma;
    private readonly schedulerRegistry;
    private readonly logger;
    private running;
    constructor(prisma: PrismaService, schedulerRegistry: SchedulerRegistry);
    private defaultDirectory;
    onModuleInit(): Promise<void>;
    getSettings(restaurantId: string): Promise<{
        enabled: any;
        time: any;
        location: string;
    }>;
    private isPublicDirectory;
    updateSettings(settings: any, restaurantId: string): Promise<{
        enabled: any;
        time: any;
        location: string;
    }>;
    applyBackupSettings(restaurantId: string): Promise<void>;
    triggerManualBackup(restaurantId: string): Promise<{
        success: boolean;
        filename: string;
        sizeKb: number;
    }>;
    private createBackup;
    listBackups(restaurantId: string): Promise<{
        filename: string;
        sizeKb: number;
        createdAt: string;
    }[]>;
    getBackupLogs(restaurantId: string): import(".prisma/client").Prisma.PrismaPromise<{
        error: string | null;
        id: string;
        status: string;
        createdAt: Date;
        restaurantId: string;
        filename: string;
        sizeBytes: number | null;
    }[]>;
}
