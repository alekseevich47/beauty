import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { loadEnv } from '@beauty/config';
import { WorkerModule } from './queues/worker.module';
import { QueueWorkers } from './queues/processors/queue-workers';
import { QueuesService } from './queues/queues.service';
import { PinoLogger } from './common/logger/pino.logger';

async function bootstrap() {
  const env = loadEnv();
  if (env.API_CONTOUR !== 'worker' && env.API_CONTOUR !== 'dev') {
    Logger.warn(`Starting worker with API_CONTOUR=${env.API_CONTOUR}; expected worker`);
  }

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  const queues = app.get(QueuesService);
  // Repeatable jobs
  await queues.subscriptionDunning.add(
    'dunning-scan',
    {},
    { repeat: { every: 60 * 60_000 }, jobId: 'dunning-hourly' },
  );
  await queues.masterOfWeek.add(
    'mow-recompute',
    {},
    { repeat: { pattern: '0 3 * * 1' }, jobId: 'mow-weekly' },
  );
  await queues.mvRefresh.add(
    'refresh-mvs',
    {},
    { repeat: { every: 15 * 60_000 }, jobId: 'mv-refresh-15m' },
  );

  const workers = app.get(QueueWorkers);
  workers.start();

  Logger.log('Beauty+ worker running');

  const shutdown = async () => {
    await workers.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
