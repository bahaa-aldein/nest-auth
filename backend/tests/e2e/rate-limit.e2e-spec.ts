import request from 'supertest';
import { createTestApp, TestApp } from '../utils/create-test-app.js';

describe('Rate limiting (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('allows 5 sign-in attempts a minute, then answers 429', async () => {
    const attempt = () =>
      http()
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'Wrong#1234' });

    for (let i = 0; i < 5; i++) await attempt().expect(401);

    await attempt().expect(429);
  });

  it('does not throttle the health check', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 110 }, () =>
        http()
          .get('/health')
          .then((res) => res.status),
      ),
    );

    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('does not throttle the readiness check', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 110 }, () =>
        http()
          .get('/health/ready')
          .then((res) => res.status),
      ),
    );

    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('counts the limit per client address behind a proxy', async () => {
    // supertest plays the role of nginx: it sends the client address in X-Forwarded-For.
    const attemptFrom = (ip: string) =>
      http()
        .post('/auth/sign-in')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.com', password: 'Wrong#1234' });

    for (let i = 0; i < 5; i++) await attemptFrom('203.0.113.10').expect(401);

    await attemptFrom('203.0.113.10').expect(429);

    // Another client has its own limit. Without trust proxy it would share the
    // blocked address of nginx and also get 429.
    await attemptFrom('203.0.113.20').expect(401);
  });
});
