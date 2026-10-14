import { BillingService } from './billing.service';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    createOrder(dto: any, user: any): Promise<{
        table: {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            restaurantId: string;
            tableNumber: string;
            capacity: number;
            currentOrderId: string | null;
        };
        items: ({
            product: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                restaurantId: string;
                price: number;
                name: string;
                description: string | null;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                prepTimeMinutes: number;
                imageEmoji: string | null;
                imageUrl: string | null;
            };
        } & {
            id: string;
            status: string;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            quantity: number;
            price: number;
            addons: string | null;
            productId: string;
            orderId: string;
        })[];
    } & {
        id: string;
        orderNumber: string;
        orderType: string;
        status: string;
        totalAmount: number;
        discount: number;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        syncedAt: Date | null;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
        restaurantId: string;
    }>;
    getBillPreview(orderId: string, discount?: number, user?: any): Promise<{
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
    }, user: any): Promise<{
        bill: {
            id: string;
            orderType: string;
            discount: number;
            updatedAt: Date;
            syncedAt: Date | null;
            restaurantId: string;
            orderId: string;
            billNumber: string;
            subtotal: number;
            cgst: number;
            sgst: number;
            deliveryFee: number;
            grandTotal: number;
            paymentMethod: string;
            cashierId: string | null;
            customerName: string | null;
            customerPhone: string | null;
            waiterName: string | null;
            settledAt: Date;
        };
        order: {
            id: string;
            orderNumber: string;
            orderType: string;
            status: string;
            totalAmount: number;
            discount: number;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            syncedAt: Date | null;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
            restaurantId: string;
        };
    }>;
    getDashboardSummary(user: any): Promise<{
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
    getOrderHistory(startDate?: string, endDate?: string, user?: any): Promise<({
        order: {
            table: {
                tableNumber: string;
            };
            waiter: {
                name: string;
            };
            items: ({
                product: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    restaurantId: string;
                    price: number;
                    name: string;
                    description: string | null;
                    gstRate: number;
                    categoryId: string;
                    isAvailable: boolean;
                    prepTimeMinutes: number;
                    imageEmoji: string | null;
                    imageUrl: string | null;
                };
            } & {
                id: string;
                status: string;
                notes: string | null;
                createdAt: Date;
                updatedAt: Date;
                quantity: number;
                price: number;
                addons: string | null;
                productId: string;
                orderId: string;
            })[];
        } & {
            id: string;
            orderNumber: string;
            orderType: string;
            status: string;
            totalAmount: number;
            discount: number;
            notes: string | null;
            createdAt: Date;
            updatedAt: Date;
            syncedAt: Date | null;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
            restaurantId: string;
        };
        cashier: {
            name: string;
        };
    } & {
        id: string;
        orderType: string;
        discount: number;
        updatedAt: Date;
        syncedAt: Date | null;
        restaurantId: string;
        orderId: string;
        billNumber: string;
        subtotal: number;
        cgst: number;
        sgst: number;
        deliveryFee: number;
        grandTotal: number;
        paymentMethod: string;
        cashierId: string | null;
        customerName: string | null;
        customerPhone: string | null;
        waiterName: string | null;
        settledAt: Date;
    })[]>;
}
