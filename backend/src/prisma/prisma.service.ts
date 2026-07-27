import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ [PrismaService] Connected to POS Database successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 [PrismaService] Disconnected from POS Database.');
  }
}
