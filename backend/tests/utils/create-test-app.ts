import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { configureApp } from '../../src/app.setup.js';

export const TEST_JWT_SECRET =
  'test-secret-that-is-at-least-32-characters-long';
export const TEST_ORIGIN = 'http://localhost:5173';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

interface TestAppOptions {
  // Keep the rate-limit counters in this Redis. Without it, the app counts in memory.
  redisUrl?: string;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const mongod = await MongoMemoryServer.create();

  // A REDIS_URL in the shell must not leak into tests that do not ask for Redis.
  if (options.redisUrl) process.env.REDIS_URL = options.redisUrl;
  else delete process.env.REDIS_URL;

  // AppModule reads process.env when it is first imported, so set the environment first.
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: mongod.getUri('e2e-test'),
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_EXPIRES_IN: '15m',
    CORS_ORIGIN: TEST_ORIGIN,
  });
  const { AppModule } = await import('../../src/app.module.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      await mongod.stop();
    },
  };
}
