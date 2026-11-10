import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { createTestApp, TestApp } from '../utils/create-test-app.js';

const NOT_CACHEABLE = 'no-cache, no-store, must-revalidate';

describe('Health (e2e)', () => {
  let testApp: TestApp;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('GET /health/ready is 200 while MongoDB is connected', async () => {
    const response = await http().get('/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.headers['cache-control']).toBe(NOT_CACHEABLE);
  });

  it('GET /health/ready is 503 without MongoDB, while /health stays 200', async () => {
    await testApp.app.get<Connection>(getConnectionToken()).close();

    const response = await http().get('/health/ready').expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.error.database.status).toBe('down');
    expect(response.headers['cache-control']).toBe(NOT_CACHEABLE);

    await http().get('/health').expect(200);
  });
});
