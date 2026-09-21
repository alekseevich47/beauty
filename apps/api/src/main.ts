import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { loadEnv, parseCorsOrigins } from '@beauty/config';
import { MiniAppModule } from './miniapp.module';
import { InternalModule } from './internal.module';
import { PinoLogger } from './common/logger/pino.logger';

async function bootstrap() {
  const env = loadEnv();
  const contour = env.API_CONTOUR;

  if (contour === 'worker') {
    throw new Error('API_CONTOUR=worker must use start:worker / worker.ts entrypoint');
  }

  const RootModule = contour === 'internal' ? InternalModule : MiniAppModule;

  const app = await NestFactory.create<NestExpressApplication>(RootModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  // Required for correct req.ip behind Traefik; rate limiting depends on it and
  // must not fall back to a client-supplied X-Forwarded-For value.
  app.set('trust proxy', env.TRUSTED_PROXY_HOPS);

  app.setGlobalPrefix('api/v1', {
    exclude: ['healthz', 'readyz', 'metrics'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: contour === 'miniapp' || contour === 'dev',
      crossOriginEmbedderPolicy: false,
    }),
  );

  const origins =
    contour === 'internal'
      ? parseCorsOrigins(env.CORS_ADMIN_ORIGINS)
      : parseCorsOrigins(env.CORS_MINIAPP_ORIGINS);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const port = env.API_PORT;
  const host = env.API_HOST;
  await app.listen(port, host);
  Logger.log(`Beauty+ API (${contour}) listening on ${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
