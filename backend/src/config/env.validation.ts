import 'reflect-metadata';
import type { JwtSignOptions } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  type ValidationError,
} from 'class-validator';
import { readFileSync } from 'node:fs';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;
type RawConfig = Record<string, unknown>;

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

  @IsString()
  @IsOptional()
  JWT_SECRET_FILE?: string;

  @Matches(JWT_EXPIRES_IN_PATTERN, {
    message:
      'JWT_EXPIRES_IN must be a number with a unit, for example 900s, 15m, 1h or 7d',
  })
  JWT_EXPIRES_IN: JwtExpiresIn = '15m';

  @IsUrl({ require_tld: false, require_protocol: true })
  CORS_ORIGIN: string;
}

export function validateEnv(config: RawConfig): EnvironmentVariables {
  return validateConfig(withJwtSecretFromFile(config));
}

function withJwtSecretFromFile(config: RawConfig): RawConfig {
  const secretFilePath = config.JWT_SECRET_FILE;
  if (typeof secretFilePath !== 'string' || secretFilePath === '') {
    return config;
  }

  if (config.JWT_SECRET) {
    throw new Error('Set either JWT_SECRET or JWT_SECRET_FILE, not both');
  }

  return { ...config, JWT_SECRET: readJwtSecretFile(secretFilePath) };
}

function readJwtSecretFile(path: string): string {
  try {
    const fileContent = readFileSync(path, 'utf8');
    return fileContent.replace(/\r?\n$/, '');
  } catch (error) {
    throw new Error(`JWT_SECRET_FILE: cannot read the file at ${path}`, {
      cause: error,
    });
  }
}

function validateConfig(config: RawConfig): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated);

  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors));
  }

  return validated;
}

function formatValidationErrors(errors: ValidationError[]): string {
  const details = errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .join('\n  - ');
  return `Invalid environment configuration:\n  - ${details}`;
}
