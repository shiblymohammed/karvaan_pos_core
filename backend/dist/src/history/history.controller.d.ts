import { HistoryService } from './history.service';
export declare class HistoryController {
    private readonly historyService;
    constructor(historyService: HistoryService);
    getBillHistory(startDate?: string, endDate?: string, page?: string, limit?: string, orderType?: string, paymentMethod?: string, user?: any): Promise<{
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
    getDailySummary(date?: string, user?: any): Promise<{
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
    getTopItems(startDate?: string, endDate?: string, limit?: string, user?: any): Promise<{
        productId: string;
        productName: string;
        totalSold: number;
    }[]>;
    getDeliveryHistory(startDate?: string, endDate?: string, page?: string, limit?: string, riderId?: string, status?: string, user?: any): Promise<{
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
    getWasteLogs(startDate?: string, endDate?: string, user?: any): Promise<{
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
    getReturnRecords(startDate?: string, endDate?: string, user?: any): Promise<{
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
