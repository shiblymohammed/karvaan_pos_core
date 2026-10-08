import { Controller, Get, Post, Body } from '@nestjs/common';
import { BackupService } from './backup.service';

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * POST /backup/trigger
   * Manually trigger a database backup on demand (Admin only in production)
   */
  @Post('trigger')
  async triggerBackup() {
    return this.backupService.triggerManualBackup();
  }

  /**
   * GET /backup/list
   * Returns list of all backup archive files with size and timestamp
   */
  @Get('list')
  async listBackups() {
    return this.backupService.listBackups();
  }

  /**
   * GET /backup/logs
   * Returns last 10 backup log entries from database
   */
  @Get('logs')
  async getBackupLogs() {
    return this.backupService.getBackupLogs();
  }
  /**
   * GET /backup/settings
   * Returns current backup settings
   */
  @Get('settings')
  async getSettings() {
    return this.backupService.getSettings();
  }

  /**
   * POST /backup/settings
   * Updates backup settings
   */
  @Post('settings')
  async updateSettings(@Body() settings: any) {
    return this.backupService.updateSettings(settings);
  }
}
