import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  // Assume the VPS URL is configured in .env, fallback for safety
  private vpsUrl = process.env.VPS_SYNC_URL || 'https://api.karvaan-cloud.com/sync';
  private restaurantId = process.env.RESTAURANT_ID || 'demo-restaurant-001';

  constructor(private readonly prisma: PrismaService) {}

  // Run every minute to flush local changes to VPS
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      await this.pushUnsyncedData();
    } catch (error) {
      this.logger.error(`VPS Sync failed: ${error.message}`);
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
}
