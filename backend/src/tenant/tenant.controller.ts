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
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'OWNER') {
      throw new UnauthorizedException('Not authorized');
    }
    const ownerId = user.role === 'OWNER' ? user.id : undefined;
    return this.tenantService.getAllRestaurants(ownerId);
  }

  @Post('restaurants/:id/admin')
  async createAdmin(@Param('id') restaurantId: string, @Body() body: any, @GetUser() user: any) {
    if (user.role !== 'OWNER') throw new UnauthorizedException('Only owners can create admins for their restaurants');
    return this.tenantService.createAdminForRestaurant(restaurantId, body, user.id);
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
