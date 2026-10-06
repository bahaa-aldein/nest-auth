import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Correct#1234';
const WRONG_PASSWORD = 'Wrong#1234';

describe('AuthService', () => {
  const stored = {
    id: '64b7f0f4f4f4f4f4f4f4f4f4',
    email: 'jane@example.com',
    name: 'Jane',
    passwordHash: '',
  };
  const usersService = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
  };
  const jwtService = new JwtService({
    secret: 'x'.repeat(32),
    signOptions: { algorithm: 'HS256', expiresIn: '15m' },
  });
  let service: AuthService;

  beforeAll(async () => {
    stored.passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(() => {
    usersService.create.mockImplementation(
      async (input: { email: string; name: string }) => ({
        id: 'new-id',
        email: input.email,
        name: input.name,
      }),
    );
    usersService.findByEmail.mockImplementation(async (email: string) =>
      email === stored.email ? stored : null,
    );
    usersService.findById.mockImplementation(async (id: string) =>
      id === stored.id
        ? { id: stored.id, email: stored.email, name: stored.name }
        : null,
    );
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  describe('signUp', () => {
    it('stores an argon2 hash and never the plaintext password', async () => {
      await service.signUp({
        email: 'new@example.com',
        name: 'New User',
        password: PASSWORD,
      });

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const input = usersService.create.mock.calls[0][0] as {
        passwordHash: string;
      };
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New User',
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
      });
      expect(input.passwordHash).not.toContain(PASSWORD);
      await expect(argon2.verify(input.passwordHash, PASSWORD)).resolves.toBe(
        true,
      );
    });

    it('uses a different salt for every hash', async () => {
      const dto = { email: 'a@example.com', name: 'Abc', password: PASSWORD };
      await service.signUp(dto);
      await service.signUp(dto);

      const [first, second] = usersService.create.mock.calls.map(
        (call) => (call[0] as { passwordHash: string }).passwordHash,
      );
      expect(first).not.toBe(second);
    });
  });

  describe('signIn', () => {
    it('returns the public user, a token and its expiry', async () => {
      const before = Date.now();
      const result = await service.signIn({
        email: stored.email,
        password: PASSWORD,
      });

      expect(result.user).toEqual({
        id: stored.id,
        email: stored.email,
        name: stored.name,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      const fifteenMinutes = 15 * 60 * 1000;
      expect(result.expiresAt.getTime()).toBeGreaterThan(
        before + fifteenMinutes - 5_000,
      );
      expect(result.expiresAt.getTime()).toBeLessThan(
        Date.now() + fifteenMinutes + 5_000,
      );
    });

    it('signs a token whose only claim is the user id', async () => {
      const { accessToken } = await service.signIn({
        email: stored.email,
        password: PASSWORD,
      });

      const payload = jwtService.decode<Record<string, unknown>>(accessToken);
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(payload.sub).toBe(stored.id);
    });

    it('rejects a wrong password', async () => {
      await expect(
        service.signIn({ email: stored.email, password: WRONG_PASSWORD }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('rejects an unknown email exactly like a wrong password', async () => {
      const wrong = await service
        .signIn({ email: stored.email, password: WRONG_PASSWORD })
        .catch((error: unknown) => error);
      const unknown = await service
        .signIn({ email: 'nobody@example.com', password: WRONG_PASSWORD })
        .catch((error: unknown) => error);

      expect(unknown).toBeInstanceOf(UnauthorizedException);
      expect((unknown as UnauthorizedException).getResponse()).toEqual(
        (wrong as UnauthorizedException).getResponse(),
      );
    });

    it('verifies a hash exactly once for an unknown email, so timing matches', async () => {
      const verify = vi.spyOn(argon2, 'verify');

      await service
        .signIn({ email: 'nobody@example.com', password: WRONG_PASSWORD })
        .catch(() => undefined);

      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('verifies a hash exactly once for a wrong password too', async () => {
      const verify = vi.spyOn(argon2, 'verify');

      await service
        .signIn({ email: stored.email, password: WRONG_PASSWORD })
        .catch(() => undefined);

      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('never signs in an unknown email, even with the dummy password', async () => {
      await expect(
        service.signIn({
          email: 'nobody@example.com',
          password: 'dummy-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('returns the public user', async () => {
      await expect(service.getProfile(stored.id)).resolves.toEqual({
        id: stored.id,
        email: stored.email,
        name: stored.name,
      });
    });

    it('rejects a user that no longer exists', async () => {
      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
