import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [SyncService, PrismaService],
  exports: [SyncService],
})
export class SyncModule {}
