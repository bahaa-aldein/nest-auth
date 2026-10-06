import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { signInSchema, signUpSchema } from './schemas';

const valid = { name: 'Jane Doe', email: 'jane@example.com', password: 'Passw0rd!' };

const firstMessage = (input: unknown, schema: ZodType = signUpSchema) => {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
};

describe('signUpSchema', () => {
  it('accepts valid input and trims name and email', () => {
    const result = signUpSchema.parse({ ...valid, name: '  Jane  ', email: ' jane@example.com ' });
    expect(result).toMatchObject({ name: 'Jane', email: 'jane@example.com' });
  });

  it.each([
    ['name too short', { ...valid, name: ' Jo ' }, 'Name must be at least 3 characters'],
    ['empty email', { ...valid, email: '' }, 'Email is required'],
    ['bad email', { ...valid, email: 'jane@example' }, 'Enter a valid email address'],
    ['short password', { ...valid, password: 'Ab1!' }, 'Password must be at least 8 characters'],
    ['no letter', { ...valid, password: '12345678!' }, 'Password must contain a letter'],
    ['no number', { ...valid, password: 'Password!' }, 'Password must contain a number'],
    [
      'no special',
      { ...valid, password: 'Password1' },
      'Password must contain a special character',
    ],
    [
      'space only',
      { ...valid, password: 'Pass word1' },
      'Password must contain a special character',
    ],
    [
      'too long',
      { ...valid, password: `Aa1!${'x'.repeat(125)}` },
      'Password must be at most 128 characters',
    ],
  ])('rejects %s', (_label, input, message) => {
    expect(firstMessage(input)).toBe(message);
  });

  it('accepts non-latin letters', () => {
    expect(signUpSchema.safeParse({ ...valid, password: 'пароль1!x' }).success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('only requires a valid email and a non-empty password', () => {
    expect(signInSchema.safeParse({ email: 'jane@example.com', password: 'x' }).success).toBe(true);
    expect(firstMessage({ email: 'jane@example.com', password: '' }, signInSchema)).toBe(
      'Password is required',
    );
    expect(firstMessage({ email: 'nope', password: 'x' }, signInSchema)).toBe(
      'Enter a valid email address',
    );
  });
});
