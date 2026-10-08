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
        data: ({
            order: {
                orderNumber: string;
                orderType: string;
                notes: string;
                items: {
                    product: {
                        name: string;
                    };
                    price: number;
                    notes: string;
                    quantity: number;
                }[];
            };
            cashier: {
                name: string;
                role: string;
            };
        } & {
            id: string;
            updatedAt: Date;
            restaurantId: string;
            orderType: string;
            discount: number;
            syncedAt: Date | null;
            orderId: string;
            billNumber: string;
            subtotal: number;
            cgst: number;
            sgst: number;
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            customerName: string | null;
            customerPhone: string | null;
            waiterName: string | null;
            settledAt: Date;
            cashierId: string | null;
        })[];
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
            createdAt: Date;
            updatedAt: Date;
            restaurantId: string;
            orderNumber: string;
            status: string;
            notes: string | null;
            syncedAt: Date | null;
            items: string;
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            customerName: string;
            customerPhone: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        restaurantId: string;
        syncedAt: Date | null;
        quantity: number;
        orderId: string | null;
        billNumber: string | null;
        unit: string;
        reason: string;
        itemName: string;
        loggedBy: string | null;
    }[]>;
    getReturnRecords(restaurantId: string, startDate?: string, endDate?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        restaurantId: string | null;
        orderType: string;
        syncedAt: Date | null;
        items: string;
        billNumber: string;
        reason: string;
        action: string;
        refundDest: string;
        totalRefund: number;
        authorizedBy: string | null;
    }[]>;
}
