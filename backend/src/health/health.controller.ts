import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

// How long MongoDB may take to answer the ping before this copy reports "not ready".
const MONGODB_PING_TIMEOUT_MS = 1500;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  @ApiOperation({ summary: 'Check API health' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok' },
      properties: {
        status: { enum: ['ok'], type: 'string' },
      },
      type: 'object',
    },
  })
  @SkipThrottle()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Check that this copy can serve traffic',
    description:
      'Answers 503 when MongoDB is not connected or the shutdown has started. GET /health only says that the process is alive.',
  })
  @SkipThrottle()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () =>
        this.mongoose
          .pingCheck('database')
          .withTimeout(MONGODB_PING_TIMEOUT_MS),
    ]);
  }
}
