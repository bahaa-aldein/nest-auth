import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import {
  RedisThrottlerStorage,
  THROTTLER_KEY_PREFIX,
} from '../../../src/common/redis-throttler-storage.js';

// These tests need a real Redis. Start one and set REDIS_URL, for example
// redis://127.0.0.1:6379. Without REDIS_URL they are skipped, so `npm test` and the
// Docker test stage do not need Redis.
const REDIS_URL = process.env.REDIS_URL;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe.skipIf(!REDIS_URL)('RedisThrottlerStorage with a real Redis', () => {
  const clients: Redis[] = [];
  const usedKeys: string[] = [];

  // Each api copy has its own connection to Redis, so tests can play two copies.
  const connect = () => {
    const client = new Redis(REDIS_URL as string);
    clients.push(client);
    return client;
  };

  const storageOn = (client: Redis) =>
    new RedisThrottlerStorage(client, new ThrottlerStorageService());

  // A new key for every test, so no test sees the hits of another one.
  const newKey = () => {
    const key = `test-${randomUUID()}`;
    usedKeys.push(key);
    return key;
  };

  let client: Redis;
  let storage: RedisThrottlerStorage;

  beforeAll(() => {
    client = connect();
    storage = storageOn(client);
  });

  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // The storage logs an error when it falls back to memory. A fallback can hide a
    // broken Redis path (the test would still pass), so no test may log one, except
    // the last test, which causes it on purpose and clears the log itself.
    expect(errorLog).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (usedKeys.length > 0) {
      await client.del(...usedKeys.map((key) => THROTTLER_KEY_PREFIX + key));
    }
    await Promise.all(clients.map((connection) => connection.quit()));
  });

  it('counts hits and blocks the sixth one when the limit is 5', async () => {
    const key = newKey();
    const hit = () => storage.increment(key, 60_000, 5, 60_000, 'default');

    for (let expected = 1; expected <= 5; expected++) {
      expect(await hit()).toMatchObject({
        totalHits: expected,
        isBlocked: false,
      });
    }

    const blocked = await hit();

    expect(blocked).toMatchObject({ totalHits: 6, isBlocked: true });
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('reports the seconds left in the window', async () => {
    const record = await storage.increment(
      newKey(),
      60_000,
      5,
      60_000,
      'default',
    );

    expect(record.timeToExpire).toBeGreaterThan(0);
    expect(record.timeToExpire).toBeLessThanOrEqual(60);
  });

  it('starts a new window when the time is over', async () => {
    const key = newKey();
    const hit = () => storage.increment(key, 300, 5, 300, 'default');

    await hit();
    await hit();
    expect((await hit()).totalHits).toBe(3);

    await wait(450);

    expect((await hit()).totalHits).toBe(1);
  });

  it('gives the key an expiry that is not longer than the window', async () => {
    const key = newKey();

    await storage.increment(key, 60_000, 5, 60_000, 'default');

    const millisecondsLeft = await client.pttl(THROTTLER_KEY_PREFIX + key);
    expect(millisecondsLeft).toBeGreaterThan(0);
    expect(millisecondsLeft).toBeLessThanOrEqual(60_000);
  });

  it('repairs a key that has no expiry', async () => {
    const key = newKey();
    await client.set(THROTTLER_KEY_PREFIX + key, '9');
    expect(await client.pttl(THROTTLER_KEY_PREFIX + key)).toBe(-1);

    const record = await storage.increment(key, 60_000, 5, 60_000, 'default');

    expect(record.totalHits).toBe(10);
    expect(await client.pttl(THROTTLER_KEY_PREFIX + key)).toBeGreaterThan(0);
  });

  it('counts exactly when many hits arrive at the same time', async () => {
    const key = newKey();

    const records = await Promise.all(
      Array.from({ length: 20 }, () =>
        storage.increment(key, 60_000, 100, 60_000, 'default'),
      ),
    );

    const totals = records
      .map((record) => record.totalHits)
      .sort((a, b) => a - b);
    expect(totals).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });

  it('shares one count between two api copies', async () => {
    const key = newKey();
    const copyA = storageOn(connect());
    const copyB = storageOn(connect());
    const hitOn = (copy: RedisThrottlerStorage) =>
      copy.increment(key, 60_000, 5, 60_000, 'default');

    await hitOn(copyA);
    await hitOn(copyA);
    await hitOn(copyA);
    await hitOn(copyB);
    const fifth = await hitOn(copyB);
    const sixth = await hitOn(copyB);

    expect(fifth).toMatchObject({ totalHits: 5, isBlocked: false });
    expect(sixth).toMatchObject({ totalHits: 6, isBlocked: true });
  });

  it('counts in memory when the Redis server cannot be reached', async () => {
    // Nothing listens on port 1. Without the offline queue, a command fails at once.
    const unreachable = new Redis({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    const alone = new RedisThrottlerStorage(
      unreachable,
      new ThrottlerStorageService(),
    );
    const key = newKey();

    const first = await alone.increment(key, 60_000, 1, 60_000, 'default');
    const second = await alone.increment(key, 60_000, 1, 60_000, 'default');

    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(second.isBlocked).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockClear();
    unreachable.disconnect();
  });
});
