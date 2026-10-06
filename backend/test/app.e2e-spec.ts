import request from 'supertest';
import {
  createTestApp,
  TEST_ORIGIN,
  TestApp,
} from './utils/create-test-app.js';

describe('App bootstrap (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /health responds with ok', async () => {
    await http().get('/health').expect(200).expect({ status: 'ok' });
  });

  it('uses the global exception filter for HTTP errors', async () => {
    await http().get('/missing').expect(404).expect({
      statusCode: 404,
      message: 'Cannot GET /missing',
      error: 'Not Found',
    });
  });

  it('sets security headers, including a CSP, and hides the framework', async () => {
    const response = await http().get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
  });

  it('allows credentialed requests from the configured origin', async () => {
    const response = await http().get('/health').set('Origin', TEST_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('never grants another origin, nor a wildcard, access', async () => {
    // A single configured origin is always echoed back; the browser blocks every other site.
    const response = await http()
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(response.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  describe('API docs', () => {
    it('serves Swagger UI with the relaxed CSP only on /docs', async () => {
      const docs = await http().get('/docs').expect(200);

      expect(docs.headers['content-security-policy']).toBeUndefined();
    });

    it('documents sign-up as 201 with its error responses', async () => {
      const { body } = await http().get('/docs-json').expect(200);

      expect(Object.keys(body.paths['/auth/sign-up'].post.responses)).toEqual(
        expect.arrayContaining(['201', '400', '409', '429']),
      );
      expect(body.components.securitySchemes).toHaveProperty('accessToken');
    });
  });
});
