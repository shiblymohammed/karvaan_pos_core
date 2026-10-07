import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@GetUser() user: any) {
    return this.settingsService.getSettings(user.restaurantId);
  }

  @Put()
  async updateSettings(@Body() data: UpdateSettingsDto, @GetUser() user: any) {
    return this.settingsService.updateSettings(data, user.restaurantId);
  }
}
