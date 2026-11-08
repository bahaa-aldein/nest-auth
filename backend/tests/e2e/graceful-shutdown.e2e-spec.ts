import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { createTestApp, TestApp } from '../utils/create-test-app.js';

const connectOnce = (port: number) =>
  new Promise<void>((resolve, reject) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
  });

describe('Graceful shutdown (e2e)', () => {
  let testApp: TestApp;
  let port: number;
  let stopped = false;

  beforeAll(async () => {
    testApp = await createTestApp();
    await testApp.app.listen(0);
    port = (testApp.app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    if (!stopped) await testApp.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finishes a running request before it stops, and refuses new connections', async () => {
    const logs: string[] = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });

    // A request that is still running when the shutdown starts: only the first part
    // of its body is sent.
    const body = JSON.stringify({
      email: 'slow@example.com',
      password: 'Wrong#1234',
    });
    // A fixed wait fails when connecting is slow, so wait for the request itself.
    const requestStarted = new Promise<void>((resolve) => {
      (testApp.app.getHttpServer() as http.Server).once('request', () =>
        resolve(),
      );
    });
    const answer = new Promise<number>((resolve, reject) => {
      const request = http.request(
        {
          port,
          // No keep-alive, like nginx: an open connection would make the server wait.
          agent: false,
          method: 'POST',
          path: '/auth/sign-in',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode ?? 0));
        },
      );
      request.on('error', reject);
      request.write(body.slice(0, 10));
      setTimeout(() => request.end(body.slice(10)), 600);
    });
    await requestStarted;

    let finished = false;
    const stopping = testApp.close().then(() => {
      finished = true;
      stopped = true;
    });

    await vi.waitFor(async () => {
      await expect(connectOnce(port)).rejects.toMatchObject({
        code: 'ECONNREFUSED',
      });
    });
    expect(finished).toBe(false);

    expect(await answer).toBe(401);
    await stopping;
    expect(finished).toBe(true);

    const received = logs.findIndex((line) => line.includes('received'));
    const complete = logs.indexOf('Shutdown complete');
    expect(received).toBeGreaterThanOrEqual(0);
    expect(complete).toBeGreaterThan(received);
  });
});
