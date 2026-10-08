"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("./prisma/prisma.service");
const kds_gateway_1 = require("./kds/kds.gateway");
const billing_service_1 = require("./billing/billing.service");
const billing_controller_1 = require("./billing/billing.controller");
const backup_module_1 = require("./backup/backup.module");
const history_module_1 = require("./history/history.module");
const sync_module_1 = require("./sync/sync.module");
const upload_module_1 = require("./upload/upload.module");
const settings_module_1 = require("./settings/settings.module");
const auth_module_1 = require("./auth/auth.module");
const prisma_module_1 = require("./prisma/prisma.module");
const tenant_module_1 = require("./tenant/tenant.module");
const printer_module_1 = require("./printer/printer.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            backup_module_1.BackupModule,
            history_module_1.HistoryModule,
            sync_module_1.SyncModule,
            upload_module_1.UploadModule,
            settings_module_1.SettingsModule,
            auth_module_1.AuthModule,
            prisma_module_1.PrismaModule,
            tenant_module_1.TenantModule,
            printer_module_1.PrinterModule,
        ],
        controllers: [billing_controller_1.BillingController],
        providers: [prisma_service_1.PrismaService, kds_gateway_1.KdsGateway, billing_service_1.BillingService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map