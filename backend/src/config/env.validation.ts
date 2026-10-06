import 'reflect-metadata';
import type { JwtSignOptions } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

// The unit is required: a bare number would be read as milliseconds.
const JWT_EXPIRES_IN_PATTERN = /^[1-9]\d*(ms|s|m|h|d|w|y)$/;

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  })
  MONGODB_URI: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @Matches(JWT_EXPIRES_IN_PATTERN, {
    message:
      'JWT_EXPIRES_IN must be a number with a unit, for example 900s, 15m, 1h or 7d',
  })
  JWT_EXPIRES_IN: JwtExpiresIn = '15m';

  @IsUrl({ require_tld: false, require_protocol: true })
  CORS_ORIGIN: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  return validated;
}
