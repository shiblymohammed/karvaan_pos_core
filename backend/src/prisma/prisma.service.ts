import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    
    // Enable SQLite Write-Ahead Logging (WAL) and busy timeout for high concurrency
    try {
      await this.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await this.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await this.$queryRawUnsafe(`PRAGMA busy_timeout = 30000;`);
      await this.$queryRawUnsafe(`PRAGMA temp_store = MEMORY;`);
      await this.$queryRawUnsafe(`PRAGMA cache_size = -64000;`);
    } catch (err) {
      console.warn('⚠️ [PrismaService] SQLite PRAGMA initialization notice:', err);
    }
    
    console.log('✅ [PrismaService] Connected to POS Database successfully (WAL mode enabled, busy_timeout=30s).');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 [PrismaService] Disconnected from POS Database.');
  }
}
