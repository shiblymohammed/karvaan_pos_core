"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const os = require("os");
const fs = require("fs");
const dotenv = require("dotenv");
const crypto_1 = require("crypto");
const backendRoot = [path.resolve(__dirname, '../..'), path.resolve(__dirname, '..')]
    .find(root => fs.existsSync(path.join(root, 'prisma', 'schema.prisma')));
if (!backendRoot)
    throw new Error('Backend resources are missing');
process.chdir(backendRoot);
dotenv.config({ path: path.join(backendRoot, '.env') });
const desktop = process.env.KARVAAN_DESKTOP === 'true';
const appData = process.env.APPDATA || path.join(os.homedir(), '.local', 'share');
const dataDirectory = path.join(appData, 'KarvaanPOS');
fs.mkdirSync(dataDirectory, { recursive: true });
const writableEnv = path.join(dataDirectory, '.env');
if (desktop && fs.existsSync(writableEnv))
    dotenv.config({ path: writableEnv });
if (!process.env.JWT_SECRET || ['CHANGE_ME', 'karvaan-super-secret-key-2026'].includes(process.env.JWT_SECRET)) {
    if (process.env.IS_CLOUD === 'true')
        throw new Error('Configure JWT_SECRET for the cloud server');
    const secretPath = path.join(dataDirectory, 'jwt-secret');
    if (!fs.existsSync(secretPath))
        fs.writeFileSync(secretPath, (0, crypto_1.randomBytes)(48).toString('hex'), { flag: 'wx', mode: 0o600 });
    process.env.JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
}
const activeDatabase = path.join(dataDirectory, 'dev.db');
if (process.env.IS_CLOUD !== 'true') {
    const template = path.join(backendRoot, 'prisma', 'dev.db');
    if (!fs.existsSync(activeDatabase) && fs.existsSync(template))
        fs.copyFileSync(template, activeDatabase);
    process.env.DATABASE_URL = `file:${activeDatabase}`;
}
else if (process.env.DATABASE_URL?.startsWith('file:')) {
    const configured = process.env.DATABASE_URL.slice(5);
    process.env.DATABASE_URL = `file:${path.isAbsolute(configured) ? configured : path.resolve(backendRoot, 'prisma', configured)}`;
}
process.env.UPLOAD_DIR ||= path.join(dataDirectory, 'uploads');
fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const express_1 = require("express");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
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
    app.useStaticAssets(process.env.UPLOAD_DIR, {
        prefix: '/uploads/',
    });
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
    });
    app.use((0, express_1.json)({ limit: '500mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '500mb' }));
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: false }));
    app.enableShutdownHooks();
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter());
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            service: 'Karvaan POS Backend',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            localIPs: getLocalIPs(),
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
bootstrap().catch(error => { console.error('Backend startup failed:', error.message); process.exitCode = 1; });
//# sourceMappingURL=main.js.map