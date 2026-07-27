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
exports.HistoryController = void 0;
const common_1 = require("@nestjs/common");
const history_service_1 = require("./history.service");
let HistoryController = class HistoryController {
    constructor(historyService) {
        this.historyService = historyService;
    }
    async getBillHistory(startDate, endDate, page, limit, orderType, paymentMethod) {
        return this.historyService.getBillHistory({
            startDate,
            endDate,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50,
            orderType,
            paymentMethod,
        });
    }
    async getDailySummary(date) {
        return this.historyService.getDailySummary(date);
    }
    async getTopItems(startDate, endDate, limit) {
        return this.historyService.getTopSellingItems(startDate, endDate, limit ? parseInt(limit) : 10);
    }
    async getDeliveryHistory(startDate, endDate, page, limit, riderId, status) {
        return this.historyService.getDeliveryHistory({
            startDate,
            endDate,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50,
            riderId,
            status,
        });
    }
    async getWasteLogs(startDate, endDate) {
        return this.historyService.getWasteLogs(startDate, endDate);
    }
    async getReturnRecords(startDate, endDate) {
        return this.historyService.getReturnRecords(startDate, endDate);
    }
};
exports.HistoryController = HistoryController;
__decorate([
    (0, common_1.Get)('bills'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('orderType')),
    __param(5, (0, common_1.Query)('paymentMethod')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getBillHistory", null);
__decorate([
    (0, common_1.Get)('daily-summary'),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getDailySummary", null);
__decorate([
    (0, common_1.Get)('top-items'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getTopItems", null);
__decorate([
    (0, common_1.Get)('deliveries'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('riderId')),
    __param(5, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getDeliveryHistory", null);
__decorate([
    (0, common_1.Get)('waste'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getWasteLogs", null);
__decorate([
    (0, common_1.Get)('returns'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], HistoryController.prototype, "getReturnRecords", null);
exports.HistoryController = HistoryController = __decorate([
    (0, common_1.Controller)('history'),
    __metadata("design:paramtypes", [history_service_1.HistoryService])
], HistoryController);
//# sourceMappingURL=history.controller.js.map