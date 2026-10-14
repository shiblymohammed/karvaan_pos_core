import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;
  private readonly restaurantId = process.env.RESTAURANT_ID;
  private readonly vpsUrl = process.env.VPS_SYNC_URL;
  private readonly apiKey = process.env.CLOUD_SYNC_API_KEY;
  constructor(private readonly prisma: PrismaService, private readonly settingsService: SettingsService) {}

  authenticate(header: string, restaurantId: string) {
    let keys: Record<string, string> = {};
    try { keys = JSON.parse(process.env.CLOUD_SYNC_KEYS || '{}'); } catch { throw new UnauthorizedException('Cloud sync is not configured'); }
    const expected = keys?.[restaurantId] || (restaurantId === this.restaurantId ? this.apiKey : undefined);
    const token = /^Bearer (.+)$/.exec(header || '')?.[1];
    if (!restaurantId || typeof expected !== 'string' || !expected || expected === 'default_demo_key' || !token || !timingSafeEqual(createHash('sha256').update(expected).digest(), createHash('sha256').update(token).digest())) {
      throw new UnauthorizedException('Invalid restaurant sync credentials');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronSync() {
    if (process.env.IS_CLOUD === 'true' || this.isSyncing || !this.restaurantId) return;
    const settings = await this.settingsService.getSettings(this.restaurantId);
    if (!settings.cloudSyncEnabled) return;
    await this.triggerManualSync(this.restaurantId);
  }

  async triggerManualSync(restaurantId: string) {
    if (process.env.IS_CLOUD === 'true') throw new BadRequestException('Cloud servers cannot trigger local synchronization');
    if (!restaurantId || restaurantId !== this.restaurantId) throw new ForbiddenException('Sync belongs to the configured restaurant');
    if (!this.vpsUrl || !this.apiKey || this.apiKey === 'default_demo_key') throw new BadRequestException('Configure VPS_SYNC_URL and a private CLOUD_SYNC_API_KEY');
    if (this.isSyncing) return { status: 'already_running' };
    this.isSyncing = true;
    try {
      await this.pushUnsyncedData();
      await this.pullUpdatesFromCloud();
      return { status: 'success', message: 'Sync completed successfully' };
    } catch (error) {
      this.logger.error('Cloud synchronization failed');
      throw new BadRequestException('Cloud synchronization failed; no cursor was advanced for the failed transfer');
    } finally { this.isSyncing = false; }
  }

  private async state() {
    const record = await this.prisma.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_state' } } });
    let data: any = {};
    try { data = JSON.parse(record?.data || '{}'); } catch {}
    return { lastPushTime: new Date(data.lastPushTime || 0), lastPullTime: new Date(data.lastPullTime || 0) };
  }
  private async saveState(change: any) {
    const data = JSON.stringify({ ...await this.state(), ...change });
    await this.prisma.systemSetting.upsert({ where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_state' } }, update: { data }, create: { restaurantId: this.restaurantId, settingKey: 'sync_state', data } });
  }

  private async pushUnsyncedData() {
    const start = new Date();
    const { lastPushTime } = await this.state();
    const updatedAt = { gte: lastPushTime, lte: start };
    const tenant = { restaurantId: this.restaurantId, updatedAt };
    const data: any = {
      restaurants: await this.prisma.restaurant.findMany({ where: { id: this.restaurantId } }),
      users: await this.prisma.user.findMany({ where: tenant }),
      categories: await this.prisma.category.findMany({ where: tenant }),
      products: await this.prisma.product.findMany({ where: tenant }),
      inventoryItems: await this.prisma.inventoryItem.findMany({ where: tenant }),
      recipes: await this.prisma.recipeIngredient.findMany({ where: { product: { restaurantId: this.restaurantId }, updatedAt } }),
      tables: await this.prisma.table.findMany({ where: tenant }),
      customers: await this.prisma.customer.findMany({ where: tenant }),
      orders: await this.prisma.order.findMany({ where: { restaurantId: this.restaurantId, OR: [{ updatedAt }, { items: { some: { updatedAt } } }] } }),
      orderItems: await this.prisma.orderItem.findMany({ where: { order: { restaurantId: this.restaurantId }, OR: [{ updatedAt }, { order: { updatedAt } }] } }),
      bills: await this.prisma.bill.findMany({ where: tenant }),
      deliveries: await this.prisma.deliveryOrder.findMany({ where: tenant }),
      stockLogs: await this.prisma.stockLog.findMany({ where: { item: { restaurantId: this.restaurantId }, updatedAt } }),
      wasteLogs: await this.prisma.wasteLog.findMany({ where: tenant }),
      returns: await this.prisma.returnRecord.findMany({ where: tenant }),
      ledgers: await this.prisma.ledgerEntry.findMany({ where: { customer: { restaurantId: this.restaurantId }, updatedAt } }),
      settings: await this.prisma.systemSetting.findMany({ where: { ...tenant, settingKey: 'general' } }),
    };
    const tRec = await this.prisma.systemSetting.findUnique({
      where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_tombstones' } }
    });
    let tombstones: any[] = [];
    try { tombstones = JSON.parse(tRec?.data || '[]'); } catch {}
    data.tombstones = tombstones;

    const response = await fetch(this.vpsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ restaurantId: this.restaurantId, data }), signal: AbortSignal.timeout(30000) });
    if (!response.ok || (await response.json()).status !== 'success') throw new Error('Cloud rejected the transfer');
    if (tombstones.length > 0) {
      await this.prisma.systemSetting.upsert({
        where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_tombstones' } },
        update: { data: '[]' },
        create: { restaurantId: this.restaurantId, settingKey: 'sync_tombstones', data: '[]' },
      });
    }
    await this.saveState({ lastPushTime: start });
  }

  async receiveSyncData(payload: any) {
    if (typeof payload?.restaurantId !== 'string' || !payload.data || typeof payload.data !== 'object') throw new BadRequestException('Invalid sync payload');
    const restaurantId = payload.restaurantId;
    const data = payload.data;
    let count = 0;
    await this.prisma.$transaction(async tx => {
      // Restaurants and owners must be provisioned by the cloud administrator; a replica cannot create global accounts.
      const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant) throw new BadRequestException('Provision the restaurant and owner on the receiver before synchronization');
      const assertReference = async (model: string, id: string, relation?: string) => {
        if (!id) return;
        const record = await (tx as any)[model].findUnique({ where: { id }, ...(relation ? { include: { [relation]: true } } : {}) });
        if (!record || (relation ? record[relation]?.restaurantId : record.restaurantId) !== restaurantId) throw new ForbiddenException('Cross-restaurant sync reference');
      };
      const groups = [
        ['users', 'user'], ['categories', 'category'], ['inventoryItems', 'inventoryItem'], ['products', 'product'],
        ['recipes', 'recipeIngredient'], ['tables', 'table'], ['customers', 'customer'], ['orders', 'order'],
        ['orderItems', 'orderItem'], ['bills', 'bill'], ['deliveries', 'deliveryOrder'], ['stockLogs', 'stockLog'],
        ['wasteLogs', 'wasteLog'], ['returns', 'returnRecord'], ['ledgers', 'ledgerEntry'], ['settings', 'systemSetting'],
      ];
      for (const [key, model] of groups) {
        const rows = data[key] || [];
        if (!Array.isArray(rows) || rows.length > 10000) throw new BadRequestException('Invalid sync records');
        for (const row of rows) {
          if (typeof row?.id !== 'string' || !row.updatedAt || !Number.isFinite(new Date(row.updatedAt).getTime())) throw new BadRequestException('Invalid sync record');
          const relation = model === 'recipeIngredient' ? 'product' : model === 'orderItem' ? 'order' : model === 'stockLog' ? 'item' : model === 'ledgerEntry' ? 'customer' : null;
          if (!relation && row.restaurantId !== restaurantId) throw new ForbiddenException('Cross-restaurant sync record');
          if (model === 'user' && !['ADMIN', 'REST_ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DELIVERY'].includes(row.role)) throw new ForbiddenException('Global accounts cannot be synchronized by a restaurant');
          if (model === 'systemSetting' && row.settingKey !== 'general') throw new ForbiddenException('Only restaurant settings can be synchronized');
          if (model === 'product') await assertReference('category', row.categoryId);
          if (model === 'recipeIngredient') { await assertReference('product', row.productId); await assertReference('inventoryItem', row.inventoryItemId); }
          if (model === 'order') { await assertReference('table', row.tableId); await assertReference('user', row.waiterId); await assertReference('customer', row.customerId); }
          if (model === 'orderItem') { await assertReference('order', row.orderId); await assertReference('product', row.productId); }
          if (model === 'bill') { await assertReference('order', row.orderId); await assertReference('user', row.cashierId); }
          if (model === 'deliveryOrder') await assertReference('user', row.riderId);
          if (model === 'stockLog') await assertReference('inventoryItem', row.itemId);
          if (model === 'ledgerEntry') await assertReference('customer', row.customerId);
          const delegate = (tx as any)[model];
          const existing = await delegate.findUnique({ where: { id: row.id }, ...(relation ? { include: { [relation]: true } } : {}) });
          if (existing && (relation ? existing[relation]?.restaurantId : existing.restaurantId) !== restaurantId) throw new ForbiddenException('Cross-restaurant overwrite');
          if (existing && new Date(existing.updatedAt) >= new Date(row.updatedAt)) continue;
          await delegate.upsert({ where: { id: row.id }, update: row, create: row });
          count++;
        }
      }

      if (Array.isArray(data.tombstones) && data.tombstones.length > 0) {
        for (const t of data.tombstones) {
          if (!t.model || !t.id) continue;
          const delegate = (tx as any)[t.model];
          if (!delegate) continue;
          try {
            const record = await delegate.findUnique({ where: { id: t.id } });
            if (record && (record.restaurantId === restaurantId || !record.restaurantId)) {
              if (t.model === 'product') {
                const orderCount = await tx.orderItem.count({ where: { productId: t.id } });
                if (orderCount === 0) {
                  await tx.recipeIngredient.deleteMany({ where: { productId: t.id } });
                  await tx.product.delete({ where: { id: t.id } });
                } else {
                  await tx.product.update({ where: { id: t.id }, data: { isAvailable: false } });
                }
              } else if (t.model === 'category') {
                const prodCount = await tx.product.count({ where: { categoryId: t.id } });
                if (prodCount === 0) {
                  await tx.category.delete({ where: { id: t.id } });
                }
              } else {
                await delegate.delete({ where: { id: t.id } }).catch(() => {});
              }
            }
          } catch {}
        }
      }
    }, { timeout: 30000 });
    return { status: 'success', recordsSaved: count };
  }

  async provideCloudUpdates(restaurantId: string, since: string) {
    const end = new Date();
    const start = new Date(since || 0);
    if (!Number.isFinite(start.getTime())) throw new BadRequestException('Invalid sync cursor');
    const where = { restaurantId, updatedAt: { gte: start, lte: end } };
    const tRec = await this.prisma.systemSetting.findUnique({
      where: { restaurantId_settingKey: { restaurantId, settingKey: 'sync_tombstones' } }
    });
    let tombstones: any[] = [];
    try { tombstones = JSON.parse(tRec?.data || '[]'); } catch {}

    return { cursor: end.toISOString(), data: {
      products: await this.prisma.product.findMany({ where }), categories: await this.prisma.category.findMany({ where }),
      users: await this.prisma.user.findMany({ where }), inventoryItems: await this.prisma.inventoryItem.findMany({ where }),
      recipes: await this.prisma.recipeIngredient.findMany({ where: { product: { restaurantId }, updatedAt: where.updatedAt } }),
      tables: await this.prisma.table.findMany({ where }), settings: await this.prisma.systemSetting.findMany({ where: { ...where, settingKey: 'general' } }),
      tombstones,
    } };
  }

  private async pullUpdatesFromCloud() {
    const { lastPullTime } = await this.state();
    const response = await fetch(`${this.vpsUrl.replace(/\/$/, '')}/pull?restaurantId=${encodeURIComponent(this.restaurantId)}&since=${encodeURIComponent(lastPullTime.toISOString())}`, { headers: { Authorization: `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Cloud pull failed');
    const payload = await response.json();
    if (!payload.cursor || !Number.isFinite(new Date(payload.cursor).getTime()) || !payload.data) throw new Error('Invalid cloud response');
    await this.receiveSyncData({ restaurantId: this.restaurantId, data: payload.data });
    if (payload.data.settings?.length) {
      const current = await this.settingsService.getSettings(this.restaurantId);
      this.settingsService.broadcastSettings(current, this.restaurantId);
    }
    await this.saveState({ lastPullTime: new Date(payload.cursor) });
  }
}
