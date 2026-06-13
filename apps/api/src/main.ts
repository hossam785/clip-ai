import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Serve static assets from public/ folder
  app.useStaticAssets(path.join(__dirname, '..', 'public'), {
    prefix: '/static/',
  });

  await app.listen(4000);
  console.log(`[API Server] Running on http://localhost:4000`);
}
bootstrap();
