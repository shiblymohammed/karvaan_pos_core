import { Controller, Get, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /**
   * GET /history/bills?startDate=2026-07-01&endDate=2026-07-27&page=1&limit=50
   * Paginated billing history with optional date range, orderType, paymentMethod filters.
   * Defaults to TODAY's bills only for fast initial load.
   */
  @Get('bills')
  async getBillHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderType') orderType?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.historyService.getBillHistory({
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      orderType,
      paymentMethod,
    });
  }

  /**
   * GET /history/daily-summary?date=2026-07-27
   * Full day-close revenue summary. Used for end-of-day reconciliation reports.
   */
  @Get('daily-summary')
  async getDailySummary(@Query('date') date?: string) {
    return this.historyService.getDailySummary(date);
  }

  /**
   * GET /history/top-items?startDate=2026-07-01&endDate=2026-07-27&limit=10
   * Top-selling menu items report by quantity sold in a date range.
   */
  @Get('top-items')
  async getTopItems(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.historyService.getTopSellingItems(startDate, endDate, limit ? parseInt(limit) : 10);
  }

  /**
   * GET /history/deliveries?startDate=2026-07-01&riderId=xxx&status=DELIVERED
   * Paginated delivery order history for reporting and rider reconciliation.
   */
  @Get('deliveries')
  async getDeliveryHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('riderId') riderId?: string,
    @Query('status') status?: string,
  ) {
    return this.historyService.getDeliveryHistory({
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      riderId,
      status,
    });
  }

  /**
   * GET /history/waste?startDate=2026-07-01&endDate=2026-07-27
   * Waste & spoilage log entries in date range.
   */
  @Get('waste')
  async getWasteLogs(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.historyService.getWasteLogs(startDate, endDate);
  }

  /**
   * GET /history/returns?startDate=2026-07-01&endDate=2026-07-27
   * Return and refund records in date range.
   */
  @Get('returns')
  async getReturnRecords(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.historyService.getReturnRecords(startDate, endDate);
  }
}
