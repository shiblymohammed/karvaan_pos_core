import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [SyncController],
  providers: [SyncService, PrismaService],
  exports: [SyncService],
})
export class SyncModule {}
