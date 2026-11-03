import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Server } from 'node:http';

// How long running requests get to finish after the stop signal. It must stay below
// stop_grace_period in compose.production.yaml (20 seconds): after that, Docker kills
// the process with SIGKILL, which leaves no log and the exit code 137. This timer
// ends a stuck shutdown first, with a log line and the exit code 1.
// It is also longer than the longest normal request, which takes less than a second.
export const SHUTDOWN_FORCE_MS = 15_000;

// Nest stops the HTTP server by itself and waits for the running requests, but it
// writes nothing to the log. This class adds the log lines and the safety timer.
@Injectable()
export class ShutdownService
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownService.name);
  private forceTimer?: NodeJS.Timeout;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  // Nest calls this first. The HTTP server closes right after it, and the readiness
  // route of Terminus already answers 503. The signal is empty when the code calls
  // app.close() itself.
  beforeApplicationShutdown(signal?: string): void {
    this.logger.log(
      `${signal ?? 'A stop request'} received: finishing the running requests, then stopping`,
    );
    this.forceTimer = setTimeout(() => this.forceShutdown(), SHUTDOWN_FORCE_MS);
    // The timer alone must never keep the process alive.
    this.forceTimer.unref();
  }

  // Nest calls this last, after the server, Mongoose and Redis are closed.
  onApplicationShutdown(): void {
    clearTimeout(this.forceTimer);
    this.logger.log('Shutdown complete');
  }

  private forceShutdown(): void {
    this.logger.error(
      `Running requests did not finish within ${SHUTDOWN_FORCE_MS / 1000} seconds: closing all connections`,
    );
    const server: Server = this.httpAdapterHost.httpAdapter.getHttpServer();
    server.closeAllConnections();
    process.exit(1);
  }
}
