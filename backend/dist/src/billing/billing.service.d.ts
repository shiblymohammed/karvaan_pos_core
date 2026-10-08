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
    }, restaurantId: string, cashierId?: string): Promise<{
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
    processDirectCheckout(billData: any, restaurantId: string): Promise<{
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
