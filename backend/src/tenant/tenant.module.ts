import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
