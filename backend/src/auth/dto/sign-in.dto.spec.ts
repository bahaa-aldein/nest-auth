import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../app.setup.js';
import { SignInDto } from './sign-in.dto.js';

const pipe = createValidationPipe();
const parse = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: SignInDto });

describe('SignInDto', () => {
  it('normalises the email', async () => {
    const result = await parse({ email: ' Jane@Example.COM ', password: 'x' });

    expect(result).toMatchObject({ email: 'jane@example.com' });
  });

  it('accepts a password that would fail the sign-up policy', async () => {
    await expect(
      parse({ email: 'jane@example.com', password: 'weak' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['empty', ''],
    ['not a string', { $ne: null }],
    ['longer than 128 characters', 'x'.repeat(129)],
  ])('rejects a password that is %s', async (_reason, password) => {
    await expect(
      parse({ email: 'jane@example.com', password }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['not-an-email', { $ne: null }])(
    'rejects the invalid email %j',
    async (email) => {
      await expect(parse({ email, password: 'x' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});
