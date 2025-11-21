import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure CORS for WebSocket connections
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  });
  
  // Use WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));
  
  // Start server on port 3000
  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();