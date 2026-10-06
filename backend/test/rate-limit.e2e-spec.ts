import request from 'supertest';
import { createTestApp, TestApp } from './utils/create-test-app.js';

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
});
