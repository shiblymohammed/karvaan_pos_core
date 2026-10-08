import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getAllOwners() {
    return this.prisma.user.findMany({
      where: { role: 'OWNER' },
      select: { id: true, name: true, username: true, createdAt: true, isActive: true },
    });
  }

  async createOwner(data: { name: string; username: string; password?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(data.password || 'password123', 10);

    return this.prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: hashedPassword,
        role: 'OWNER',
      },
      select: { id: true, name: true, username: true },
    });
  }

  async updateOwner(id: string, data: { name?: string; username?: string; password?: string; isActive?: boolean }) {
    const owner = await this.prisma.user.findUnique({ where: { id, role: 'OWNER' } });
    if (!owner) throw new NotFoundException('Owner not found');

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    if (data.username && data.username !== owner.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
      if (existing) throw new ConflictException('Username already taken');
      updateData.username = data.username;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, username: true, isActive: true },
    });
  }

  async getAllRestaurants(ownerId?: string) {
    const whereClause = ownerId ? { ownerId } : {};
    return this.prisma.restaurant.findMany({
      where: whereClause,
      include: { 
        owner: { select: { name: true } },
        users: { where: { role: 'ADMIN' }, select: { id: true, name: true, username: true } }
      },
    });
  }

  async createAdminForRestaurant(restaurantId: string, data: { name: string; username: string; password?: string }, ownerId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant || restaurant.ownerId !== ownerId) throw new UnauthorizedException('Not your restaurant');

    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(data.password || 'password123', 10);

    return this.prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: hashedPassword,
        role: 'ADMIN',
        restaurantId: restaurantId,
      },
      select: { id: true, name: true, username: true, role: true }
    });
  }

  async updateAdminForRestaurant(adminId: string, data: { name?: string; password?: string }, ownerId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, include: { restaurant: true } });
    if (!admin || admin.restaurant?.ownerId !== ownerId || admin.role !== 'ADMIN') {
      throw new UnauthorizedException('Not authorized to edit this admin');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id: adminId },
      data: updateData,
      select: { id: true, name: true, username: true }
    });
  }

  async deleteAdminForRestaurant(adminId: string, ownerId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, include: { restaurant: true } });
    if (!admin || admin.restaurant?.ownerId !== ownerId || admin.role !== 'ADMIN') {
      throw new UnauthorizedException('Not authorized to delete this admin');
    }

    return this.prisma.user.delete({ where: { id: adminId } });
  }

  async createRestaurant(data: { name: string; address?: string; phone?: string; ownerId: string }) {
    const owner = await this.prisma.user.findUnique({ where: { id: data.ownerId } });
    if (!owner || owner.role !== 'OWNER') {
      throw new NotFoundException('Valid Owner not found');
    }

    return this.prisma.restaurant.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        ownerId: data.ownerId,
      },
    });
  }

  async updateSubscription(restaurantId: string, data: {
    subscriptionPlan: string;
    subscriptionPrice: number;
    subscriptionExpiry: Date | null;
    subscriptionStatus: string;
  }) {
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        subscriptionPlan: data.subscriptionPlan,
        subscriptionPrice: data.subscriptionPrice,
        subscriptionExpiry: data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null,
        subscriptionStatus: data.subscriptionStatus,
      },
    });
  }
}
