import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    
    // Enable SQLite Write-Ahead Logging (WAL) for concurrency
    await this.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    
    console.log('✅ [PrismaService] Connected to POS Database successfully (WAL mode enabled).');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 [PrismaService] Disconnected from POS Database.');
  }
}
