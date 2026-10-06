import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import request from 'supertest';
import {
  createTestApp,
  TEST_JWT_SECRET,
  TestApp,
} from './utils/create-test-app.js';

const user = {
  name: 'Jane Doe',
  email: 'Jane@Example.com',
  password: 'Passw0rd!',
};
const base64Url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// The sign-in route allows 5 requests a minute, so keep this file under that.
describe('Auth flow (e2e)', () => {
  let testApp: TestApp;
  let userId: string;
  let cookie: string;
  let setCookieHeader: string;
  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('POST /auth/sign-up', () => {
    it('creates the user and never returns the password or the hash', async () => {
      const res = await http().post('/auth/sign-up').send(user).expect(201);

      userId = res.body.id as string;
      expect(res.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        email: 'jane@example.com',
        name: 'Jane Doe',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/pass|hash|argon/i);
    });

    it('rejects the same email in a different case with 409', async () => {
      const res = await http()
        .post('/auth/sign-up')
        .send({ ...user, email: 'JANE@EXAMPLE.COM' })
        .expect(409);

      expect(res.body).toMatchObject({ message: 'Email already registered' });
    });

    it('rejects a weak password with 400 and a readable message', async () => {
      const res = await http()
        .post('/auth/sign-up')
        .send({ ...user, email: 'other@example.com', password: 'weak' })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toMatch(/special character/);
    });
  });

  describe('POST /auth/sign-in', () => {
    it('answers a wrong password and an unknown email identically', async () => {
      const wrong = await http()
        .post('/auth/sign-in')
        .send({ email: user.email, password: 'Wrong#1234' })
        .expect(401);
      const unknown = await http()
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'Wrong#1234' })
        .expect(401);

      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body).toMatchObject({ message: 'Invalid credentials' });
    });

    it('signs in with a mixed-case email and sets a hardened cookie', async () => {
      const res = await http()
        .post('/auth/sign-in')
        .send({ email: ' JANE@example.com ', password: user.password })
        .expect(200);

      expect(res.body).toEqual({
        id: userId,
        email: 'jane@example.com',
        name: 'Jane Doe',
      });

      const cookies = res.headers['set-cookie'] as unknown as string[];
      setCookieHeader = cookies.find((c) => c.startsWith('accessToken='))!;
      cookie = setCookieHeader.split(';')[0];
      const token = cookie.slice('accessToken='.length);

      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
      expect(setCookieHeader).toContain('Path=/');
      expect(setCookieHeader).not.toContain('Secure');
      const maxAge = Number(/Max-Age=(\d+)/.exec(setCookieHeader)?.[1]);
      expect(maxAge).toBeGreaterThan(14 * 60 + 50);
      expect(maxAge).toBeLessThanOrEqual(15 * 60);
      expect(JSON.stringify(res.body)).not.toContain(token);
    });

    it('rejects an object instead of a string (operator injection)', async () => {
      await http()
        .post('/auth/sign-in')
        .send({ email: { $ne: null }, password: { $ne: null } })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the profile for a valid cookie', async () => {
      const res = await http()
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body).toEqual({
        id: userId,
        email: 'jane@example.com',
        name: 'Jane Doe',
      });
    });

    it('rejects a request without a cookie', async () => {
      await http().get('/auth/me').expect(401);
    });

    it('rejects a tampered token', async () => {
      await http()
        .get('/auth/me')
        .set('Cookie', `${cookie.slice(0, -3)}abc`)
        .expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = await new JwtService().signAsync(
        { sub: userId },
        { secret: 'another-secret-that-is-also-32-characters-long' },
      );

      await http()
        .get('/auth/me')
        .set('Cookie', `accessToken=${forged}`)
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = await new JwtService().signAsync(
        { sub: userId },
        { secret: TEST_JWT_SECRET, expiresIn: -10 },
      );

      await http()
        .get('/auth/me')
        .set('Cookie', `accessToken=${expired}`)
        .expect(401);
    });

    it('rejects an unsigned token (alg none)', async () => {
      const unsigned = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: userId })}.`;

      await http()
        .get('/auth/me')
        .set('Cookie', `accessToken=${unsigned}`)
        .expect(401);
    });

    it('rejects a valid token for a user that does not exist', async () => {
      const orphan = await new JwtService().signAsync(
        { sub: new Types.ObjectId().toString() },
        { secret: TEST_JWT_SECRET, expiresIn: '5m' },
      );

      await http()
        .get('/auth/me')
        .set('Cookie', `accessToken=${orphan}`)
        .expect(401);
    });
  });

  describe('POST /auth/sign-out', () => {
    it('clears the cookie', async () => {
      const res = await http().post('/auth/sign-out').expect(204);

      const cleared = (res.headers['set-cookie'] as unknown as string[]).find(
        (c) => c.startsWith('accessToken='),
      )!;
      expect(cleared).toMatch(/^accessToken=;/);
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('SameSite=Strict');
    });
  });
});
