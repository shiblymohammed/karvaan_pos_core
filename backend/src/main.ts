import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for our React 19 / Vite / Tauri frontend
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
