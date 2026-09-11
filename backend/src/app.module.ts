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


@Module({
  imports: [
    // Enables @Cron() decorator for scheduled tasks (daily backup, etc.)
    ScheduleModule.forRoot(),
    BackupModule,
    HistoryModule,
    SyncModule,
    UploadModule,
    SettingsModule,
  ],

  controllers: [BillingController],
  providers: [PrismaService, KdsGateway, BillingService],
})
export class AppModule {}
