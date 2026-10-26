import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password?: string, pin?: string) {
    if (typeof username !== 'string' || !username.trim() ||
        (!password && !pin) || (password !== undefined && typeof password !== 'string') ||
        (pin !== undefined && typeof pin !== 'string')) {
      throw new UnauthorizedException('Username and password or PIN are required');
    }
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { restaurant: true },
    });

    if (!user?.isActive || (user.restaurantId && !user.restaurant?.isActive)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (password) {
      let isPasswordValid = false;
      if (!user.password) throw new UnauthorizedException('Invalid credentials');
      if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        // Transparent migration for existing plaintext passwords
        isPasswordValid = (password === user.password);
        if (isPasswordValid) {
          const newHash = await bcrypt.hash(password, 10);
          await this.prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
        }
      }
      if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');
    }

    if (pin) {
      let isPinValid = false;
      if (user.pin && (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$'))) {
        isPinValid = await bcrypt.compare(pin, user.pin);
      } else {
        // Transparent migration for existing plaintext PINs
        isPinValid = (pin === user.pin);
        if (isPinValid) {
          const newHash = await bcrypt.hash(pin, 10);
          await this.prisma.user.update({ where: { id: user.id }, data: { pin: newHash } });
        }
      }
      if (!isPinValid) throw new UnauthorizedException('Invalid credentials');
    }

    // Create JWT Payload
    const payload = { 
      sub: user.id, 
      role: user.role, 
      restaurantId: user.restaurantId 
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurantId,
        permissions: (() => { try { return JSON.parse(user.permissions || '{}'); } catch { return {}; } })(),
      }
    };
  }

  async unlock(userId: string, pin: string) {
    if (typeof userId !== 'string' || typeof pin !== 'string' || !pin) throw new UnauthorizedException('Invalid credentials');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.pin) {
       throw new UnauthorizedException('No PIN set for this user');
    }

    let isPinValid = false;
    if (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$')) {
      isPinValid = await bcrypt.compare(pin, user.pin);
    } else {
      // Transparent migration for existing plaintext PINs
      isPinValid = (pin === user.pin);
      if (isPinValid) {
        const newHash = await bcrypt.hash(pin, 10);
        await this.prisma.user.update({ where: { id: user.id }, data: { pin: newHash } });
      }
    }

    if (!isPinValid) throw new UnauthorizedException('Invalid PIN');
    
    return { success: true };
  }

  async authorizeRefund(user: any, body: any) {
    if (!body?.actionId || !body.billNumber || !user.restaurantId) throw new UnauthorizedException('Refund context is required');
    const manager = await this.authorizeManager(user.restaurantId, body.pin);
    return { authorization: this.jwtService.sign({ purpose: 'refund', restaurantId: user.restaurantId, cashierId: user.id, managerId: manager.id, actionId: body.actionId, billNumber: body.billNumber }, { expiresIn: '15m' }) };
  }

  createStockChallenge(context: any) {
    return this.jwtService.sign({ ...context, purpose: 'stock-challenge' }, { expiresIn: '15m' });
  }

  async authorizeStockShortage(user: any, body: any) {
    let challenge: any;
    try { challenge = this.jwtService.verify(body?.challenge); } catch { throw new UnauthorizedException('Stock approval request expired. Retry the original action to refresh it.'); }
    if (challenge.purpose !== 'stock-challenge' || challenge.restaurantId !== user.restaurantId || challenge.cashierId !== user.id) throw new UnauthorizedException('Invalid stock approval request');
    if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.trim().length > 500) throw new UnauthorizedException('Enter a reason for allowing the stock shortage (5–500 characters).');
    const manager = await this.authorizeManager(user.restaurantId, body.pin);
    const account = await this.prisma.user.findUnique({ where: { id: manager.id } });
    if (!account || !['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(account.role)) throw new UnauthorizedException('Stock shortages require an active manager or administrator.');
    const { iat, exp, ...context } = challenge;
    return { authorization: this.jwtService.sign({ ...context, purpose: 'stock-override', managerId: manager.id, reason: body.reason.trim() }, { expiresIn: '15m' }) };
  }

  async verifyStockAuthorization(tx: any, token: string, context: any) {
    let grant: any;
    try { grant = this.jwtService.verify(token); } catch { return null; }
    if (grant.purpose !== 'stock-override' || ['restaurantId', 'cashierId', 'operation', 'reference', 'fingerprint'].some(key => grant[key] !== context[key])) return null;
    if (context.shortages.some((row: any) => !grant.shortages?.some((approved: any) => approved.id === row.id && approved.shortfall + 0.000001 >= row.shortfall))) return null;
    const manager = await tx.user.findFirst({ where: { id: grant.managerId, restaurantId: context.restaurantId, isActive: true, role: { in: ['ADMIN', 'REST_ADMIN', 'MANAGER'] } } });
    return manager ? { managerId: manager.id, managerName: manager.name, reason: grant.reason } : null;
  }

  async verifyRefundAuthorization(token: string, user: any, actionId: string, billNumber: string) {
    let grant: any;
    try { grant = this.jwtService.verify(token); } catch { throw new UnauthorizedException('Manager authorization expired. Authorize this refund again.'); }
    if (grant.purpose !== 'refund' || grant.restaurantId !== user.restaurantId || grant.cashierId !== user.id || grant.actionId !== actionId || grant.billNumber !== billNumber) throw new UnauthorizedException('Invalid refund authorization');
    const manager = await this.prisma.user.findFirst({ where: { id: grant.managerId, restaurantId: user.restaurantId, isActive: true } });
    let permissions: any = {};
    try { permissions = JSON.parse(manager?.permissions || '{}'); } catch {}
    if (!manager || (!['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(manager.role) && !permissions.canVoid)) throw new UnauthorizedException('Manager authorization is no longer active');
    return manager.id;
  }

  async authorizeManager(restaurantId: string, pin: string) {
    if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) throw new UnauthorizedException('Invalid authorization PIN');
    const staff = await this.prisma.user.findMany({ where: { restaurantId, isActive: true } });
    for (const user of staff) {
      let permissions: any = {};
      try { permissions = JSON.parse(user.permissions || '{}'); } catch {}
      if (!['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(user.role) && !permissions.canVoid) continue;
      if (!user.pin) continue;
      const valid = user.pin.startsWith('$2') ? await bcrypt.compare(pin, user.pin) : pin === user.pin;
      if (valid) {
        if (!user.pin.startsWith('$2')) await this.prisma.user.update({ where: { id: user.id }, data: { pin: await bcrypt.hash(pin, 10) } });
        return { name: user.name, id: user.id };
      }
    }
    throw new UnauthorizedException('Unauthorized PIN or insufficient permissions');
  }
}
