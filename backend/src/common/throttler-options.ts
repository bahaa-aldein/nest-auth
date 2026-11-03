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

// Every route that has no @Throttle of its own: 100 requests a minute for each client.
const DEFAULT_LIMITS = [{ ttl: 60_000, limit: 100 }];

// A rate limit must never make the api wait for a broken Redis. With these settings a
// command fails at once while the connection is down (no waiting queue), and a stuck
// command fails after one second. The storage then counts in memory instead.
// The client still tries to reconnect in the background.
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

// Builds the options of the ThrottlerModule. With a Redis address, all api copies share
// their counters in Redis. Without one, each copy counts in its own memory.
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
