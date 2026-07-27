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
                createdAt: Date;
                name: string;
                updatedAt: Date;
                price: number;
                description: string | null;
                gstRate: number;
                categoryId: string;
                isAvailable: boolean;
                prepTimeMinutes: number;
                imageUrl: string | null;
            };
        } & {
            id: string;
            status: string;
            createdAt: Date;
            notes: string | null;
            updatedAt: Date;
            orderId: string;
            productId: string;
            quantity: number;
            price: number;
            addons: string | null;
        })[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        orderNumber: string;
        orderType: string;
        tableId: string | null;
        waiterId: string | null;
        customerId: string | null;
        totalAmount: number;
        discount: number;
        notes: string | null;
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
                    createdAt: Date;
                    name: string;
                    updatedAt: Date;
                    price: number;
                    description: string | null;
                    gstRate: number;
                    categoryId: string;
                    isAvailable: boolean;
                    prepTimeMinutes: number;
                    imageUrl: string | null;
                };
            } & {
                id: string;
                status: string;
                createdAt: Date;
                notes: string | null;
                updatedAt: Date;
                orderId: string;
                productId: string;
                quantity: number;
                price: number;
                addons: string | null;
            })[];
        } & {
            id: string;
            status: string;
            createdAt: Date;
            orderNumber: string;
            orderType: string;
            tableId: string | null;
            waiterId: string | null;
            customerId: string | null;
            totalAmount: number;
            discount: number;
            notes: string | null;
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
