import { Logger } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import {
  SHUTDOWN_FORCE_MS,
  ShutdownService,
} from '../../../src/common/shutdown.service.js';

const serviceWith = (closeAllConnections: () => void) =>
  new ShutdownService({
    httpAdapter: { getHttpServer: () => ({ closeAllConnections }) },
  } as unknown as HttpAdapterHost);

describe('ShutdownService', () => {
  let exit: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fake time (no 15 real seconds). A real process.exit would stop the test run.
    vi.useFakeTimers();
    exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('closes every connection and exits with 1 when the shutdown takes too long', () => {
    const closeAllConnections = vi.fn();
    const service = serviceWith(closeAllConnections);

    service.beforeApplicationShutdown('SIGTERM');
    vi.advanceTimersByTime(SHUTDOWN_FORCE_MS);

    expect(closeAllConnections).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('closes the connections before it exits', () => {
    const closeAllConnections = vi.fn();
    const service = serviceWith(closeAllConnections);

    service.beforeApplicationShutdown('SIGTERM');
    vi.advanceTimersByTime(SHUTDOWN_FORCE_MS);

    expect(closeAllConnections.mock.invocationCallOrder[0]).toBeLessThan(
      exit.mock.invocationCallOrder[0],
    );
  });

  it('waits until the limit is reached', () => {
    const closeAllConnections = vi.fn();
    const service = serviceWith(closeAllConnections);

    service.beforeApplicationShutdown('SIGTERM');
    vi.advanceTimersByTime(SHUTDOWN_FORCE_MS - 1);

    expect(closeAllConnections).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('cancels the timer when the shutdown finishes in time', () => {
    const closeAllConnections = vi.fn();
    const service = serviceWith(closeAllConnections);

    service.beforeApplicationShutdown('SIGTERM');
    service.onApplicationShutdown();
    vi.advanceTimersByTime(SHUTDOWN_FORCE_MS * 2);

    expect(closeAllConnections).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('keeps the limit below the grace period that Docker allows', () => {
    // compose.production.yaml sets stop_grace_period to 20 seconds.
    expect(SHUTDOWN_FORCE_MS).toBeLessThan(20_000);
  });

  describe('logging', () => {
    it('names the signal and says that the shutdown is complete', () => {
      const service = serviceWith(vi.fn());

      service.beforeApplicationShutdown('SIGTERM');
      service.onApplicationShutdown();

      expect(log).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SIGTERM received'),
      );
      expect(log).toHaveBeenNthCalledWith(2, 'Shutdown complete');
    });

    it('works when the code stops the app itself, without a signal', () => {
      const service = serviceWith(vi.fn());

      service.beforeApplicationShutdown();

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('A stop request received'),
      );
    });

    it('logs an error with the limit when it has to force the shutdown', () => {
      const service = serviceWith(vi.fn());

      service.beforeApplicationShutdown('SIGTERM');
      vi.advanceTimersByTime(SHUTDOWN_FORCE_MS);

      expect(errorLog).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('within 15 seconds'),
      );
    });

    it('logs no error when the shutdown finishes in time', () => {
      const service = serviceWith(vi.fn());

      service.beforeApplicationShutdown('SIGTERM');
      service.onApplicationShutdown();
      vi.advanceTimersByTime(SHUTDOWN_FORCE_MS);

      expect(errorLog).not.toHaveBeenCalled();
    });
  });
});
