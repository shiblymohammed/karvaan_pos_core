import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || ['CHANGE_ME', 'karvaan-super-secret-key-2026'].includes(secret)) {
    throw new Error('Configure a private JWT_SECRET before starting the backend');
  }
  return secret;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(payload: any) {
    if (!payload?.sub) throw new UnauthorizedException('Invalid session');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { restaurant: true } });
    if (!user?.isActive || user.restaurantId !== payload.restaurantId || (user.restaurantId && !user.restaurant?.isActive)) {
      throw new UnauthorizedException('Session is no longer active');
    }
    let permissions = {};
    try { permissions = JSON.parse(user.permissions || '{}'); } catch {}
    return { id: user.id, name: user.name, role: user.role, restaurantId: user.restaurantId, permissions };
  }
}
