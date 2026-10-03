"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const express_1 = require("express");
const os = require("os");
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    });
    app.use((0, express_1.json)({ limit: '500mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '500mb' }));
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            service: 'Karvaan POS Backend',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        });
    });
    const PORT = process.env.PORT || 3001;
    await app.listen(PORT, '0.0.0.0');
    const localIPs = getLocalIPs();
    console.log(`\n🚀 [Karvaan POS Backend] Running on port ${PORT}`);
    console.log(`📡 [WebSocket] Real-Time KDS & Table Sync active`);
    console.log(`\n🌐 [LAN Access] Connect tablets and phones to any of these URLs:`);
    localIPs.forEach(ip => {
        console.log(`   http://${ip}:${PORT}  <- Use this on your tablet/phone`);
    });
    console.log(`\n   Tip: Set this URL in the POS app Setup Screen on each device.`);
    console.log(`   Or scan the QR code in Admin Network Setup screen.\n`);
}
bootstrap();
//# sourceMappingURL=main.js.map