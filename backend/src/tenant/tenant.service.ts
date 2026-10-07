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

  async getAllRestaurants(ownerId?: string) {
    const whereClause = ownerId ? { ownerId } : {};
    return this.prisma.restaurant.findMany({
      where: whereClause,
      include: { owner: { select: { name: true } } },
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
