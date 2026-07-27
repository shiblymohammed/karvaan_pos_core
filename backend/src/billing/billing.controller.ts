import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('order')
  async createOrder(@Body() dto: any) {
    return this.billingService.createOrder(dto);
  }

  @Get('preview/:orderId')
  async getBillPreview(@Param('orderId') orderId: string, @Query('discount') discount?: number) {
    return this.billingService.calculateBillPreview(orderId, discount ? Number(discount) : 0);
  }

  @Post('settle')
  async settleBill(@Body() dto: { orderId: string; paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT'; discount?: number }) {
    return this.billingService.settleBill(dto);
  }

  @Get('dashboard')
  async getDashboardSummary() {
    return this.billingService.getDailyDashboardSummary();
  }
}
