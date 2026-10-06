import { validateEnv } from './env.validation.js';

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
});
