import { OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { SessionService } from '../auth/session.service';
export declare class KdsGateway implements OnGatewayConnection {
    private readonly prisma;
    private readonly billingService;
    private readonly jwtService;
    private readonly sessions;
    server: Server;
    constructor(prisma: PrismaService, billingService: BillingService, jwtService: JwtService, sessions: SessionService);
    private authenticate;
    private run;
    private list;
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
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleStatusUpdate(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleClearTableTickets(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncParkedOrders(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleTransferTable(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleTableStatus(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncDeliveryOrders(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncStaff(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncInventory(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncRecipes(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncMenu(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSyncWaste(data: any[], client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
    handleSettleBill(data: any, client: Socket): Promise<{
        status: string;
        data: any;
        message?: undefined;
        code?: undefined;
    } | {
        status: string;
        message: string;
        code: number;
        data?: undefined;
    }>;
}
