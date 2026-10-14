import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [PrismaModule, BackupModule],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
