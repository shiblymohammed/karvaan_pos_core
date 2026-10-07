import { Controller, Post, Body, UnauthorizedException, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GetUser } from './get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password?: string; pin?: string }) {
    if (!body.username) {
      throw new UnauthorizedException('Username is required');
    }
    return this.authService.login(body.username, body.password, body.pin);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@GetUser() user: any) {
    // The JwtAuthGuard validates the token. We just return the user object
    // that the passport strategy decoded.
    return user;
  }
}
