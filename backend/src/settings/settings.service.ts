import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway'; // To broadcast settings updates

@Injectable()
export class SettingsService implements OnModuleInit {
  private gateway: KdsGateway;

  constructor(
    private prisma: PrismaService,
    private moduleRef: ModuleRef
  ) {}

  onModuleInit() {
    this.gateway = this.moduleRef.get(KdsGateway, { strict: false });
  }

  async getSettings(restaurantId: string) {
    if (!restaurantId) throw new UnauthorizedException('No restaurant context');

    const setting = await this.prisma.systemSetting.findUnique({
      where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } },
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

  async updateSettings(data: any, restaurantId: string) {
    if (!restaurantId) throw new UnauthorizedException('No restaurant context');

    // Get existing settings to merge with new
    const existing = await this.getSettings(restaurantId);
    const merged = { ...existing, ...data };
    
    const setting = await this.prisma.systemSetting.upsert({
      where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } },
      update: { data: JSON.stringify(merged) },
      create: { settingKey: 'general', data: JSON.stringify(merged), restaurantId },
    });
    
    const finalSettings = JSON.parse(setting.data);
    
    // Broadcast the update so all terminals sync (Room-based broadcast needed later)
    this.gateway.server.emit('settings_updated', finalSettings);
    
    return finalSettings;
  }
}
