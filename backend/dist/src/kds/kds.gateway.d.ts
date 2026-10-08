import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { JwtService } from '@nestjs/jwt';
export declare class KdsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly prisma;
    private readonly billingService;
    private readonly jwtService;
    server: Server;
    constructor(prisma: PrismaService, billingService: BillingService, jwtService: JwtService);
    private activeTickets;
    private tableStatuses;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleFireOrder(orderData: any, client: Socket): Promise<{
        status: string;
    }>;
    handleStatusUpdate(payload: {
        orderId: string;
        status: string;
        itemId?: string;
    }): Promise<{
        status: string;
    }>;
    handleClearTableTickets(payload: {
        tableName: string;
    }): Promise<{
        status: string;
    }>;
    handleSyncParkedOrders(orders: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleTableStatus(payload: {
        tableId: string;
        status: string;
        subtotal?: number;
        mergedWith?: string[];
        mergedInto?: string | null;
    }): Promise<{
        status: string;
    }>;
    handleSyncDeliveryOrders(orders: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleSyncStaff(staff: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleSyncInventory(inventory: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleSyncRecipes(recipes: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleSyncWaste(wasteLogs: any[], client: Socket): Promise<{
        status: string;
    }>;
    handleSettleBill(billData: any, client: Socket): Promise<{
        status: string;
    }>;
    private getOrCreateOrderId;
}
