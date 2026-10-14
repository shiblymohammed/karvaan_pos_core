import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module'; // Assume prisma module exists
import { getJwtSecret, SessionService } from './session.service';
import { RolesGuard } from './roles.guard';
import { ThrottlerModule } from '@nestjs/throttler';

@Global()
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    JwtModule.registerAsync({
      useFactory: () => ({ secret: getJwtSecret(), signOptions: { expiresIn: '7d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SessionService, RolesGuard],
  exports: [JwtStrategy, PassportModule, JwtModule, AuthService, SessionService, RolesGuard, ThrottlerModule],
})
export class AuthModule {}
