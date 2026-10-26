import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { PrinterController } from './printer.controller';
import { PrintQueueService } from './print-queue.service';
import { PrintAgentController, PrintQueueController } from './print-queue.controller';

@Module({
  providers: [PrinterService, PrintQueueService],
  controllers: [PrinterController, PrintQueueController, PrintAgentController],
  exports: [PrinterService, PrintQueueService],
})
export class PrinterModule {}
