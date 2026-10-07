import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { PrinterService, PrintJobData } from './printer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('test')
  async testConnection(@Body() data: { ip: string; port?: string }) {
    const portNum = data.port ? parseInt(data.port, 10) : 9100;
    const success = await this.printerService.testConnection(data.ip, portNum);
    return { success };
  }

  @Get('scan')
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
