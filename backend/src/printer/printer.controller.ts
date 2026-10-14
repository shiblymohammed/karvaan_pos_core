import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { PrinterService, PrintJobData } from './printer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ADMIN_ROLES, Roles, RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('test')
  @Roles(...ADMIN_ROLES)
  async testConnection(@Body() data: { ip: string; port?: string }) {
    const portNum = data.port ? parseInt(data.port, 10) : 9100;
    const success = await this.printerService.testConnection(data.ip, portNum);
    return { success };
  }

  @Get('scan')
  @Roles(...ADMIN_ROLES)
  async scanNetwork() {
    const printers = await this.printerService.scanNetwork();
    return { printers };
  }

  @Post('print')
  async printJob(@Body() jobData: PrintJobData) {
    if (!jobData.port) jobData.port = 9100;
    const success = await this.printerService.printJob(jobData);
    return { success };
  }
}
