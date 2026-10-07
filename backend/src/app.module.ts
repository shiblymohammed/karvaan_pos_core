import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { KdsGateway } from './kds/kds.gateway';
import { BillingService } from './billing/billing.service';
import { BillingController } from './billing/billing.controller';
import { BackupModule } from './backup/backup.module';
import { HistoryModule } from './history/history.module';
import { SyncModule } from './sync/sync.module';
import { UploadModule } from './upload/upload.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { PrinterModule } from './printer/printer.module';

@Module({
  imports: [
    // Enables @Cron() decorator for scheduled tasks (daily backup, etc.)
    ScheduleModule.forRoot(),
    BackupModule,
    HistoryModule,
    SyncModule,
    UploadModule,
    SettingsModule,
    AuthModule,
    PrismaModule,
    TenantModule,
    PrinterModule,
  ],

  controllers: [BillingController],
  providers: [PrismaService, KdsGateway, BillingService],
})
export class AppModule {}
