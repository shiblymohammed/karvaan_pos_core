import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password?: string, pin?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (password) {
      let isPasswordValid = false;
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
      }
    };
  }

  async unlock(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
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
}
