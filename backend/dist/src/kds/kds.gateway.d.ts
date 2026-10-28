import { OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { WorkflowService } from '../billing/workflow.service';
import { SessionService } from '../auth/session.service';
import { SettingsService } from '../settings/settings.service';
export declare class KdsGateway implements OnGatewayConnection {
    private readonly prisma;
    private readonly billingService;
    private readonly workflows;
    private readonly jwtService;
    private readonly sessions;
    private readonly settingsService;
    server: Server;
    constructor(prisma: PrismaService, billingService: BillingService, workflows: WorkflowService, jwtService: JwtService, sessions: SessionService, settingsService: SettingsService);
    private authenticate;
    private run;
    private list;
    broadcastOperations(restaurantId: string, includeWaste?: boolean): Promise<void>;
    handleCreateDelivery(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handlePark(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleUnpark(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleUpdateDelivery(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleDeliveryPayment(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleLedgerPayment(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleInventoryChanges(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleInventoryPurchase(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleReturn(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    private owned;
    private staff;
    ticket(order: any): {
        id: any;
        orderNumber: any;
        restaurantId: any;
        orderType: any;
        tableNumber: any;
        status: any;
        firedAt: any;
        elapsedMinutes: number;
        items: any;
    };
    handleConnection(client: Socket): Promise<void>;
    handleFireOrder(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleStatusUpdate(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleRiderRemittance(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleClearTableTickets(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncParkedOrders(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleTransferTable(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleTableStatus(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncDeliveryOrders(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncStaff(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncInventory(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncRecipes(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleUpdateSettings(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncMenu(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSyncWaste(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleInventoryWaste(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
    handleSettleBill(data: any, client: Socket): Promise<{
        status: string;
        data: any;
    } | {
        reason?: any;
        stockChallenge?: any;
        shortages?: any;
        status: string;
        message: any;
        code: number;
        data?: undefined;
    }>;
}
