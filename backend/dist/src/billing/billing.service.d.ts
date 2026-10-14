import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway';
export declare class BillingService {
    private readonly prisma;
    private readonly kdsGateway;
    constructor(prisma: PrismaService, kdsGateway: KdsGateway);
    createOrder(data: {
        tableId?: string;
        waiterId?: string;
        customerId?: string;
        notes?: string;
        restaurantId: string;
        items: Array<{
            productId: string;
            quantity: number;
            notes?: string;
        }>;
    }): Promise<{
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
    calculateBillPreview(orderId: string, restaurantId: string, discountAmount?: number): Promise<{
        orderId: string;
        orderNumber: string;
        subtotal: number;
        discount: number;
        cgst: number;
        sgst: number;
        grandTotal: number;
    }>;
    settleBill(data: {
        orderId: string;
        paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT';
        discount?: number;
    }, restaurantId: string, cashierId: string): Promise<{
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
    private pricedItems;
    saveKitchenOrder(data: any, restaurantId: string, waiterId: string): Promise<{
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
    processDirectCheckout(data: any, restaurantId: string, cashierId: string): Promise<{
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
    }>;
    getDailyDashboardSummary(restaurantId: string): Promise<{
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
    getOrderHistory(restaurantId: string, startDate?: string, endDate?: string): Promise<({
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
