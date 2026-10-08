import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Run sync on startup after a small delay
    setTimeout(() => {
      this.syncLocalImagesToCloudinary();
    }, 5000);
  }

  // Run every 4 hours
  @Cron(CronExpression.EVERY_4_HOURS)
  async handleCron() {
    this.logger.log('Running periodic Cloudinary sync...');
    await this.syncLocalImagesToCloudinary();
  }

  async syncLocalImagesToCloudinary() {
    this.logger.log('Starting sync of local images to Cloudinary...');

    try {
      // 1. Sync Categories
      const categories = await this.prisma.category.findMany({
        where: {
          imageUrl: {
            startsWith: '/uploads/',
          },
        },
      });

      for (const category of categories) {
        await this.uploadAndUpdate(category.imageUrl, 'category', category.id);
      }

      // 2. Sync Products
      const products = await this.prisma.product.findMany({
        where: {
          imageUrl: {
            startsWith: '/uploads/',
          },
        },
      });

      for (const product of products) {
        await this.uploadAndUpdate(product.imageUrl, 'product', product.id);
      }

      this.logger.log('Finished syncing local images to Cloudinary.');
    } catch (error) {
      this.logger.error('Error syncing images to Cloudinary:', error);
    }
  }

  private async uploadAndUpdate(localUrl: string, type: 'category' | 'product', id: string) {
    try {
      const filename = localUrl.replace('/uploads/', '');
      const filePath = path.join(process.cwd(), 'uploads', filename);

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`File not found for ${type} ${id}: ${filePath}`);
        return;
      }

      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'karvaan_pos',
        use_filename: true,
        unique_filename: true,
      });

      const secureUrl = result.secure_url;

      if (type === 'category') {
        await this.prisma.category.update({
          where: { id },
          data: { imageUrl: secureUrl },
        });
      } else {
        await this.prisma.product.update({
          where: { id },
          data: { imageUrl: secureUrl },
        });
      }

      this.logger.log(`Successfully synced ${type} ${id} to Cloudinary.`);

      // Delete local file
      fs.promises.unlink(filePath).catch(err => this.logger.error('Failed to delete temp file:', err));
    } catch (error) {
      this.logger.error(`Failed to sync ${type} ${id} to Cloudinary: ${error.message}`);
    }
  }
}
