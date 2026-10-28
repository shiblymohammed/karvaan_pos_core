import { PrismaService } from '../prisma/prisma.service';
export declare class HistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getBillHistory(options: {
        restaurantId: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
        orderType?: string;
        paymentMethod?: string;
    }): Promise<{
        data: any[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasMore: boolean;
        };
        summary: {
            startDate: any;
            endDate: any;
            totalRevenue: number;
            totalBills: number;
        };
    }>;
    getDailySummary(restaurantId: string, date?: string): Promise<{
        date: string;
        totalBills: number;
        grossRevenue: number;
        totalDiscount: number;
        totalGst: number;
        refunds: number;
        repayments: number;
        collectionBreakdown: {
            [x: string]: number;
        };
        netRevenue: number;
        deliveriesCompleted: number;
        paymentBreakdown: Record<string, number>;
        orderTypeBreakdown: Record<string, number>;
    }>;
    getTopSellingItems(restaurantId: string, startDate?: string, endDate?: string, limit?: number): Promise<{
        productId: string;
        productName: string;
        totalSold: number;
    }[]>;
    getDeliveryHistory(options: {
        restaurantId: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
        riderId?: string;
        status?: string;
    }): Promise<{
        data: ({
            rider: {
                name: string;
            };
        } & {
            id: string;
            updatedAt: Date;
            restaurantId: string;
            revision: number;
            orderNumber: string;
            orderType: string;
            status: string;
            discount: number;
            notes: string | null;
            createdAt: Date;
            syncedAt: Date | null;
            items: string;
            subtotal: number;
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            billNumber: string | null;
            customerName: string;
            customerPhone: string | null;
            archived: boolean;
            inventoryConsumed: boolean;
            collectedById: string | null;
            collectedTenders: string | null;
            remittedAt: Date | null;
            deliveryAddress: string | null;
            deliveryLat: number | null;
            deliveryLng: number | null;
            riderId: string | null;
            riderName: string | null;
            paymentStatus: string;
            collectedAmount: number | null;
            dispatchedAt: Date | null;
            deliveredAt: Date | null;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getWasteLogs(restaurantId: string, startDate?: string, endDate?: string): Promise<{
        id: string;
        updatedAt: Date;
        restaurantId: string;
        reason: string;
        createdAt: Date;
        syncedAt: Date | null;
        quantity: number;
        orderId: string | null;
        billNumber: string | null;
        unit: string;
        itemName: string;
        ingredientId: string | null;
        costLoss: number | null;
        loggedBy: string | null;
    }[]>;
    getReturnRecords(restaurantId: string, startDate?: string, endDate?: string): Promise<{
        id: string;
        updatedAt: Date;
        restaurantId: string;
        reason: string;
        orderType: string;
        createdAt: Date;
        syncedAt: Date | null;
        items: string;
        cgst: number;
        sgst: number;
        billNumber: string;
        action: string;
        refundDest: string;
        totalRefund: number;
        authorizedBy: string | null;
    }[]>;
}
