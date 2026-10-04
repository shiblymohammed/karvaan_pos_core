import { Controller, Post, Body, Get, Param, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('order')
  async createOrder(@Body() dto: any, @GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.createOrder({ ...dto, restaurantId: user.restaurantId });
  }

  @Get('preview/:orderId')
  async getBillPreview(@Param('orderId') orderId: string, @Query('discount') discount?: number, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.calculateBillPreview(orderId, user.restaurantId, discount ? Number(discount) : 0);
  }

  @Post('settle')
  async settleBill(@Body() dto: { orderId: string; paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT'; discount?: number }, @GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.settleBill(dto, user.restaurantId, user.id); // Passing cashierId
  }

  @Get('dashboard')
  async getDashboardSummary(@GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.getDailyDashboardSummary(user.restaurantId);
  }
}
