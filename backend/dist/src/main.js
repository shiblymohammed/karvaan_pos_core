"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    const PORT = process.env.PORT || 3001;
    await app.listen(PORT);
    console.log(`🚀 [Karvaan POS Backend] NestJS Enterprise API running on: http://localhost:${PORT}`);
    console.log(`📡 [WebSocket Gateway] Real-Time KDS & Table Sync listening on port ${PORT}`);
}
bootstrap();
//# sourceMappingURL=main.js.map