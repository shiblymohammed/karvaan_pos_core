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
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_user_decorator_1 = require("../auth/get-user.decorator");
let BillingController = class BillingController {
    constructor(billingService) {
        this.billingService = billingService;
    }
    async createOrder(dto, user) {
        if (!user.restaurantId)
            throw new common_1.UnauthorizedException('No restaurant context');
        return this.billingService.createOrder({ ...dto, restaurantId: user.restaurantId });
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
    (0, common_1.Post)('order'),
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
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "settleBill", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getDashboardSummary", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getOrderHistory", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map