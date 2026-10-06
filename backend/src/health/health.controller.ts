import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('health')
@Controller('health')
export class HealthController {
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
}
