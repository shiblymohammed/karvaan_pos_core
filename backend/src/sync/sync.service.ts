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

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService
  ) {}

  // Run every minute to flush local changes to VPS
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      await this.pushUnsyncedData();
      await this.pullUpdatesFromCloud();
    } catch (error) {
      this.logger.error(`VPS Sync failed: ${error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async triggerManualSync() {
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

  private async pushUnsyncedData() {
    // 1. Gather all unsynced data
    const unsyncedBills = await this.prisma.bill.findMany({ where: { syncedAt: null } });
    const unsyncedOrders = await this.prisma.order.findMany({ where: { syncedAt: null } });
    const unsyncedCustomers = await this.prisma.customer.findMany({ where: { syncedAt: null } });
    
    // Delivery and stock logs
    const unsyncedDeliveries = await this.prisma.deliveryOrder.findMany({ where: { syncedAt: null } });
    const unsyncedStockLogs = await this.prisma.stockLog.findMany({ where: { syncedAt: null } });

    const totalItems = unsyncedBills.length + unsyncedOrders.length + unsyncedCustomers.length + unsyncedDeliveries.length + unsyncedStockLogs.length;

    if (totalItems === 0) {
      return; // Nothing to sync
    }

    this.logger.log(`Found ${totalItems} unsynced records. Pushing to VPS...`);

    const payload = {
      restaurantId: this.restaurantId,
      timestamp: new Date().toISOString(),
      data: {
        bills: unsyncedBills,
        orders: unsyncedOrders,
        customers: unsyncedCustomers,
        deliveries: unsyncedDeliveries,
        stockLogs: unsyncedStockLogs
      }
    };

    // 2. Transmit to VPS
    // (In a real implementation, we use fetch or axios. Using fetch for now)
    const response = await fetch(this.vpsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${await response.text()}`);
    }

    const now = new Date();

    // 3. Mark as synced locally using transactions
    await this.prisma.$transaction([
      this.prisma.bill.updateMany({
        where: { id: { in: unsyncedBills.map(b => b.id) } },
        data: { syncedAt: now }
      }),
      this.prisma.order.updateMany({
        where: { id: { in: unsyncedOrders.map(o => o.id) } },
        data: { syncedAt: now }
      }),
      this.prisma.customer.updateMany({
        where: { id: { in: unsyncedCustomers.map(c => c.id) } },
        data: { syncedAt: now }
      }),
      this.prisma.deliveryOrder.updateMany({
        where: { id: { in: unsyncedDeliveries.map(d => d.id) } },
        data: { syncedAt: now }
      }),
      this.prisma.stockLog.updateMany({
        where: { id: { in: unsyncedStockLogs.map(l => l.id) } },
        data: { syncedAt: now }
      })
    ]);

    this.logger.log(`✅ Successfully synced ${totalItems} records to VPS.`);
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
      // In a real implementation, you'd track the last sync timestamp
      // to only pull delta changes. For now, we simulate pulling changes.
      const response = await fetch(`${this.vpsUrl}/pull?restaurantId=${this.restaurantId}`);
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

      const { products = [], categories = [], users = [], settings = null } = data;

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
        await this.settingsService.updateSettings(settings);
        this.logger.log(`✅ Successfully updated system settings from VPS.`);
      }

      let updateCount = 0;

      // Use sequential upserts inside a transaction to prevent partial updates
      await this.prisma.$transaction(async (tx) => {
        for (const cat of categories) {
          await tx.category.upsert({
            where: { id: cat.id },
            update: { name: cat.name, sortOrder: cat.sortOrder },
            create: { id: cat.id, name: cat.name, sortOrder: cat.sortOrder }
          });
          updateCount++;
        }

        for (const prod of products) {
          await tx.product.upsert({
            where: { id: prod.id },
            update: { 
              name: prod.name, price: prod.price, categoryId: prod.categoryId, 
              isAvailable: prod.isAvailable, imageUrl: prod.imageUrl 
            },
            create: { 
              id: prod.id, name: prod.name, price: prod.price, 
              categoryId: prod.categoryId, isAvailable: prod.isAvailable, imageUrl: prod.imageUrl 
            }
          });
          updateCount++;
        }

        for (const user of users) {
          await tx.user.upsert({
            where: { id: user.id },
            update: { name: user.name, role: user.role, pin: user.pin, isActive: user.isActive },
            create: { id: user.id, name: user.name, role: user.role, pin: user.pin, isActive: user.isActive }
          });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        this.logger.log(`✅ Successfully pulled and updated ${updateCount} configuration records from VPS.`);
      }
    } catch (error) {
      // Don't throw, just log so it doesn't break the cron job or manual trigger if cloud is offline
      this.logger.warn(`Failed to pull updates from VPS: ${error.message}`);
    }
  }
}
