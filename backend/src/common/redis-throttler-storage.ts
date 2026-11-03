import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

// The package does not export this type from its root, so take it from the method.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

// Every rate-limit counter in Redis starts with this text, so they are easy to find.
export const THROTTLER_KEY_PREFIX = 'throttler:';

// Redis runs the whole script as one step, so two api copies can never mix their work.
// It adds one hit, and it gives the key an expiry when it has none (a new key, or a
// damaged one). The key then disappears when the time window ends. It returns the
// number of hits and the milliseconds left in the window.
const COUNT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return { hits, pttl }
`;

// The only part of a Redis client that this class needs. The Redis class of ioredis
// fits it, and a unit test can pass a small fake object.
export interface ScriptRunner {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

function readCount(answer: unknown): {
  hits: number;
  millisecondsLeft: number;
} {
  if (
    Array.isArray(answer) &&
    answer.length === 2 &&
    typeof answer[0] === 'number' &&
    typeof answer[1] === 'number'
  ) {
    return { hits: answer[0], millisecondsLeft: answer[1] };
  }
  throw new Error('Unexpected answer from the Redis counting script');
}

// Keeps the rate-limit counters in Redis, so all api copies share one count. When Redis
// fails, the fallback storage (the in-memory one) answers, and each copy counts alone.
// It uses a fixed time window and ignores blockDuration, which this app never sets.
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(
    private readonly client: ScriptRunner,
    private readonly fallback: ThrottlerStorage,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const answer = await this.client.eval(
        COUNT_SCRIPT,
        1,
        `${THROTTLER_KEY_PREFIX}${key}`,
        ttl,
      );
      const { hits, millisecondsLeft } = readCount(answer);

      // The guard wants seconds, and a started second counts as a whole one.
      const timeToExpire = Math.ceil(millisecondsLeft / 1000);
      const isBlocked = hits > limit;

      return {
        totalHits: hits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? timeToExpire : 0,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Redis rate limit failed, counting in memory instead: ${reason}`,
      );
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
