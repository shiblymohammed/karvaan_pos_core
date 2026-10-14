import { Controller, Post, Body, UnauthorizedException, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetUser } from './get-user.decorator';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: { username: string; password?: string; pin?: string }) {
    if (!body.username) {
      throw new UnauthorizedException('Username is required');
    }
    return this.authService.login(body.username, body.password, body.pin);
  }

  @Post('unlock')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  async unlock(@Body() body: { pin: string; userId: string }, @GetUser() user: any) {
    if (!body.pin || !body.userId) {
      throw new UnauthorizedException('PIN and User ID are required');
    }
    if (body.userId !== user.id) throw new UnauthorizedException('Cannot unlock another user');
    return this.authService.unlock(user.id, body.pin);
  }

  @Post('authorize-manager')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  authorizeManager(@Body() body: { pin: string }, @GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('Restaurant session is required');
    return this.authService.authorizeManager(user.restaurantId, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@GetUser() user: any) {
    // The JwtAuthGuard validates the token. We just return the user object
    // that the passport strategy decoded.
    return user;
  }
}
