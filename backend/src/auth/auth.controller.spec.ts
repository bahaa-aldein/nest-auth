import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createValidationPipe } from '../app.setup.js';
import { UsersService } from '../users/users.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Correct#1234';

describe('Auth flow (mocked users)', () => {
  let app: INestApplication;
  let user: { id: string; email: string; name: string; passwordHash: string };

  beforeAll(async () => {
    user = {
      id: '64b7f0f4f4f4f4f4f4f4f4f4',
      email: 'jane@example.com',
      name: 'Jane',
      passwordHash: await argon2.hash(PASSWORD),
    };
    const usersService = {
      findByEmail: async (email: string) =>
        email === user.email ? user : null,
      findById: async (id: string) => (id === user.id ? user : null),
      create: async (i: { email: string; name: string }) => ({
        id: 'new',
        email: i.email,
        name: i.name,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'x'.repeat(32),
          signOptions: { algorithm: 'HS256', expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: { get: () => 'test' } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(() => app.close());

  const server = () => app.getHttpServer();

  it('rejects a wrong password', async () => {
    await request(server())
      .post('/auth/sign-in')
      .send({ email: user.email, password: 'WRONG#1234' })
      .expect(401);
  });

  it('rejects an unknown email with the same status and body', async () => {
    const wrong = await request(server())
      .post('/auth/sign-in')
      .send({ email: user.email, password: 'WRONG#1234' })
      .expect(401);
    const unknown = await request(server())
      .post('/auth/sign-in')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);

    expect(unknown.body).toEqual(wrong.body);
  });

  it('signs in, sets an httpOnly cookie, and /me works with it', async () => {
    const res = await request(server())
      .post('/auth/sign-in')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);

    expect(res.body).toEqual({ id: user.id, email: user.email, name: 'Jane' });
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toMatch(/Max-Age=\d+/);

    await request(server()).get('/auth/me').set('Cookie', cookie).expect(200);
  });

  it('blocks /me without a cookie', async () => {
    await request(server()).get('/auth/me').expect(401);
  });

  it('validates sign-up input', async () => {
    await request(server())
      .post('/auth/sign-up')
      .send({ email: 'a@b.co', name: 'Jo', password: 'weak' })
      .expect(400);
    await request(server())
      .post('/auth/sign-up')
      .send({ email: 'a@b.co', name: 'Joe', password: PASSWORD })
      .expect(201);
  });
});
