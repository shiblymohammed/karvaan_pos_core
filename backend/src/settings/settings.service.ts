import { Injectable, UnauthorizedException, OnModuleInit, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
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
    
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    const receipt = { receiptName: restaurant?.name || 'Karvaan POS', receiptAddress: restaurant?.address || '', receiptGstin: '' };
    if (!setting) return { ...receipt, serverRevision: 0 };
    try {
      return { ...receipt, serverRevision: 0, ...JSON.parse(setting.data) };
    } catch (e) {
      return { ...receipt, serverRevision: 0 };
    }
  }

  async updateSettings(data: any, restaurantId: string) {
    if (!restaurantId) throw new UnauthorizedException('No restaurant context');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BadRequestException('Invalid settings');
    if (typeof data.actionId !== 'string' || !data.actionId || data.actionId.length > 200 || !Number.isInteger(data.expectedRevision)) throw new BadRequestException('Refresh the app before editing settings; a stable action ID and revision are required');
    if (data.paidAddons !== undefined && (!Array.isArray(data.paidAddons) || data.paidAddons.some((a: any) => !a?.id || !a.name || !Number.isFinite(a.price) || a.price < 0))) throw new BadRequestException('Invalid add-on catalogue');
    if (data.floorConfig !== undefined && (!Array.isArray(data.floorConfig) || data.floorConfig.some((f: any) => !f?.id || !['FIXED', 'PERCENTAGE'].includes(f.surchargeType) || !Number.isFinite(f.surchargeValue) || f.surchargeValue < 0))) throw new BadRequestException('Invalid floor surcharge');
    if (data.parcelChargeAmount !== undefined && (!Number.isFinite(data.parcelChargeAmount) || data.parcelChargeAmount < 0)) throw new BadRequestException('Invalid parcel charge');
    if (data.tableConfig !== undefined && !Array.isArray(data.tableConfig)) throw new BadRequestException('Invalid table configuration');
    const finalSettings = await this.prisma.$transaction(async tx => {
      const receiptKey = { restaurantId_settingKey: { restaurantId, settingKey: `command:settings:${data.actionId}` } };
      const receipt = await tx.systemSetting.findUnique({ where: receiptKey });
      if (receipt) return JSON.parse(receipt.data);
      const current = await tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } });
      let existing: any = {};
      try { existing = JSON.parse(current?.data || '{}'); } catch {}
      const revision = existing.serverRevision || 0;
      if (data.expectedRevision !== revision) throw new ConflictException('Settings changed on another terminal. Reload current settings and review your saved changes.');
      if (data.tableConfig !== undefined) {
        for (const table of data.tableConfig) {
          if (!table?.id || !table.number || !Number.isInteger(table.capacity) || table.capacity < 1) throw new BadRequestException('Invalid dining table');
          const existing = await tx.table.findUnique({ where: { id: table.id } });
          if (existing && existing.restaurantId !== restaurantId) throw new ForbiddenException('Invalid restaurant table');
          await tx.table.upsert({ where: { id: table.id }, update: { tableNumber: table.number, capacity: table.capacity }, create: { id: table.id, restaurantId, tableNumber: table.number, capacity: table.capacity } });
        }
      }

    // Get existing settings to merge with new
    const { actionId, expectedRevision, serverRevision, ...changes } = data;
    const merged = { ...existing, ...changes, serverRevision: revision + 1 };
    
    const setting = await tx.systemSetting.upsert({
      where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } },
      update: { data: JSON.stringify(merged) },
      create: { settingKey: 'general', data: JSON.stringify(merged), restaurantId },
    });
    
      await tx.systemSetting.create({ data: { restaurantId, settingKey: receiptKey.restaurantId_settingKey.settingKey, data: setting.data } });
      return JSON.parse(setting.data);
    });
    
    // Broadcast the update so all terminals sync (Room-based broadcast needed later)
    try { this.broadcastSettings(await this.getSettings(restaurantId), restaurantId); } catch {}
    
    return finalSettings;
  }

  broadcastSettings(settings: any, restaurantId: string) {
    this.gateway?.server?.to(restaurantId).emit('settings_updated', settings);
  }
}
