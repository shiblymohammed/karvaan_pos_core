import { Controller, Post, Get, Body, HttpCode, HttpStatus, Headers, UnauthorizedException, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerSync() {
    return this.syncService.triggerManualSync();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveSyncData(
    @Headers('authorization') authHeader: string,
    @Body() payload: any
  ) {
    const token = authHeader?.split(' ')[1];
    if (token !== (process.env.CLOUD_SYNC_API_KEY || 'default_demo_key')) {
      throw new UnauthorizedException('Invalid Cloud Sync API Key');
    }
    return this.syncService.receiveSyncData(payload);
  }

  @Get('pull')
  @HttpCode(HttpStatus.OK)
  async pullSyncData(
    @Headers('authorization') authHeader: string,
    @Query('restaurantId') restaurantId: string,
    @Query('since') since: string
  ) {
    const token = authHeader?.split(' ')[1];
    if (token !== (process.env.CLOUD_SYNC_API_KEY || 'default_demo_key')) {
      throw new UnauthorizedException('Invalid Cloud Sync API Key');
    }
    return this.syncService.provideCloudUpdates(restaurantId, since);
  }
}
