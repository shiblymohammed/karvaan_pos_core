import { Controller, Get, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('bills')
  async getBillHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderType') orderType?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @GetUser() user?: any,
  ) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getBillHistory({
      restaurantId: user.restaurantId,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      orderType,
      paymentMethod,
    });
  }

  @Get('daily-summary')
  async getDailySummary(@Query('date') date?: string, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getDailySummary(user.restaurantId, date);
  }

  @Get('top-items')
  async getTopItems(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @GetUser() user?: any,
  ) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getTopSellingItems(user.restaurantId, startDate, endDate, limit ? parseInt(limit) : 10);
  }

  @Get('deliveries')
  async getDeliveryHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('riderId') riderId?: string,
    @Query('status') status?: string,
    @GetUser() user?: any,
  ) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getDeliveryHistory({
      restaurantId: user.restaurantId,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      riderId,
      status,
    });
  }

  @Get('waste')
  async getWasteLogs(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getWasteLogs(user.restaurantId, startDate, endDate);
  }

  @Get('returns')
  async getReturnRecords(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @GetUser() user?: any) {
    if (!user.restaurantId) throw new UnauthorizedException('No restaurant context');
    return this.historyService.getReturnRecords(user.restaurantId, startDate, endDate);
  }
}
