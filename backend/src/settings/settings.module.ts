import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PrismaService, KdsGateway],
  exports: [SettingsService],
})
export class SettingsModule {}
