import { Logger } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { Redis, type RedisOptions } from 'ioredis';
import {
  RedisThrottlerStorage,
  type ScriptRunner,
} from './redis-throttler-storage.js';

const logger = new Logger('Throttler');

const DEFAULT_LIMITS = [{ ttl: 60_000, limit: 100 }];

// A broken Redis must not slow the api: commands fail at once while the connection is
// down, and after 1 second at most. The storage then counts in memory.
export const FAIL_FAST_REDIS_OPTIONS: RedisOptions = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2_000,
  commandTimeout: 1_000,
  retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
};

function connectToRedis(url: string): ScriptRunner {
  const client = new Redis(url, FAIL_FAST_REDIS_OPTIONS);
  // Without a listener, ioredis prints every connection error to the console by itself.
  client.on('error', (error) => {
    logger.warn(`Redis connection problem: ${error.message}`);
  });
  return client;
}

export function createThrottlerOptions(
  redisUrl: string | undefined,
  connect: (url: string) => ScriptRunner = connectToRedis,
): ThrottlerModuleOptions {
  if (!redisUrl) {
    logger.log('Rate-limit counters are kept in the memory of this api copy');
    return { throttlers: DEFAULT_LIMITS };
  }

  logger.log('Rate-limit counters are kept in Redis');
  return {
    throttlers: DEFAULT_LIMITS,
    storage: new RedisThrottlerStorage(
      connect(redisUrl),
      new ThrottlerStorageService(),
    ),
  };
}
