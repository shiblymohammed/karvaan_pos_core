import { PrismaService } from '../prisma/prisma.service';
export declare class HistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getBillHistory(options: {
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
        orderType?: string;
        paymentMethod?: string;
    }): Promise<{
        data: ({
            order: {
                orderType: string;
                orderNumber: string;
                notes: string;
                items: {
                    notes: string;
                    product: {
                        name: string;
                    };
                    price: number;
                    quantity: number;
                }[];
            };
            cashier: {
                name: string;
                role: string;
            };
        } & {
            id: string;
            billNumber: string;
            orderId: string;
            orderType: string;
            subtotal: number;
            cgst: number;
            sgst: number;
            discount: number;
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            cashierId: string | null;
            customerName: string | null;
            customerPhone: string | null;
            waiterName: string | null;
            settledAt: Date;
            syncedAt: Date | null;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasMore: boolean;
        };
        summary: {
            startDate: string;
            endDate: string;
            totalRevenue: number;
            totalBills: number;
        };
    }>;
    getDailySummary(date?: string): Promise<{
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
    getTopSellingItems(startDate?: string, endDate?: string, limit?: number): Promise<{
        productId: string;
        productName: string;
        totalSold: number;
    }[]>;
    getDeliveryHistory(options: {
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
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            customerName: string;
            customerPhone: string | null;
            syncedAt: Date | null;
            orderNumber: string;
            status: string;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            items: string;
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
    getWasteLogs(startDate?: string, endDate?: string): Promise<{
        id: string;
        billNumber: string | null;
        orderId: string | null;
        createdAt: Date;
        reason: string;
        quantity: number;
        unit: string;
        itemName: string;
        loggedBy: string | null;
    }[]>;
    getReturnRecords(startDate?: string, endDate?: string): Promise<{
        id: string;
        billNumber: string;
        orderType: string;
        createdAt: Date;
        items: string;
        reason: string;
        action: string;
        refundDest: string;
        totalRefund: number;
        authorizedBy: string | null;
    }[]>;
}
