import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  // Assume the VPS URL is configured in .env, fallback for safety
  private vpsUrl = process.env.VPS_SYNC_URL || 'https://api.karvaan-cloud.com/sync';
  private restaurantId = process.env.RESTAURANT_ID || 'demo-restaurant-001';
  private cloudSyncApiKey = process.env.CLOUD_SYNC_API_KEY || 'default_demo_key';

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService
  ) {}

  // Run every minute, but only execute if enabled in UI settings
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronSync() {
    if (this.isSyncing) return;
    // Safety check: The central cloud server should never run the local push/pull cron job
    if (process.env.IS_CLOUD === 'true') return;

    this.isSyncing = true;

    try {
      // Check if Cloud Sync is toggled ON in the frontend settings
      const settings = await this.settingsService.getSettings(this.restaurantId);
      if (!settings?.cloudSyncEnabled) {
        return; // Silently skip if disabled
      }

      await this.pushUnsyncedData();
      await this.pullUpdatesFromCloud();
    } catch (error) {
      this.logger.error(`VPS Sync failed: ${error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async triggerManualSync() {
    if (process.env.IS_CLOUD === 'true') return { status: 'error', message: 'Cloud servers cannot trigger local syncs' };
    if (this.isSyncing) return { status: 'already_running', message: 'Sync is already in progress' };
    this.isSyncing = true;
    
    try {
      await this.pushUnsyncedData();
      await this.pullUpdatesFromCloud();
      return { status: 'success', message: 'Sync completed successfully' };
    } catch (error) {
      this.logger.error(`Manual sync failed: ${error.message}`);
      return { status: 'error', message: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  private async getSyncState() {
    const raw = await this.prisma.systemSetting.findUnique({
      where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_state' } }
    });
    if (!raw) return { lastPushTime: new Date(0), lastPullTime: new Date(0) };
    try {
      const data = JSON.parse(raw.data);
      return { 
        lastPushTime: data.lastPushTime ? new Date(data.lastPushTime) : new Date(0),
        lastPullTime: data.lastPullTime ? new Date(data.lastPullTime) : new Date(0)
      };
    } catch {
      return { lastPushTime: new Date(0), lastPullTime: new Date(0) };
    }
  }

  private async saveSyncState(state: { lastPushTime?: Date, lastPullTime?: Date }) {
    const current = await this.getSyncState();
    const newState = {
      lastPushTime: state.lastPushTime || current.lastPushTime,
      lastPullTime: state.lastPullTime || current.lastPullTime
    };
    await this.prisma.systemSetting.upsert({
      where: { restaurantId_settingKey: { restaurantId: this.restaurantId, settingKey: 'sync_state' } },
      update: { data: JSON.stringify(newState) },
      create: { restaurantId: this.restaurantId, settingKey: 'sync_state', data: JSON.stringify(newState) }
    });
  }

  private async pushUnsyncedData() {
    const syncState = await this.getSyncState();
    const pushThreshold = syncState.lastPushTime;
    const syncStart = new Date();

    // 1. Gather all data updated since last push
    const bills = await this.prisma.bill.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const orders = await this.prisma.order.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const customers = await this.prisma.customer.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const deliveries = await this.prisma.deliveryOrder.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const stockLogs = await this.prisma.stockLog.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const wasteLogs = await this.prisma.wasteLog.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const returns = await this.prisma.returnRecord.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const ledgers = await this.prisma.ledgerEntry.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    
    // Also push up master config changes made locally
    const products = await this.prisma.product.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const inventoryItems = await this.prisma.inventoryItem.findMany({ where: { updatedAt: { gt: pushThreshold } } });
    const recipes = await this.prisma.recipeIngredient.findMany({ where: { updatedAt: { gt: pushThreshold } } });

    const totalItems = bills.length + orders.length + customers.length + deliveries.length + stockLogs.length + wasteLogs.length + returns.length + ledgers.length + products.length + inventoryItems.length + recipes.length;

    if (totalItems === 0) return;

    this.logger.log(`Found ${totalItems} modified records. Pushing Delta to VPS...`);

    const payload = {
      restaurantId: this.restaurantId,
      timestamp: syncStart.toISOString(),
      data: {
        bills, orders, customers, deliveries, stockLogs, wasteLogs, returns, ledgers, products, inventoryItems, recipes
      }
    };

    const response = await fetch(this.vpsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.cloudSyncApiKey}` },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Server returned ${response.status}: ${await response.text()}`);

    // Update last push time
    await this.saveSyncState({ lastPushTime: syncStart });
    this.logger.log(`✅ Successfully pushed ${totalItems} records to VPS.`);
  }

  async receiveSyncData(payload: any) {
    const { restaurantId, data } = payload;
    if (!restaurantId || !data) return { status: 'error', message: 'Invalid payload' };

    const { bills = [], orders = [], customers = [], deliveries = [], stockLogs = [], wasteLogs = [], returns = [], ledgers = [], products = [], inventoryItems = [], recipes = [] } = data;
    let recordsUpserted = 0;

    this.logger.log(`📥 [Cloud Receiver] Incoming Delta sync from restaurant: ${restaurantId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Master Data First (Foreign Keys)
        for (const item of inventoryItems) {
          await tx.inventoryItem.upsert({ where: { id: item.id }, update: { ...item }, create: { ...item } }); recordsUpserted++;
        }
        for (const prod of products) {
          await tx.product.upsert({ where: { id: prod.id }, update: { ...prod }, create: { ...prod } }); recordsUpserted++;
        }
        for (const rec of recipes) {
          await tx.recipeIngredient.upsert({ where: { id: rec.id }, update: { ...rec }, create: { ...rec } }); recordsUpserted++;
        }
        for (const customer of customers) {
          await tx.customer.upsert({ where: { id: customer.id }, update: { ...customer }, create: { ...customer } }); recordsUpserted++;
        }
        for (const order of orders) {
          await tx.order.upsert({ where: { id: order.id }, update: { ...order }, create: { ...order } }); recordsUpserted++;
        }
        for (const bill of bills) {
          await tx.bill.upsert({ where: { id: bill.id }, update: { ...bill }, create: { ...bill } }); recordsUpserted++;
        }
        for (const delivery of deliveries) {
          await tx.deliveryOrder.upsert({ where: { id: delivery.id }, update: { ...delivery }, create: { ...delivery } }); recordsUpserted++;
        }
        for (const log of stockLogs) {
          await tx.stockLog.upsert({ where: { id: log.id }, update: { ...log }, create: { ...log } }); recordsUpserted++;
        }
        for (const log of wasteLogs) {
          await tx.wasteLog.upsert({ where: { id: log.id }, update: { ...log }, create: { ...log } }); recordsUpserted++;
        }
        for (const ret of returns) {
          await tx.returnRecord.upsert({ where: { id: ret.id }, update: { ...ret }, create: { ...ret } }); recordsUpserted++;
        }
        for (const ledger of ledgers) {
          await tx.ledgerEntry.upsert({ where: { id: ledger.id }, update: { ...ledger }, create: { ...ledger } }); recordsUpserted++;
        }
      });
      
      this.logger.log(`✅ [Cloud Receiver] Successfully saved ${recordsUpserted} delta records.`);
      return { status: 'success', recordsSaved: recordsUpserted };
      
    } catch (e) {
      this.logger.error(`❌ [Cloud Receiver] Save failed: ${e.message}`);
      throw e;
    }
  }

  async provideCloudUpdates(restaurantId: string, pullThresholdStr: string) {
    if (!restaurantId) return {};
    
    const pullThreshold = pullThresholdStr ? new Date(pullThresholdStr) : new Date(0);

    const products = await this.prisma.product.findMany({ where: { restaurantId, updatedAt: { gt: pullThreshold } } });
    const categories = await this.prisma.category.findMany({ where: { restaurantId, updatedAt: { gt: pullThreshold } } });
    const users = await this.prisma.user.findMany({ where: { restaurantId, updatedAt: { gt: pullThreshold } } });
    const inventoryItems = await this.prisma.inventoryItem.findMany({ where: { restaurantId, updatedAt: { gt: pullThreshold } } });
    const recipes = await this.prisma.recipeIngredient.findMany({ where: { product: { restaurantId }, updatedAt: { gt: pullThreshold } } });
    
    const settingsRaw = await this.prisma.systemSetting.findUnique({ 
      where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } 
    });

    let settings = null;
    // Always provide settings for now, it's lightweight
    if (settingsRaw) {
      try { settings = JSON.parse(settingsRaw.data); } catch {}
    }

    return {
      products, categories, users, inventoryItems, recipes, settings
    };
  }

  private async downloadAndCacheMedia(url: string): Promise<string> {
    if (!url || url.startsWith('/uploads/') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return url; // Already local or empty
    }

    try {
      this.logger.log(`Downloading remote promotional media: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }

      const parsedUrl = new URL(url);
      const extMatch = parsedUrl.pathname.match(/\.[0-9a-z]+$/i);
      const ext = extMatch ? extMatch[0] : '.mp4'; // default to mp4
      const filename = `cloud-promo-${Date.now()}-${Math.round(Math.random() * 10000)}${ext}`;
      
      const uploadDir = './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

      this.logger.log(`✅ Media saved locally to: /uploads/${filename}`);
      return `/uploads/${filename}`;
    } catch (e) {
      this.logger.warn(`Could not download media ${url}: ${e.message}`);
      return url; // Fallback to remote URL if download fails
    }
  }

  private async pullUpdatesFromCloud() {
    this.logger.log(`Checking for latest updates from VPS...`);
    try {
      const syncState = await this.getSyncState();
      const pullThreshold = syncState.lastPullTime;
      const pullStart = new Date();

      const response = await fetch(`${this.vpsUrl}/pull?restaurantId=${this.restaurantId}&since=${pullThreshold.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${this.cloudSyncApiKey}`
        }
      });
      if (!response.ok) {
        if (response.status === 404 || response.status === 502 || response.status === 500) {
           this.logger.log(`VPS pull endpoint not reachable or implemented yet. Skipping pull.`);
           return;
        }
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (!data || Object.keys(data).length === 0) {
        return; // Nothing to update
      }

      const { products = [], categories = [], users = [], inventoryItems = [], recipes = [], settings = null } = data;

      // 1. Process Settings & Download Media
      if (settings) {
        if (settings.orderTvPromoMedia && Array.isArray(settings.orderTvPromoMedia)) {
          for (let i = 0; i < settings.orderTvPromoMedia.length; i++) {
            const media = settings.orderTvPromoMedia[i];
            if (media && media.url) {
              media.url = await this.downloadAndCacheMedia(media.url);
            }
          }
        }
        await this.settingsService.updateSettings(settings, this.restaurantId);
        this.logger.log(`✅ Successfully updated system settings from VPS.`);
      }

      let updateCount = 0;

      // Use sequential upserts inside a transaction to prevent partial updates
      await this.prisma.$transaction(async (tx) => {
        for (const cat of categories) {
          await tx.category.upsert({
            where: { id: cat.id },
            update: { ...cat },
            create: { ...cat }
          });
          updateCount++;
        }

        for (const prod of products) {
          await tx.product.upsert({
            where: { id: prod.id },
            update: { ...prod },
            create: { ...prod }
          });
          updateCount++;
        }

        for (const user of users) {
          await tx.user.upsert({
            where: { id: user.id },
            update: { ...user },
            create: { ...user }
          });
          updateCount++;
        }

        for (const item of inventoryItems) {
          await tx.inventoryItem.upsert({
            where: { id: item.id },
            update: { ...item },
            create: { ...item }
          });
          updateCount++;
        }

        for (const rec of recipes) {
          await tx.recipeIngredient.upsert({
            where: { id: rec.id },
            update: { ...rec },
            create: { ...rec }
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await this.saveSyncState({ lastPullTime: pullStart });
        this.logger.log(`✅ Successfully pulled and updated ${updateCount} delta records from VPS.`);
      }
    } catch (error) {
      // Don't throw, just log so it doesn't break the cron job or manual trigger if cloud is offline
      this.logger.warn(`Failed to pull updates from VPS: ${error.message}`);
    }
  }
}
