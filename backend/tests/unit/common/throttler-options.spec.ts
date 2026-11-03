import { Logger } from '@nestjs/common';
import { RedisThrottlerStorage } from '../../../src/common/redis-throttler-storage.js';
import {
  createThrottlerOptions,
  FAIL_FAST_REDIS_OPTIONS,
} from '../../../src/common/throttler-options.js';

// The module options have two shapes (a list, or an object). This app always uses the object.
const asObject = (options: ReturnType<typeof createThrottlerOptions>) => {
  if (Array.isArray(options)) throw new Error('Expected the object form');
  return options;
};

describe('createThrottlerOptions', () => {
  beforeEach(() => {
    // The function logs which storage it uses. Keep the test output quiet.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the default limit of 100 requests a minute', () => {
    const options = asObject(createThrottlerOptions(undefined));

    expect(options.throttlers).toEqual([{ ttl: 60_000, limit: 100 }]);
  });

  it('uses the default in-memory storage without a Redis address', () => {
    const connect = vi.fn();

    const options = asObject(createThrottlerOptions(undefined, connect));

    expect(options.storage).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects to the given address and stores the counters in Redis', () => {
    const connect = vi.fn().mockReturnValue({ eval: vi.fn() });

    const options = asObject(
      createThrottlerOptions('redis://redis:6379', connect),
    );

    expect(connect).toHaveBeenCalledExactlyOnceWith('redis://redis:6379');
    expect(options.storage).toBeInstanceOf(RedisThrottlerStorage);
    expect(options.throttlers).toEqual([{ ttl: 60_000, limit: 100 }]);
  });

  it('counts in memory when the Redis client fails', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const connect = () => ({
      eval: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    });
    const { storage } = asObject(
      createThrottlerOptions('redis://redis:6379', connect),
    );

    const record = await storage?.increment(
      'key',
      60_000,
      5,
      60_000,
      'default',
    );

    expect(record).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('makes the Redis client fail fast instead of waiting', () => {
    expect(FAIL_FAST_REDIS_OPTIONS.enableOfflineQueue).toBe(false);
    expect(FAIL_FAST_REDIS_OPTIONS.commandTimeout).toBeLessThanOrEqual(1_000);
    expect(FAIL_FAST_REDIS_OPTIONS.maxRetriesPerRequest).toBeLessThanOrEqual(1);
  });
});
