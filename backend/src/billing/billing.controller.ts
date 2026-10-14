import { Controller, Post, Body, Get, Param, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { ADMIN_ROLES, Roles, RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService, private readonly workflows: WorkflowService) {}

  @Get('ledger')
  @Roles(...ADMIN_ROLES, 'CASHIER')
  getLedger(@GetUser() user: any) { return this.workflows.ledger(user.restaurantId); }

  @Get('rider-remittance/:riderId')
  @Roles(...ADMIN_ROLES, 'CASHIER', 'DELIVERY')
  getRiderRemittance(@Param('riderId') riderId: string, @GetUser() user: any) { return this.workflows.riderRemittanceSummary(riderId, user); }

  @Get('menu')
  getMenu(@GetUser() user: any) { return this.workflows.menu(user.restaurantId); }

  @Get('inventory')
  @Roles(...ADMIN_ROLES, 'CASHIER', 'KITCHEN')
  getInventory(@GetUser() user: any) { return this.workflows.inventoryState(user.restaurantId); }

  @Get('invoice/:billNumber')
  @Roles(...ADMIN_ROLES, 'CASHIER')
  getInvoice(@Param('billNumber') billNumber: string, @GetUser() user: any) { return this.workflows.invoice(billNumber, user.restaurantId); }

  @Get('active-order/:orderNumber')
  @Roles(...ADMIN_ROLES, 'CASHIER', 'WAITER')
  getActiveOrder(@Param('orderNumber') orderNumber: string, @Query('tableId') tableId: string, @GetUser() user: any) { return this.workflows.activeOrder(orderNumber, user.restaurantId, tableId); }

  @Post('order')
  @Roles(...ADMIN_ROLES, 'CASHIER', 'WAITER')
  async createOrder(@Body() dto: any, @GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.createOrder({ ...dto, restaurantId: user.restaurantId, waiterId: user.id });
  }

  @Get('preview/:orderId')
  async getBillPreview(@Param('orderId') orderId: string, @Query('discount') discount?: number, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.calculateBillPreview(orderId, user.restaurantId, discount ? Number(discount) : 0);
  }

  @Post('settle')
  @Roles(...ADMIN_ROLES, 'CASHIER')
  async settleBill(@Body() dto: { orderId: string; paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT'; discount?: number }, @GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.settleBill(dto, user.restaurantId, user.id); // Passing cashierId
  }

  @Get('dashboard')
  @Roles(...ADMIN_ROLES)
  async getDashboardSummary(@GetUser() user: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.getDailyDashboardSummary(user.restaurantId);
  }

  @Get('history')
  @Roles(...ADMIN_ROLES, 'CASHIER')
  async getOrderHistory(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.billingService.getOrderHistory(user.restaurantId, startDate, endDate);
  }
}
