import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import { createTestApp, TestApp } from '../utils/create-test-app.js';

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Opens one connection and closes it again. It fails when nothing listens on the port.
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
    // Only needed when the test fails before it stops the app itself.
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

    // A request that is still running: the headers and the first part of the body
    // arrive at once, and the rest arrives 600 milliseconds later.
    const body = JSON.stringify({
      email: 'slow@example.com',
      password: 'Wrong#1234',
    });
    const answer = new Promise<number>((resolve, reject) => {
      const request = http.request(
        {
          port,
          // No keep-alive, like nginx towards the api: a connection that stays open
          // would make the server wait for it after the answer.
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
    await wait(200);

    // The shutdown starts while the request is running.
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
