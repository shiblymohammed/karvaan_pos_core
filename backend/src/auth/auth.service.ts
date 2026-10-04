import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

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

    // In a real app, you should use bcrypt to hash and compare passwords.
    // Since this is migrating from plaintext/basic PINs, we do simple checks for now.
    // To upgrade to bcrypt: await bcrypt.compare(password, user.password)

    if (password && user.password !== password) {
       throw new UnauthorizedException('Invalid credentials');
    }

    if (pin && user.pin !== pin) {
       throw new UnauthorizedException('Invalid credentials');
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
}
