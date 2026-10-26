import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { Bill, Order, Prisma } from '@prisma/client';
import { PrintDocument, renderPrintDocument } from './print-document';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const roles = ['RECEIPT', 'KITCHEN'];
const staff = ['ADMIN', 'REST_ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'];
const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validPrinterAddress(transport: string, address: string): boolean {
  if (!text(address, 200) || /[\x00-\x1f]/.test(address)) return false;
  if (transport === 'WINDOWS') return !address.startsWith('\\\\'); // named local spooler queue, not a remote UNC path
  return transport === 'TCP' && isIP(address) === 4 && (address.startsWith('10.') || address.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(address));
}

@Injectable()
export class PrintQueueService {
  constructor(private readonly prisma: PrismaService) {}

  private assertStaff(user: any) {
    if (!user?.restaurantId || !staff.includes(user.role)) throw new UnauthorizedException('Printing permission is required');
  }
  async createPairing(user: any, name: unknown) {
    if (!text(name, 80)) throw new BadRequestException('Enter a name for the printing computer');
    const code = randomBytes(12).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60000);
    const agent = await this.prisma.printAgent.create({ data: { restaurantId: user.restaurantId, name: name.trim(), pairingHash: digest(code), pairingExpiresAt: expiresAt } });
    return { id: agent.id, code, expiresAt };
  }
  async pair(code: unknown) {
    if (typeof code !== 'string' || !/^[A-Fa-f0-9]{24}$/.test(code)) throw new UnauthorizedException('Invalid or expired pairing code');
    const secret = randomBytes(32).toString('base64url');
    return this.prisma.$transaction(async tx => {
      const agent = await tx.printAgent.findUnique({ where: { pairingHash: digest(code.toUpperCase()) }, include: { restaurant: true } });
      if (!agent || agent.revokedAt || !agent.restaurant.isActive || !agent.pairingExpiresAt || agent.pairingExpiresAt < new Date()) throw new UnauthorizedException('Invalid or expired pairing code');
      const changed = await tx.printAgent.updateMany({ where: { id: agent.id, pairingHash: agent.pairingHash, tokenHash: null }, data: { pairingHash: null, pairingExpiresAt: null, tokenHash: digest(secret), lastSeenAt: new Date() } });
      if (!changed.count) throw new ConflictException('Pairing code was already used');
      return { agentId: agent.id, name: agent.name, restaurantId: agent.restaurantId, token: `${agent.id}.${secret}` };
    });
  }
  async authenticate(header: unknown) {
    const token = typeof header === 'string' ? header.replace(/^Bearer /, '') : '';
    const [id, secret, extra] = token.split('.');
    if (!id || !secret || extra || token.length > 200) throw new UnauthorizedException('Invalid printing service credential');
    const agent = await this.prisma.printAgent.findUnique({ where: { id }, include: { restaurant: true } });
    const actual = digest(secret);
    if (!agent?.tokenHash || agent.revokedAt || !agent.restaurant.isActive || !timingSafeEqual(Buffer.from(agent.tokenHash), Buffer.from(actual))) throw new UnauthorizedException('Printing service is unpaired or revoked');
    return agent;
  }
  private async expire(tx: Prisma.TransactionClient, restaurantId: string) {
    const now = new Date();
    await tx.printJob.updateMany({ where: { restaurantId, state: 'CLAIMED', leaseUntil: { lt: now } }, data: { state: 'QUEUED', claimToken: null, leaseUntil: null } });
    await tx.printJob.updateMany({ where: { restaurantId, state: 'SENDING', leaseUntil: { lt: now } }, data: { state: 'UNCERTAIN', error: 'Printing service stopped responding after delivery began. Check the paper before reprinting.' } });
  }
  async overview(user: any) {
    this.assertStaff(user);
    return this.prisma.$transaction(async tx => {
      await this.expire(tx, user.restaurantId);
      const admin = ['ADMIN', 'REST_ADMIN', 'MANAGER'].includes(user.role);
      const agents = await tx.printAgent.findMany({ where: { restaurantId: user.restaurantId }, select: { id: true, name: true, lastSeenAt: true, revokedAt: true, pairingExpiresAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
      const destinations = await tx.printDestination.findMany({ where: { restaurantId: user.restaurantId } });
      const select = { id: true, kind: true, reference: true, state: true, error: true, parentId: true, createdAt: true, updatedAt: true, requestedBy: true, reviewedAt: true };
      const recent = await tx.printJob.findMany({ where: { restaurantId: user.restaurantId }, select, orderBy: { createdAt: 'desc' }, take: 100 });
      const unresolved = await tx.printJob.findMany({ where: { restaurantId: user.restaurantId, state: { in: ['QUEUED', 'CLAIMED', 'SENDING', 'FAILED', 'UNCERTAIN'] }, reviewedAt: null }, select, orderBy: { createdAt: 'asc' }, take: 100 });
      const jobs = [...new Map([...unresolved, ...recent].map(job => [job.id, job])).values()];
      return { agents: admin ? agents : [], destinations: admin ? destinations : destinations.map(d => ({ id: d.id, role: d.role, autoPrint: d.autoPrint, name: d.name })), jobs };
    });
  }
  async revoke(user: any, id: string) {
    return this.prisma.$transaction(async tx => {
      const changed = await tx.printAgent.updateMany({ where: { id, restaurantId: user.restaurantId }, data: { revokedAt: new Date(), tokenHash: null, pairingHash: null } });
      if (!changed.count) throw new NotFoundException('Printing computer not found');
      await tx.printJob.updateMany({ where: { agentId: id, restaurantId: user.restaurantId, state: { in: ['QUEUED', 'CLAIMED'] } }, data: { state: 'CANCELLED', error: 'Printing computer revoked' } });
      await tx.printJob.updateMany({ where: { agentId: id, restaurantId: user.restaurantId, state: 'SENDING' }, data: { state: 'UNCERTAIN', error: 'Printing computer revoked during delivery. Check the paper.' } });
      await tx.printDestination.updateMany({ where: { agentId: id, restaurantId: user.restaurantId }, data: { autoPrint: false, revision: { increment: 1 } } });
      return { success: true };
    });
  }
  async saveDestination(user: any, body: any) {
    if (!body || !roles.includes(body.role) || !text(body.name, 80) || !text(body.agentId) || !validPrinterAddress(body.transport, body.address) || ![58, 80].includes(body.paperWidth) || !Number.isInteger(body.port) || body.port < 1 || body.port > 65535 || typeof body.autoPrint !== 'boolean' || !Number.isInteger(body.revision) || body.revision < 0) throw new BadRequestException('Choose a paired computer, printer, valid local address and paper width');
    return this.prisma.$transaction(async tx => {
      const agent = await tx.printAgent.findFirst({ where: { id: body.agentId, restaurantId: user.restaurantId, revokedAt: null, tokenHash: { not: null } } });
      if (!agent) throw new BadRequestException('Pair this computer before assigning printers');
      const key = { restaurantId_role: { restaurantId: user.restaurantId, role: body.role } };
      const previous = await tx.printDestination.findUnique({ where: key });
      if ((previous?.revision ?? 0) !== body.revision) throw new ConflictException('Printer settings changed on another device. Refresh before saving.');
      const data = { agentId: body.agentId, name: body.name.trim(), transport: body.transport, address: body.address.trim(), port: body.port, paperWidth: body.paperWidth, autoPrint: body.autoPrint, revision: body.revision + 1 };
      return tx.printDestination.upsert({ where: key, create: { ...data, restaurantId: user.restaurantId, role: body.role }, update: data });
    });
  }
  async enqueue(tx: Prisma.TransactionClient, restaurantId: string, role: string, dedupeKey: string, document: PrintDocument, requestedBy: string, automatic = true, parentId?: string) {
    const existing = await tx.printJob.findUnique({ where: { restaurantId_dedupeKey: { restaurantId, dedupeKey } } });
    if (existing) {
      if (existing.reference !== document.reference || existing.kind !== document.kind) throw new ConflictException('This print request ID was already used for another document');
      return existing;
    }
    const destination = await tx.printDestination.findUnique({ where: { restaurantId_role: { restaurantId, role } } });
    if (!destination || (automatic && !destination.autoPrint)) {
      if (automatic) return null;
      throw new BadRequestException('Configure a local printing service and destination first, or use browser printing');
    }
    const agent = await tx.printAgent.findFirst({ where: { id: destination.agentId, restaurantId, revokedAt: null, tokenHash: { not: null } } });
    if (!agent) { if (automatic) return null; throw new BadRequestException('Pair an active printing computer first'); }
    return tx.printJob.create({ data: { restaurantId, agentId: agent.id, dedupeKey, kind: document.kind, reference: document.reference, document: JSON.stringify(document), destination: JSON.stringify(destination), requestedBy, parentId } });
  }
  async branding(tx: Prisma.TransactionClient, restaurantId: string) {
    const [restaurant, settings] = await Promise.all([tx.restaurant.findUnique({ where: { id: restaurantId } }), tx.systemSetting.findUnique({ where: { restaurantId_settingKey: { restaurantId, settingKey: 'general' } } })]);
    let config: any = {}; try { config = JSON.parse(settings?.data || '{}'); } catch {}
    return { restaurantName: config.receiptName || restaurant?.name || 'Karvaan POS', address: config.receiptAddress || restaurant?.address || '', gstin: config.receiptGstin || '' };
  }
  async kitchen(tx: Prisma.TransactionClient, restaurantId: string, key: string, document: Omit<PrintDocument, 'kind' | 'createdAt'>, requestedBy: string) {
    if (!document.items.length) return;
    return this.enqueue(tx, restaurantId, 'KITCHEN', `kitchen:${key}`, { ...await this.branding(tx, restaurantId), ...document, kind: 'KOT', createdAt: new Date().toISOString() }, requestedBy);
  }
  async receipt(tx: Prisma.TransactionClient, restaurantId: string, bill: Bill, order: Pick<Order, 'orderNumber'> & { table?: { tableNumber: string } | null }, cashier: string, automatic = true, key = `receipt:${bill.id}`, reprint = false, requestedBy = cashier) {
    let items: any[] = []; try { items = JSON.parse(bill.invoiceItems); } catch {}
    if (!items.length) throw new BadRequestException('This older bill has no immutable invoice snapshot to print safely');
    return this.enqueue(tx, restaurantId, 'RECEIPT', key, {
      ...await this.branding(tx, restaurantId), kind: 'RECEIPT', reference: bill.billNumber,
      orderNumber: order.orderNumber, orderType: bill.orderType, table: order.table?.tableNumber,
      cashier, customer: bill.customerName, createdAt: bill.settledAt.toISOString(), items,
      subtotal: bill.subtotal, discount: bill.discount, cgst: bill.cgst, sgst: bill.sgst,
      deliveryFee: bill.deliveryFee, grandTotal: bill.grandTotal, paymentMethod: bill.paymentMethod,
      tenders: JSON.parse(bill.tenders || '{}'), reprint,
    }, requestedBy, automatic);
  }
  async manualReceipt(user: any, body: any) {
    this.assertStaff(user);
    if (!text(body?.billNumber) || !text(body?.requestId)) throw new BadRequestException('Bill number and stable request ID are required');
    if (['WAITER', 'KITCHEN'].includes(user.role)) throw new UnauthorizedException('Cashier permission is required for receipt copies');
    if (body.reprint !== undefined && typeof body.reprint !== 'boolean') throw new BadRequestException('Invalid reprint request');
    if (body.reprint && (body.confirmed !== true || !text(body.reason, 500))) throw new BadRequestException('Check the paper and give a reason before requesting another copy');
    return this.prisma.$transaction(async tx => {
      const retry = await tx.printJob.findUnique({ where: { restaurantId_dedupeKey: { restaurantId: user.restaurantId, dedupeKey: `manual:${body.requestId}` } } });
      if (retry) {
        if (retry.reference !== body.billNumber || retry.kind !== 'RECEIPT') throw new ConflictException('This print request ID belongs to another document');
        return retry;
      }
      const bill = await tx.bill.findUnique({ where: { restaurantId_billNumber: { restaurantId: user.restaurantId, billNumber: body.billNumber } }, include: { order: { include: { table: true } }, cashier: true } });
      if (!bill) {
        const dispatch = await tx.printJob.findFirst({ where: { restaurantId: user.restaurantId, kind: 'DISPATCH', reference: body.billNumber } });
        if (dispatch && !body.reprint) return dispatch;
        throw new NotFoundException('Saved bill not found. Wait for confirmation; dispatch notes can be recovered from Print jobs.');
      }
      const previous = await tx.printJob.findFirst({ where: { restaurantId: user.restaurantId, kind: 'RECEIPT', reference: bill.billNumber }, orderBy: { createdAt: 'asc' } });
      // A normal Print click cannot duplicate an automatic job; reprints need a deliberate new request.
      if (previous && !body.reprint) return previous;
      if (body.reprint && await tx.printJob.findFirst({ where: { restaurantId: user.restaurantId, kind: 'RECEIPT', reference: body.billNumber, state: { in: ['QUEUED', 'CLAIMED', 'SENDING'] } } })) throw new ConflictException('A receipt copy is already waiting or being sent. Review Print jobs before requesting another.');
      const result = previous && body.reprint
        ? await this.enqueue(tx, user.restaurantId, 'RECEIPT', `manual:${body.requestId}`, { ...JSON.parse(previous.document), reprint: true }, user.id, false, previous.id)
        : await this.receipt(tx, user.restaurantId, bill, bill.order, bill.cashier?.name || 'Staff', false, `manual:${body.requestId}`, !!previous || !!body.reprint, user.id);
      if (body.reprint) {
        await tx.printJob.update({ where: { id: result.id }, data: { resolution: body.reason.trim() } });
        if (previous) await tx.printJob.update({ where: { id: previous.id }, data: { reviewedAt: new Date(), reviewedBy: user.id } });
      }
      return result;
    });
  }
  async test(user: any, body: any) {
    if (!roles.includes(body?.role) || !text(body?.requestId)) throw new BadRequestException('Choose a printer and request ID');
    return this.prisma.$transaction(tx => this.enqueue(tx, user.restaurantId, body.role, `test:${body.requestId}`, { kind: 'TEST', reference: body.requestId, createdAt: new Date().toISOString(), items: [{ name: 'Connection and paper width test', quantity: 1 }] }, user.id, false));
  }
  async recover(user: any, id: string, body: any) {
    this.assertStaff(user);
    if (!text(body?.requestId) || !text(body?.reason, 500) || body.confirmed !== true) throw new BadRequestException('Check the paper and confirm the reason before recovery');
    return this.prisma.$transaction(async tx => {
      await this.expire(tx, user.restaurantId);
      const job = await tx.printJob.findFirst({ where: { id, restaurantId: user.restaurantId } });
      if (!job || !['FAILED', 'UNCERTAIN', 'SENT', 'CANCELLED'].includes(job.state)) throw new ConflictException('This job is still waiting or being sent. Refresh its status.');
      if (['WAITER', 'KITCHEN'].includes(user.role) && job.kind !== 'KOT') throw new UnauthorizedException('Cashier permission is required for receipt copies');
      const retry = await tx.printJob.findUnique({ where: { restaurantId_dedupeKey: { restaurantId: user.restaurantId, dedupeKey: `recovery:${id}:${body.requestId}` } } });
      if (retry) return retry;
      if (await tx.printJob.findFirst({ where: { restaurantId: user.restaurantId, parentId: id, state: { in: ['QUEUED', 'CLAIMED', 'SENDING'] } } })) throw new ConflictException('Another copy is already waiting or being sent. Review Print jobs.');
      const document = { ...JSON.parse(job.document), reprint: true };
      const destinationRole = JSON.parse(job.destination).role;
      const result = await this.enqueue(tx, user.restaurantId, destinationRole, `recovery:${id}:${body.requestId}`, document, user.id, false, id);
      await tx.printJob.update({ where: { id: result.id }, data: { resolution: body.reason.trim() } });
      await tx.printJob.update({ where: { id }, data: { reviewedAt: new Date(), reviewedBy: user.id } });
      return result;
    });
  }
  async cancel(user: any, id: string, body: any) {
    if (!text(body?.reason, 500)) throw new BadRequestException('A cancellation reason is required');
    const previous = await this.prisma.printJob.findFirst({ where: { id, restaurantId: user.restaurantId } });
    if (previous?.state === 'CANCELLED') return { success: true };
    const result = await this.prisma.printJob.updateMany({ where: { id, restaurantId: user.restaurantId, state: 'QUEUED' }, data: { state: 'CANCELLED', resolution: `${user.id}: ${body.reason.trim()}` } });
    if (!result.count) throw new ConflictException('Only a waiting job can be cancelled. Refresh its status.');
    return { success: true };
  }
  async review(user: any, id: string, body: any) {
    this.assertStaff(user);
    if (body?.confirmed !== true || !text(body.reason, 500)) throw new BadRequestException('Confirm the paper check and give a reason');
    return this.prisma.$transaction(async tx => {
      const job = await tx.printJob.findFirst({ where: { id, restaurantId: user.restaurantId } });
      if (!job || !['FAILED', 'UNCERTAIN', 'SENT', 'CANCELLED'].includes(job.state)) throw new ConflictException('Wait for this job to finish before reviewing it');
      if (['WAITER', 'KITCHEN'].includes(user.role) && job.kind !== 'KOT') throw new UnauthorizedException('Cashier permission is required to review receipts');
      if (!job.reviewedAt) await tx.printJob.update({ where: { id }, data: { reviewedAt: new Date(), reviewedBy: user.id, resolution: `Paper checked; no new copy: ${body.reason.trim()}` } });
      return { success: true };
    });
  }
  async claim(agent: any) {
    return this.prisma.$transaction(async tx => {
      if (!await tx.printAgent.findFirst({ where: { id: agent.id, restaurantId: agent.restaurantId, tokenHash: agent.tokenHash, revokedAt: null, restaurant: { isActive: true } } })) throw new UnauthorizedException('Printing service was revoked');
      await this.expire(tx, agent.restaurantId);
      await tx.printAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
      // One in-flight job per agent. A second process must not print concurrently.
      if (await tx.printJob.findFirst({ where: { agentId: agent.id, state: { in: ['CLAIMED', 'SENDING'] } } })) return { job: null };
      const job = await tx.printJob.findFirst({ where: { agentId: agent.id, restaurantId: agent.restaurantId, state: 'QUEUED' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (!job) return { job: null };
      const claimToken = randomUUID();
      const updated = await tx.printJob.updateMany({ where: { id: job.id, state: 'QUEUED' }, data: { state: 'CLAIMED', claimToken, leaseUntil: new Date(Date.now() + 60000) } });
      if (!updated.count) return { job: null };
      const destination = JSON.parse(job.destination);
      return { job: { id: job.id, claimToken, title: `${job.kind} ${job.reference}`, destination, data: renderPrintDocument(JSON.parse(job.document), destination.paperWidth).toString('base64') } };
    });
  }
  async start(agent: any, id: string, token: unknown) {
    return this.prisma.$transaction(async tx => {
      if (!await tx.printAgent.findFirst({ where: { id: agent.id, restaurantId: agent.restaurantId, tokenHash: agent.tokenHash, revokedAt: null, restaurant: { isActive: true } } })) throw new UnauthorizedException('Printing service was revoked');
      const job = await tx.printJob.findFirst({ where: { id, restaurantId: agent.restaurantId, agentId: agent.id, claimToken: String(token) } });
      if (job?.state === 'SENDING' && job.leaseUntil && job.leaseUntil > new Date()) return { success: true };
      const changed = await tx.printJob.updateMany({ where: { id, agentId: agent.id, restaurantId: agent.restaurantId, claimToken: String(token), state: 'CLAIMED', leaseUntil: { gt: new Date() } }, data: { state: 'SENDING', leaseUntil: new Date(Date.now() + 120000) } });
      if (!changed.count) throw new ConflictException('Print claim expired. Do not send this job.');
      return { success: true };
    });
  }
  async report(agent: any, id: string, body: any) {
    if (!['SENT', 'FAILED', 'UNCERTAIN'].includes(body?.state) || !text(body?.claimToken)) throw new BadRequestException('Invalid print result');
    return this.prisma.$transaction(async tx => {
      const job = await tx.printJob.findFirst({ where: { id, agentId: agent.id, restaurantId: agent.restaurantId, claimToken: body.claimToken } });
      if (job?.state === body.state) return { success: true };
      // A late result may clarify an expired SENDING lease, but never changes a different claim.
      if (!job || !['SENDING', 'UNCERTAIN'].includes(job.state)) throw new ConflictException('Print result does not match the active claim');
      await tx.printJob.update({ where: { id }, data: { state: body.state, leaseUntil: null, error: body.state === 'SENT' ? null : String(body.error || 'Check the printer before retrying').slice(0, 500) } });
      return { success: true };
    });
  }
}
