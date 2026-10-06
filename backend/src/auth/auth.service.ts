import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import { PublicUser } from '../users/users.types.js';
import type { JwtPayload } from './authenticated-user.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';

export interface SignInResult {
  user: PublicUser;
  accessToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  // Verified for unknown emails too, so response time does not reveal which emails exist.
  private readonly dummyHash = argon2.hash('dummy-password');

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto): Promise<PublicUser> {
    const passwordHash = await argon2.hash(dto.password);
    return this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
  }

  async signIn(dto: SignInDto): Promise<SignInResult> {
    const found = await this.usersService.findByEmail(dto.email);
    const hash = found?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(hash, dto.password);

    if (!found || !valid)
      throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = { sub: found.id };
    const accessToken = await this.jwtService.signAsync(payload);
    const { exp } = this.jwtService.decode<{ exp: number }>(accessToken);

    return {
      user: { id: found.id, email: found.email, name: found.name },
      accessToken,
      expiresAt: new Date(exp * 1000),
    };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Not authenticated');
    return user;
  }
}
