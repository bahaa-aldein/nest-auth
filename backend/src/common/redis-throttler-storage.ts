import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';

// Not exported by the package, so taken from the method.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

export const THROTTLER_KEY_PREFIX = 'throttler:';

// One script, so Redis runs the steps together: api copies cannot mix them, and a
// crash cannot leave a counter without an expiry.
const COUNT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return { hits, pttl }
`;

// Only what this class needs from a Redis client, so a test can pass a small fake.
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

// Fixed time window. blockDuration is ignored, because this app never sets it.
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

      // The guard wants seconds, rounded up.
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
