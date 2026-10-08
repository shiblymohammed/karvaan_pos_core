import { BillingService } from './billing.service';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    createOrder(dto: any, user: any): Promise<{
        table: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            restaurantId: string;
            status: string;
            tableNumber: string;
            capacity: number;
            currentOrderId: string | null;
        };
        items: ({
            product: {
                id: string;
                name: string;
                description: string | null;
                price: number;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                prepTimeMinutes: number;
                imageEmoji: string | null;
                imageUrl: string | null;
                createdAt: Date;
                updatedAt: Date;
                restaurantId: string;
            };
        } & {
            id: string;
            price: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            notes: string | null;
            quantity: number;
            addons: string | null;
            productId: string;
            orderId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        restaurantId: string;
        orderNumber: string;
        orderType: string;
        status: string;
        totalAmount: number;
        discount: number;
        notes: string | null;
        syncedAt: Date | null;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
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
        };
        order: {
            table: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                restaurantId: string;
                status: string;
                tableNumber: string;
                capacity: number;
                currentOrderId: string | null;
            };
            items: ({
                product: {
                    recipeItems: {
                        id: string;
                        updatedAt: Date;
                        syncedAt: Date | null;
                        quantity: number;
                        productId: string;
                        unit: string;
                        inventoryItemId: string;
                    }[];
                } & {
                    id: string;
                    name: string;
                    description: string | null;
                    price: number;
                    gstRate: number;
                    categoryId: string;
                    isAvailable: boolean;
                    prepTimeMinutes: number;
                    imageEmoji: string | null;
                    imageUrl: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    restaurantId: string;
                };
            } & {
                id: string;
                price: number;
                createdAt: Date;
                updatedAt: Date;
                status: string;
                notes: string | null;
                quantity: number;
                addons: string | null;
                productId: string;
                orderId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            restaurantId: string;
            orderNumber: string;
            orderType: string;
            status: string;
            totalAmount: number;
            discount: number;
            notes: string | null;
            syncedAt: Date | null;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
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
                    name: string;
                    description: string | null;
                    price: number;
                    gstRate: number;
                    categoryId: string;
                    isAvailable: boolean;
                    prepTimeMinutes: number;
                    imageEmoji: string | null;
                    imageUrl: string | null;
                    createdAt: Date;
                    updatedAt: Date;
                    restaurantId: string;
                };
            } & {
                id: string;
                price: number;
                createdAt: Date;
                updatedAt: Date;
                status: string;
                notes: string | null;
                quantity: number;
                addons: string | null;
                productId: string;
                orderId: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            restaurantId: string;
            orderNumber: string;
            orderType: string;
            status: string;
            totalAmount: number;
            discount: number;
            notes: string | null;
            syncedAt: Date | null;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
        };
        cashier: {
            name: string;
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
    })[]>;
}
