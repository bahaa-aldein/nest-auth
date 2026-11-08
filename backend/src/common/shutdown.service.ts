import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Server } from 'node:http';

// Must stay below stop_grace_period in compose.production.yaml (20 s): the kill by
// Docker leaves no log and exit code 137. This timer ends a stuck shutdown first.
export const SHUTDOWN_FORCE_MS = 15_000;

@Injectable()
export class ShutdownService
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownService.name);
  private forceTimer?: NodeJS.Timeout;

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  // The signal is empty when the code calls app.close() itself.
  beforeApplicationShutdown(signal?: string): void {
    this.logger.log(
      `${signal ?? 'A stop request'} received: finishing the running requests, then stopping`,
    );
    this.forceTimer = setTimeout(() => this.forceShutdown(), SHUTDOWN_FORCE_MS);
    // The timer alone must never keep the process alive.
    this.forceTimer.unref();
  }

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
