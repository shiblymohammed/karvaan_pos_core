import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class StockPolicyService {
  constructor(private readonly auth: AuthService) {}

  async consume(tx: any, lines: any[], user: any, operation: string, reference: string, orderId: string, authorization?: string) {
    const needed = new Map<string, number>();
    for (const line of lines) for (const ingredient of line.recipe || []) {
      const quantity = ingredient.quantity * line.quantity;
      if (typeof ingredient.inventoryItemId !== 'string' || !Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Invalid recipe consumption');
      needed.set(ingredient.inventoryItemId, (needed.get(ingredient.inventoryItemId) || 0) + quantity);
    }
    const requirements = [...needed].sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => ({ id, quantity: Number(quantity.toFixed(6)) }));
    const stocks = await tx.inventoryItem.findMany({ where: { id: { in: requirements.map(row => row.id) }, restaurantId: user.restaurantId } });
    const shortages = [];
    for (const required of requirements) {
      const stock = stocks.find((row: any) => row.id === required.id);
      if (!stock || !stock.isActive) throw new BadRequestException('A recipe ingredient is unavailable. Reload inventory before continuing.');
      if (stock.currentStock + 0.000001 < required.quantity) shortages.push({ id: stock.id, name: stock.name, unit: stock.unit, available: stock.currentStock, required: required.quantity, shortfall: Number((required.quantity - stock.currentStock).toFixed(6)) });
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(requirements)).digest('hex');
    const context = { restaurantId: user.restaurantId, cashierId: user.id, operation, reference, fingerprint, shortages };
    let approval: any;
    if (shortages.length) {
      if (authorization) approval = await this.auth.verifyStockAuthorization(tx, authorization, context);
      if (!approval) throw new ConflictException({ message: `Insufficient stock: ${shortages.map(row => row.name).join(', ')}. Manager approval is required.`, reason: 'STOCK_APPROVAL_REQUIRED', shortages, stockChallenge: this.auth.createStockChallenge(context) });
      await tx.systemSetting.create({ data: { restaurantId: user.restaurantId, settingKey: `stock_override:${operation}:${reference}`, data: JSON.stringify({ ...context, approvedBy: approval.managerId, managerName: approval.managerName, cashierName: user.name || user.id, reason: approval.reason, recordedAt: new Date().toISOString() }) } });
    }
    for (const required of requirements) {
      await tx.inventoryItem.update({ where: { id: required.id }, data: { currentStock: { decrement: required.quantity }, revision: { increment: 1 } } });
      await tx.stockLog.create({ data: { itemId: required.id, orderId, type: 'OUT', reason: approval ? 'MANAGER_APPROVED_SHORTAGE' : 'SALE', quantityChange: -required.quantity, notes: JSON.stringify({ operation, reference, cashierId: user.id, ...(approval ? { approvedBy: approval.managerId, reason: approval.reason } : {}) }) } });
    }
  }
}
