import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../app.setup.js';
import { SignUpDto } from './sign-up.dto.js';

const pipe = createValidationPipe();
const parse = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: SignUpDto });

const valid = { email: 'jane@example.com', name: 'Jane', password: 'abcdef1!' };

describe('SignUpDto', () => {
  it('accepts a valid body and normalises email and name', async () => {
    const result = await parse({
      ...valid,
      email: '  Jane@Example.COM ',
      name: '  Jane  ',
    });

    expect(result).toMatchObject({ email: 'jane@example.com', name: 'Jane' });
  });

  it('does not alter the password', async () => {
    const result = (await parse({ ...valid, password: ' abc123! ' })) as {
      password: string;
    };

    expect(result.password).toBe(' abc123! ');
  });

  it.each(['not-an-email', 'a@', '@example.com', ''])(
    'rejects the invalid email %j',
    async (email) => {
      await expect(parse({ ...valid, email })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each(['', 'ab', '   ', ' a '])(
    'rejects the short name %j',
    async (name) => {
      await expect(parse({ ...valid, name })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([
    ['too short', 'abc12!'],
    ['no letter', '1234567!'],
    ['no number', 'abcdefg!'],
    ['no special character', 'abcdefg1'],
    ['only whitespace as the special character', 'abcdefg1 '],
    ['longer than 128 characters', `a1!${'x'.repeat(126)}`],
  ])('rejects a password that is %s', async (_reason, password) => {
    await expect(parse({ ...valid, password })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['abcdef1!', 'Passw0rd#', 'a1!aaaaa', 'كلمةسر1!', 'p@ss w0rd'])(
    'accepts the password %j',
    async (password) => {
      await expect(parse({ ...valid, password })).resolves.toBeDefined();
    },
  );

  it.each([
    ['email', { $ne: null }],
    ['name', { $gt: '' }],
    ['password', { $ne: null }],
  ])('rejects an object in %s (operator injection)', async (field, payload) => {
    await expect(parse({ ...valid, [field]: payload })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown properties instead of passing them through', async () => {
    await expect(parse({ ...valid, isAdmin: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
