import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  Environment,
  type EnvironmentVariables,
} from '../config/env.validation.js';
import { PublicUserDto } from '../users/dto/public-user.dto.js';
import { PublicUser } from '../users/users.types.js';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from './auth-cookie.js';
import { AuthService } from './auth.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.cookieOptions = accessTokenCookieOptions(
      config.get('NODE_ENV', { infer: true }) === Environment.Production,
    );
  }

  @ApiOperation({ summary: 'Create a new user account' })
  @ApiCreatedResponse({ type: PublicUserDto })
  @ApiBadRequestResponse({ description: 'Invalid or unknown fields' })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto): Promise<PublicUser> {
    return this.authService.signUp(dto);
  }

  @ApiOperation({ summary: 'Sign in and set the access token cookie' })
  @ApiOkResponse({ type: PublicUserDto })
  @ApiBadRequestResponse({ description: 'Invalid or unknown fields' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, accessToken, expiresAt } = await this.authService.signIn(dto);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.cookieOptions,
      maxAge: Math.max(expiresAt.getTime() - Date.now(), 0),
    });
    return user;
  }

  @ApiOperation({ summary: 'Clear the access token cookie' })
  @ApiNoContentResponse()
  @Post('sign-out')
  @HttpCode(204)
  signOut(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions);
  }

  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Get the signed-in user profile' })
  @ApiOkResponse({ type: PublicUserDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser('id') userId: string): Promise<PublicUser> {
    return this.authService.getProfile(userId);
  }
}
