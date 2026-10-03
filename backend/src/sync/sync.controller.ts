import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerSync() {
    return this.syncService.triggerManualSync();
  }
}
