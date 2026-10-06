import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.js';
import type { JwtPayload } from './authenticated-user.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Not authenticated');

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
      req.user = { id: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
