import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway'; // To broadcast settings updates

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private gateway: KdsGateway
  ) {}

  async getSettings() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { id: 'singleton' },
    });
    if (!setting) {
      return {};
    }
    try {
      return JSON.parse(setting.data);
    } catch (e) {
      return {};
    }
  }

  async updateSettings(data: any) {
    // Get existing settings to merge with new
    const existing = await this.getSettings();
    const merged = { ...existing, ...data };
    
    const setting = await this.prisma.systemSetting.upsert({
      where: { id: 'singleton' },
      update: { data: JSON.stringify(merged) },
      create: { id: 'singleton', data: JSON.stringify(merged) },
    });
    
    const finalSettings = JSON.parse(setting.data);
    
    // Broadcast the update so all terminals sync
    this.gateway.server.emit('settings_updated', finalSettings);
    
    return finalSettings;
  }
}
