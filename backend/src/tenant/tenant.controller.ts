import { Controller, Get, Post, Put, Body, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('owners')
  async getOwners(@GetUser() user: any) {
    if (user.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Super Admin only');
    return this.tenantService.getAllOwners();
  }

  @Post('owners')
  async createOwner(@Body() body: any, @GetUser() user: any) {
    if (user.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Super Admin only');
    return this.tenantService.createOwner(body);
  }

  @Get('restaurants')
  async getRestaurants(@GetUser() user: any) {
    // Both SUPER_ADMIN and OWNER can view restaurants (owners see all for now, we can scope later)
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER') {
      throw new UnauthorizedException('Not authorized');
    }
    // In a real app, if role===OWNER, we would pass ownerId to the service. For now SUPER_ADMIN sees all.
    return this.tenantService.getAllRestaurants();
  }

  @Post('restaurants')
  async createRestaurant(@Body() body: any, @GetUser() user: any) {
    if (user.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Super Admin only');
    return this.tenantService.createRestaurant(body);
  }

  @Put('restaurants/:id/subscription')
  async updateSubscription(@Param('id') id: string, @Body() body: any, @GetUser() user: any) {
    if (user.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Super Admin only');
    return this.tenantService.updateSubscription(id, body);
  }
}
