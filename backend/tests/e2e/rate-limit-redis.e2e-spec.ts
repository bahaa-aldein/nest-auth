import { randomInt } from 'node:crypto';
import { Redis } from 'ioredis';
import request from 'supertest';
import { createTestApp, TestApp } from '../utils/create-test-app.js';

// Needs a real Redis: set REDIS_URL, or the tests are skipped.
const REDIS_URL = process.env.REDIS_URL;

describe.skipIf(!REDIS_URL)('Rate limiting with Redis (e2e)', () => {
  let checker: Redis;
  let copyA: TestApp;
  let copyB: TestApp;
  let copyBStopped = false;
  let keysBefore: string[];

  // Two apps play two api copies. A random client address keeps the counters of an
  // earlier run out of the way.
  const clientAddress = `203.0.113.${randomInt(1, 255)}`;

  const signInThrough = (copy: TestApp) =>
    request(copy.app.getHttpServer())
      .post('/auth/sign-in')
      .set('X-Forwarded-For', clientAddress)
      .send({ email: 'nobody@example.com', password: 'Wrong#1234' });

  const newCounterKeys = async () =>
    (await checker.keys('throttler:*')).filter(
      (key) => !keysBefore.includes(key),
    );

  const connectedClients = async () =>
    Number(/connected_clients:(\d+)/.exec(await checker.info('clients'))?.[1]);

  beforeAll(async () => {
    checker = new Redis(REDIS_URL as string);
    keysBefore = await checker.keys('throttler:*');
    copyA = await createTestApp({ redisUrl: REDIS_URL });
    copyB = await createTestApp({ redisUrl: REDIS_URL });
  });

  afterAll(async () => {
    // Both apps use the database of the first one, so close the second one first.
    if (!copyBStopped) await copyB.close();
    await copyA.close();
    const created = await newCounterKeys();
    if (created.length > 0) await checker.del(...created);
    await checker.quit();
  });

  it('shares one rate limit between two api copies', async () => {
    for (let i = 0; i < 3; i++) await signInThrough(copyA).expect(401);
    for (let i = 0; i < 2; i++) await signInThrough(copyB).expect(401);

    await signInThrough(copyB).expect(429);
    await signInThrough(copyA).expect(429);
  });

  it('keeps the counter in Redis, with an expiry', async () => {
    const created = await newCounterKeys();

    expect(created).toHaveLength(1);
    const millisecondsLeft = await checker.pttl(created[0]);
    expect(millisecondsLeft).toBeGreaterThan(0);
    expect(millisecondsLeft).toBeLessThanOrEqual(60_000);
  });

  it('closes its connection to Redis when an api copy stops', async () => {
    const before = await connectedClients();

    await copyB.close();
    copyBStopped = true;

    await vi.waitFor(async () => {
      expect(await connectedClients()).toBeLessThan(before);
    });
  });
});
