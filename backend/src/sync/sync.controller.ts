import { Controller, Post, Get, Body, HttpCode, Headers, Query, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ADMIN_ROLES, Roles, RolesGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/get-user.decorator';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}
  @Post('trigger')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  triggerSync(@GetUser() user: any) { return this.syncService.triggerManualSync(user.restaurantId); }
  @Post()
  @HttpCode(200)
  receiveSyncData(@Headers('authorization') header: string, @Body() payload: any) {
    this.syncService.authenticate(header, payload?.restaurantId);
    return this.syncService.receiveSyncData(payload);
  }
  @Get('pull')
  pullSyncData(@Headers('authorization') header: string, @Query('restaurantId') restaurantId: string, @Query('since') since: string) {
    this.syncService.authenticate(header, restaurantId);
    return this.syncService.provideCloudUpdates(restaurantId, since);
  }
}