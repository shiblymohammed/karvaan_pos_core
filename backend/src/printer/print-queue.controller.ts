import { Body, Controller, Get, Headers, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ADMIN_ROLES, Roles, RolesGuard } from '../auth/roles.guard';
import { PrintQueueService } from './print-queue.service';

const summary = (job: any) => ({ id: job.id, kind: job.kind, reference: job.reference, state: job.state });

@Controller('printer/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintQueueController {
  constructor(private readonly queue: PrintQueueService) {}
  @Get() overview(@Req() req: any) { return this.queue.overview(req.user); }
  @Post('pairing') @Roles(...ADMIN_ROLES)
  pairing(@Req() req: any, @Body() body: any) { return this.queue.createPairing(req.user, body?.name); }
  @Post('agents/:id/revoke') @Roles(...ADMIN_ROLES)
  revoke(@Req() req: any, @Param('id') id: string) { return this.queue.revoke(req.user, id); }
  @Put('destination') @Roles(...ADMIN_ROLES)
  destination(@Req() req: any, @Body() body: any) { return this.queue.saveDestination(req.user, body); }
  @Post('test') @Roles(...ADMIN_ROLES)
  async test(@Req() req: any, @Body() body: any) { return summary(await this.queue.test(req.user, body)); }
  @Post('receipt')
  async receipt(@Req() req: any, @Body() body: any) { return summary(await this.queue.manualReceipt(req.user, body)); }
  @Post('jobs/:id/recover')
  async recover(@Req() req: any, @Param('id') id: string, @Body() body: any) { return summary(await this.queue.recover(req.user, id, body)); }
  @Post('jobs/:id/cancel') @Roles(...ADMIN_ROLES)
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.queue.cancel(req.user, id, body); }
  @Post('jobs/:id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.queue.review(req.user, id, body); }
}

// Agent routes never accept cashier JWTs; their credential is scoped to one paired restaurant/computer.
@Controller('printer/agent')
export class PrintAgentController {
  constructor(private readonly queue: PrintQueueService) {}
  @Post('pair') @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 5, ttl: 60000 } })
  pair(@Body() body: any) { return this.queue.pair(body?.code); }
  @Post('claim')
  async claim(@Headers('authorization') header: string) { return this.queue.claim(await this.queue.authenticate(header)); }
  @Post('jobs/:id/start')
  async start(@Headers('authorization') header: string, @Param('id') id: string, @Body() body: any) { return this.queue.start(await this.queue.authenticate(header), id, body?.claimToken); }
  @Post('jobs/:id/result')
  async result(@Headers('authorization') header: string, @Param('id') id: string, @Body() body: any) { return this.queue.report(await this.queue.authenticate(header), id, body); }
}
