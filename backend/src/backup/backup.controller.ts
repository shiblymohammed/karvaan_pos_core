import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'REST_ADMIN')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}
  @Post('trigger') triggerBackup(@GetUser() user: any) { return this.backupService.triggerManualBackup(user.restaurantId); }
  @Get('list') listBackups(@GetUser() user: any) { return this.backupService.listBackups(user.restaurantId); }
  @Get('logs') getBackupLogs(@GetUser() user: any) { return this.backupService.getBackupLogs(user.restaurantId); }
  @Get('settings') getSettings(@GetUser() user: any) { return this.backupService.getSettings(user.restaurantId); }
  @Post('settings') updateSettings(@Body() settings: any, @GetUser() user: any) { return this.backupService.updateSettings(settings, user.restaurantId); }
}