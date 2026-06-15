import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  // Startup validation: Fail if secret is missing
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is missing.');
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS security allowlist configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Serve static assets from public/ folder excluding 'uploads' (videos and thumbnails only)
  app.useStaticAssets(path.join(__dirname, '..', 'public', 'videos'), {
    prefix: '/static/videos/',
  });
  app.useStaticAssets(path.join(__dirname, '..', 'public', 'thumbnails'), {
    prefix: '/static/thumbnails/',
  });

  await app.listen(4000);
  console.log(`[API Server] Running on http://localhost:4000`);
}
bootstrap();
