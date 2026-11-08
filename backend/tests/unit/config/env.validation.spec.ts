import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateEnv } from '../../../src/config/env.validation.js';

const valid = {
  MONGODB_URI: 'mongodb://localhost:27017/test',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('validateEnv', () => {
  it('accepts a minimal environment and applies the defaults', () => {
    const env = validateEnv(valid);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_EXPIRES_IN: '15m',
    });
  });

  it('converts PORT to a number', () => {
    expect(validateEnv({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it.each(['900s', '15m', '1h', '7d', '500ms'])(
    'accepts JWT_EXPIRES_IN=%s',
    (JWT_EXPIRES_IN) => {
      expect(validateEnv({ ...valid, JWT_EXPIRES_IN }).JWT_EXPIRES_IN).toBe(
        JWT_EXPIRES_IN,
      );
    },
  );

  it.each(['banana', '15', '0m', '-5m', '', '1.5h', '15 minutes'])(
    'rejects JWT_EXPIRES_IN=%j instead of failing later at sign-in',
    (JWT_EXPIRES_IN) => {
      expect(() => validateEnv({ ...valid, JWT_EXPIRES_IN })).toThrow(
        /JWT_EXPIRES_IN/,
      );
    },
  );

  it.each([
    ['a missing MONGODB_URI', { MONGODB_URI: undefined }, /MONGODB_URI/],
    ['an http MONGODB_URI', { MONGODB_URI: 'http://x' }, /MONGODB_URI/],
    ['a short JWT_SECRET', { JWT_SECRET: 'short' }, /JWT_SECRET/],
    ['a missing JWT_SECRET', { JWT_SECRET: undefined }, /JWT_SECRET/],
    [
      'a CORS_ORIGIN without protocol',
      { CORS_ORIGIN: 'localhost:5173' },
      /CORS_ORIGIN/,
    ],
    ['a missing CORS_ORIGIN', { CORS_ORIGIN: undefined }, /CORS_ORIGIN/],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }, /NODE_ENV/],
    ['a PORT of zero', { PORT: '0' }, /PORT/],
    ['a PORT above 65535', { PORT: '70000' }, /PORT/],
    ['a non-numeric PORT', { PORT: 'abc' }, /PORT/],
  ])('rejects %s', (_label, override, message) => {
    expect(() => validateEnv({ ...valid, ...override })).toThrow(message);
  });

  it('reports every problem at once', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_SECRET: 'short', JWT_EXPIRES_IN: 'banana' }),
    ).toThrow(/JWT_SECRET[\s\S]*JWT_EXPIRES_IN/);
  });

  describe('JWT_SECRET_FILE', () => {
    const secret = 'file-secret-'.padEnd(40, 'f');
    const envSecret = 'env-secret-'.padEnd(40, 'e');
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'env-validation-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    function writeSecretFile(content: string): string {
      const path = join(dir, 'jwt_secret');
      writeFileSync(path, content);
      return path;
    }

    // The secret comes from the file only, as in production.
    function configWithFile(content: string): Record<string, unknown> {
      return {
        ...valid,
        JWT_SECRET: undefined,
        JWT_SECRET_FILE: writeSecretFile(content),
      };
    }

    function thrownBy(config: Record<string, unknown>): Error {
      try {
        validateEnv(config);
      } catch (error) {
        if (error instanceof Error) return error;
        throw error;
      }
      throw new Error('validateEnv did not throw');
    }

    it('reads JWT_SECRET from the file', () => {
      expect(validateEnv(configWithFile(secret)).JWT_SECRET).toBe(secret);
    });

    it.each([
      ['LF', '\n'],
      ['CRLF', '\r\n'],
    ])(
      'removes the %s line break at the end of the file',
      (_name, lineBreak) => {
        const env = validateEnv(configWithFile(secret + lineBreak));

        expect(env.JWT_SECRET).toBe(secret);
      },
    );

    it('removes only the final line break and keeps spaces', () => {
      const padded = `  ${secret}  `;

      const env = validateEnv(configWithFile(`${padded}\n\n`));

      expect(env.JWT_SECRET).toBe(`${padded}\n`);
    });

    it('uses JWT_SECRET when JWT_SECRET_FILE is empty', () => {
      const env = validateEnv({ ...valid, JWT_SECRET_FILE: '' });

      expect(env.JWT_SECRET).toBe(valid.JWT_SECRET);
    });

    it('uses the file when JWT_SECRET is empty, as in .env.example', () => {
      const env = validateEnv({ ...configWithFile(secret), JWT_SECRET: '' });

      expect(env.JWT_SECRET).toBe(secret);
    });

    it('rejects JWT_SECRET and JWT_SECRET_FILE together', () => {
      const config = { ...configWithFile(secret), JWT_SECRET: envSecret };

      expect(() => validateEnv(config)).toThrow(
        /either JWT_SECRET or JWT_SECRET_FILE/,
      );
    });

    it('names the path when the file does not exist', () => {
      const path = join(dir, 'missing');

      expect(() =>
        validateEnv({ ...valid, JWT_SECRET: undefined, JWT_SECRET_FILE: path }),
      ).toThrow(`JWT_SECRET_FILE: cannot read the file at ${path}`);
    });

    it('keeps the system error as the cause, so the log shows why', () => {
      const error = thrownBy({
        ...valid,
        JWT_SECRET: undefined,
        JWT_SECRET_FILE: join(dir, 'missing'),
      });

      expect(error).toMatchObject({ cause: { code: 'ENOENT' } });
    });

    it('rejects a folder instead of a file', () => {
      expect(() =>
        validateEnv({ ...valid, JWT_SECRET: undefined, JWT_SECRET_FILE: dir }),
      ).toThrow(/JWT_SECRET_FILE: cannot read the file/);
    });

    it.each([
      ['an empty file', ''],
      ['a file with only a line break', '\n'],
      ['a file with a short secret', 'short-secret'],
    ])('rejects %s', (_name, content) => {
      expect(() => validateEnv(configWithFile(content))).toThrow(
        /JWT_SECRET must be at least 32 characters/,
      );
    });

    it('does not print a rejected secret from the file', () => {
      const shortSecret = 'leaky-short-secret';

      const { message } = thrownBy(configWithFile(shortSecret));

      expect(message).toMatch(/JWT_SECRET/);
      expect(message).not.toContain(shortSecret);
    });

    it('does not print either secret when both are set', () => {
      const { message } = thrownBy({
        ...configWithFile(secret),
        JWT_SECRET: envSecret,
      });

      expect(message).not.toContain(secret);
      expect(message).not.toContain(envSecret);
    });

    it('does not change the config it receives', () => {
      const config = configWithFile(secret);

      validateEnv(config);

      expect(config.JWT_SECRET).toBeUndefined();
    });
  });

  describe('REDIS_URL', () => {
    it('is optional', () => {
      expect(validateEnv(valid).REDIS_URL).toBeUndefined();
    });

    it.each([
      ['redis://redis:6379'],
      ['rediss://cache.example.com:6380'],
      ['redis://:a-password@redis:6379/1'],
    ])('accepts %s', (REDIS_URL) => {
      expect(validateEnv({ ...valid, REDIS_URL }).REDIS_URL).toBe(REDIS_URL);
    });

    it('counts an empty value as not set', () => {
      expect(
        validateEnv({ ...valid, REDIS_URL: '' }).REDIS_URL,
      ).toBeUndefined();
    });

    it.each([
      'http://redis:6379',
      'redis:6379',
      'localhost',
      'mongodb://redis',
    ])('rejects %s', (REDIS_URL) => {
      expect(() => validateEnv({ ...valid, REDIS_URL })).toThrow(/REDIS_URL/);
    });

    it('never prints the value of a rejected address, which can hold a password', () => {
      let message = '';
      try {
        validateEnv({ ...valid, REDIS_URL: 'http://user:hunter2@redis:6379' });
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }

      expect(message).toMatch(/REDIS_URL/);
      expect(message).not.toContain('hunter2');
    });
  });
});
