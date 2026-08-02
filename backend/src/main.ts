import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as os from 'os';

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
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
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Health check — used by Setup Screen to probe connectivity
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      service: 'Karvaan POS Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  const PORT = process.env.PORT || 3001;

  // Listen on 0.0.0.0 so LAN tablets and phones can reach this server
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
