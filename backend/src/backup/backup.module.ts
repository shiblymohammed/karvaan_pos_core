import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService, PrismaService],
  exports: [BackupService],
})
export class BackupModule {}
