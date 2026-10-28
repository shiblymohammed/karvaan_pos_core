import { PrismaService } from '../prisma/prisma.service';
import { KdsGateway } from '../kds/kds.gateway';
import { StockPolicyService } from './stock-policy.service';
import { PrintQueueService } from '../printer/print-queue.service';
export declare class BillingService {
    private readonly prisma;
    private readonly kdsGateway;
    private readonly stockPolicy;
    private readonly printQueue;
    constructor(prisma: PrismaService, kdsGateway: KdsGateway, stockPolicy: StockPolicyService, printQueue: PrintQueueService);
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
            price?: number;
            variantId?: string;
            variantName?: string;
        }>;
    }): Promise<{
        table: {
            id: string;
            restaurantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            tableNumber: string;
            capacity: number;
            currentOrderId: string | null;
        };
        items: ({
            product: {
                id: string;
                restaurantId: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                imageUrl: string | null;
                description: string | null;
                price: number;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                isArchived: boolean;
                prepTimeMinutes: number;
                recipeInstructions: string | null;
                recipeBatchSize: number;
                imageEmoji: string | null;
                variants: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            price: number;
            productId: string;
            quantity: number;
            status: string;
            notes: string | null;
            orderId: string;
            addons: string | null;
            variant: string | null;
        })[];
    } & {
        id: string;
        restaurantId: string;
        createdAt: Date;
        updatedAt: Date;
        syncedAt: Date | null;
        orderNumber: string;
        orderType: string;
        discount: number;
        status: string;
        notes: string | null;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
        totalAmount: number;
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
        bill: any;
        order: {
            id: string;
            restaurantId: string;
            createdAt: Date;
            updatedAt: Date;
            syncedAt: Date | null;
            orderNumber: string;
            orderType: string;
            discount: number;
            status: string;
            notes: string | null;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
            totalAmount: number;
        };
    }>;
    pricedItems(tx: any, items: any[], restaurantId: string, persistedItems?: any[]): Promise<{
        lines: any[];
        settings: any;
    }>;
    saveKitchenOrder(data: any, restaurantId: string, waiterId: string): Promise<{
        printJobId: any;
        table: {
            id: string;
            restaurantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            tableNumber: string;
            capacity: number;
            currentOrderId: string | null;
        };
        items: ({
            product: {
                id: string;
                restaurantId: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                imageUrl: string | null;
                description: string | null;
                price: number;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                isArchived: boolean;
                prepTimeMinutes: number;
                recipeInstructions: string | null;
                recipeBatchSize: number;
                imageEmoji: string | null;
                variants: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            price: number;
            productId: string;
            quantity: number;
            status: string;
            notes: string | null;
            orderId: string;
            addons: string | null;
            variant: string | null;
        })[];
        id: string;
        restaurantId: string;
        createdAt: Date;
        updatedAt: Date;
        syncedAt: Date | null;
        orderNumber: string;
        orderType: string;
        discount: number;
        status: string;
        notes: string | null;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
        totalAmount: number;
    }>;
    processDirectCheckout(data: any, restaurantId: string, cashierId: string): Promise<any>;
    printPrebill(data: any, user: any): Promise<{
        id: string;
        kind: string;
        reference: string;
        state: string;
    }>;
    recipeForProduct(tx: any, productId: string): Promise<any>;
    checkoutInTransaction(tx: any, data: any, restaurantId: string, cashierId: string, storedPricing?: any): Promise<any>;
    getDailyDashboardSummary(restaurantId: string): Promise<{
        grossRevenue: number;
        refundTotal: number;
        netRevenue: number;
        repayments: number;
        collectionBreakdown: {
            [x: string]: number;
        };
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
    getOrderHistory(restaurantId: string, startDate?: string, endDate?: string): Promise<any[]>;
}
