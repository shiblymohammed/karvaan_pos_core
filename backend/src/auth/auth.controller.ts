import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

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
}
