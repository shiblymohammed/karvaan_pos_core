import { HistoryService } from './history.service';
export declare class HistoryController {
    private readonly historyService;
    constructor(historyService: HistoryService);
    getBillHistory(startDate?: string, endDate?: string, page?: string, limit?: string, orderType?: string, paymentMethod?: string): Promise<{
        data: ({
            order: {
                orderNumber: string;
                orderType: string;
                notes: string;
                items: {
                    product: {
                        name: string;
                    };
                    notes: string;
                    quantity: number;
                    price: number;
                }[];
            };
            cashier: {
                name: string;
                role: string;
            };
        } & {
            id: string;
            orderType: string;
            discount: number;
            orderId: string;
            customerName: string | null;
            customerPhone: string | null;
            paymentMethod: string;
            grandTotal: number;
            deliveryFee: number;
            billNumber: string;
            subtotal: number;
            cgst: number;
            sgst: number;
            cashierId: string | null;
            waiterName: string | null;
            settledAt: Date;
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
    getTopItems(startDate?: string, endDate?: string, limit?: string): Promise<{
        productId: string;
        productName: string;
        totalSold: number;
    }[]>;
    getDeliveryHistory(startDate?: string, endDate?: string, page?: string, limit?: string, riderId?: string, status?: string): Promise<{
        data: ({
            rider: {
                name: string;
            };
        } & {
            id: string;
            status: string;
            createdAt: Date;
            orderNumber: string;
            notes: string | null;
            updatedAt: Date;
            items: string;
            customerName: string;
            customerPhone: string | null;
            deliveryAddress: string | null;
            deliveryLat: number | null;
            deliveryLng: number | null;
            riderId: string | null;
            riderName: string | null;
            paymentMethod: string;
            paymentStatus: string;
            grandTotal: number;
            deliveryFee: number;
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
        createdAt: Date;
        orderId: string | null;
        quantity: number;
        unit: string;
        itemName: string;
        reason: string;
        billNumber: string | null;
        loggedBy: string | null;
    }[]>;
    getReturnRecords(startDate?: string, endDate?: string): Promise<{
        id: string;
        createdAt: Date;
        orderType: string;
        items: string;
        reason: string;
        billNumber: string;
        action: string;
        refundDest: string;
        totalRefund: number;
        authorizedBy: string | null;
    }[]>;
}
