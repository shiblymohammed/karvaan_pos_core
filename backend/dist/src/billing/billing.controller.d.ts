import { BillingService } from './billing.service';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    createOrder(dto: any): Promise<{
        table: {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            tableNumber: string;
            capacity: number;
            currentOrderId: string | null;
        };
        items: ({
            product: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                price: number;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                prepTimeMinutes: number;
                imageUrl: string | null;
            };
        } & {
            id: string;
            orderId: string;
            status: string;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            price: number;
            productId: string;
            quantity: number;
            addons: string | null;
        })[];
    } & {
        id: string;
        orderType: string;
        discount: number;
        syncedAt: Date | null;
        orderNumber: string;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
        status: string;
        totalAmount: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getBillPreview(orderId: string, discount?: number): Promise<{
        orderId: string;
        orderNumber: string;
        subtotal: number;
        discount: number;
        cgst: number;
        sgst: number;
        grandTotal: number;
    }>;
    settleBill(dto: {
        orderId: string;
        paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT';
        discount?: number;
    }): Promise<{
        bill: {
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
        };
        order: {
            table: {
                id: string;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                tableNumber: string;
                capacity: number;
                currentOrderId: string | null;
            };
            items: ({
                product: {
                    id: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    price: number;
                    gstRate: number;
                    categoryId: string;
                    isAvailable: boolean;
                    prepTimeMinutes: number;
                    imageUrl: string | null;
                };
            } & {
                id: string;
                orderId: string;
                status: string;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                price: number;
                productId: string;
                quantity: number;
                addons: string | null;
            })[];
        } & {
            id: string;
            orderType: string;
            discount: number;
            syncedAt: Date | null;
            orderNumber: string;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
            status: string;
            totalAmount: number;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    getDashboardSummary(): Promise<{
        grossRevenue: number;
        totalOrders: number;
        averageOrderValue: number;
        activeOrdersCount: number;
        occupiedTablesCount: number;
        paymentBreakdown: {
            cash: number;
            card: number;
            upi: number;
        };
    }>;
}
