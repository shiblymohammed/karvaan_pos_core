"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("./billing.service");
const workflow_service_1 = require("./workflow.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/get-user.decorator");
const roles_guard_1 = require("../auth/roles.guard");
let BillingController = class BillingController {
    constructor(billingService, workflows) {
        this.billingService = billingService;
        this.workflows = workflows;
    }
    printPrebill(data, user) { return this.billingService.printPrebill(data, user); }
    getLedger(user) { return this.workflows.ledger(user.restaurantId); }
    getRiderRemittance(riderId, user) { return this.workflows.riderRemittanceSummary(riderId, user); }
    getMenu(user) { return this.workflows.menu(user.restaurantId); }
    getAdminConfig(user) { return this.workflows.adminConfig(user.restaurantId); }
    getInventory(user) { return this.workflows.inventoryState(user.restaurantId); }
    getDeliveries(user) { return this.workflows.deliveryState(user.restaurantId); }
    getWaste(user) { return this.workflows.wasteState(user.restaurantId); }
    getStockApprovals(user) { return this.workflows.stockApprovals(user.restaurantId); }
    getInvoice(billNumber, user) { return this.workflows.invoice(billNumber, user.restaurantId); }
    getActiveOrder(orderNumber, tableId, user) { return this.workflows.activeOrder(orderNumber, user.restaurantId, tableId); }
    async createOrder(dto, user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.createOrder({ ...dto, restaurantId: user.restaurantId, waiterId: user.id });
    }
    async getBillPreview(orderId, discount, user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.calculateBillPreview(orderId, user.restaurantId, discount ? Number(discount) : 0);
    }
    async settleBill(dto, user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.settleBill(dto, user.restaurantId, user.id);
    }
    async getDashboardSummary(user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.getDailyDashboardSummary(user.restaurantId);
    }
    async getOrderHistory(startDate, endDate, user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.getOrderHistory(user.restaurantId, startDate, endDate);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('print-prebill'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "printPrebill", null);
__decorate([
    (0, common_1.Get)('ledger'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getLedger", null);
__decorate([
    (0, common_1.Get)('rider-remittance/:riderId'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'DELIVERY'),
    __param(0, (0, common_1.Param)('riderId')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getRiderRemittance", null);
__decorate([
    (0, common_1.Get)('menu'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getMenu", null);
__decorate([
    (0, common_1.Get)('admin-config'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getAdminConfig", null);
__decorate([
    (0, common_1.Get)('inventory'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'KITCHEN'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getInventory", null);
__decorate([
    (0, common_1.Get)('deliveries'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'DELIVERY', 'KITCHEN'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getDeliveries", null);
__decorate([
    (0, common_1.Get)('waste'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'KITCHEN'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getWaste", null);
__decorate([
    (0, common_1.Get)('stock-approvals'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getStockApprovals", null);
__decorate([
    (0, common_1.Get)('invoice/:billNumber'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER'),
    __param(0, (0, common_1.Param)('billNumber')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getInvoice", null);
__decorate([
    (0, common_1.Get)('active-order/:orderNumber'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'WAITER'),
    __param(0, (0, common_1.Param)('orderNumber')),
    __param(1, (0, common_1.Query)('tableId')),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getActiveOrder", null);
__decorate([
    (0, common_1.Post)('order'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER', 'WAITER'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('preview/:orderId'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Query)('discount')),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getBillPreview", null);
__decorate([
    (0, common_1.Post)('settle'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "settleBill", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getDashboardSummary", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, roles_guard_1.Roles)(...roles_guard_1.ADMIN_ROLES, 'CASHIER'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getOrderHistory", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService, workflow_service_1.WorkflowService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map