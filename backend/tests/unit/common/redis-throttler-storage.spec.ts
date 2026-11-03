import { Logger } from '@nestjs/common';
import {
  RedisThrottlerStorage,
  THROTTLER_KEY_PREFIX,
} from '../../../src/common/redis-throttler-storage.js';

// A fake Redis client. Its eval answers like the counting script does:
// [number of hits, milliseconds left in the time window].
const clientAnswering = (answer: unknown) => ({
  eval: vi.fn().mockResolvedValue(answer),
});

const unreachableClient = () => ({
  eval: vi
    .fn()
    .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379')),
});

const memoryRecord = {
  totalHits: 1,
  timeToExpire: 60,
  isBlocked: false,
  timeToBlockExpire: 0,
};

const fallbackStorage = () => ({
  increment: vi.fn().mockResolvedValue(memoryRecord),
});

// One request for the key "abc": a window of 60 seconds and a limit of 5 hits.
const hit = (storage: RedisThrottlerStorage) =>
  storage.increment('abc', 60_000, 5, 60_000, 'default');

describe('RedisThrottlerStorage (with a fake Redis client)', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The fallback tests log an error on purpose. Keep the test output quiet.
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets a hit below the limit through and rounds the time up to seconds', async () => {
    const storage = new RedisThrottlerStorage(
      clientAnswering([3, 42_500]),
      fallbackStorage(),
    );

    expect(await hit(storage)).toEqual({
      totalHits: 3,
      timeToExpire: 43,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('lets the hit exactly at the limit through', async () => {
    const storage = new RedisThrottlerStorage(
      clientAnswering([5, 30_000]),
      fallbackStorage(),
    );

    expect(await hit(storage)).toMatchObject({
      totalHits: 5,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('blocks the hit over the limit and says how many seconds to wait', async () => {
    const storage = new RedisThrottlerStorage(
      clientAnswering([6, 20_000]),
      fallbackStorage(),
    );

    expect(await hit(storage)).toEqual({
      totalHits: 6,
      timeToExpire: 20,
      isBlocked: true,
      timeToBlockExpire: 20,
    });
  });

  it.each([
    [1, 1],
    [999, 1],
    [1000, 1],
    [1001, 2],
    [59_001, 60],
  ])(
    'turns %i milliseconds into %i seconds, rounding up',
    async (milliseconds, seconds) => {
      const storage = new RedisThrottlerStorage(
        clientAnswering([1, milliseconds]),
        fallbackStorage(),
      );

      expect((await hit(storage)).timeToExpire).toBe(seconds);
    },
  );

  it('asks Redis with the prefixed key and the window in milliseconds', async () => {
    const client = clientAnswering([1, 60_000]);
    const storage = new RedisThrottlerStorage(client, fallbackStorage());

    await hit(storage);

    expect(client.eval).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("redis.call('INCR'"),
      1,
      `${THROTTLER_KEY_PREFIX}abc`,
      60_000,
    );
  });

  it('does not use the fallback while Redis works', async () => {
    const fallback = fallbackStorage();
    const storage = new RedisThrottlerStorage(
      clientAnswering([1, 60_000]),
      fallback,
    );

    await hit(storage);

    expect(fallback.increment).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  describe('when Redis cannot count', () => {
    it('asks the fallback with the same arguments, returns its answer and logs the error', async () => {
      const fallback = fallbackStorage();
      const storage = new RedisThrottlerStorage(unreachableClient(), fallback);

      const record = await hit(storage);

      expect(record).toBe(memoryRecord);
      expect(fallback.increment).toHaveBeenCalledExactlyOnceWith(
        'abc',
        60_000,
        5,
        60_000,
        'default',
      );
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED'),
      );
    });

    it.each([
      ['a text', 'OK'],
      ['nothing', null],
      ['one number', [1]],
      ['a text in the list', [1, '60000']],
      ['three numbers', [1, 60_000, 7]],
    ])(
      'asks the fallback when the script answers %s',
      async (_label, answer) => {
        const fallback = fallbackStorage();
        const storage = new RedisThrottlerStorage(
          clientAnswering(answer),
          fallback,
        );

        expect(await hit(storage)).toBe(memoryRecord);
      },
    );
  });
});
