import { z } from 'zod';

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    message: 'Password must be at least 8 characters',
    test: (value: string) => value.length >= 8,
  },
  {
    id: 'letter',
    label: 'One letter',
    message: 'Password must contain a letter',
    test: (value: string) => /\p{L}/u.test(value),
  },
  {
    id: 'number',
    label: 'One number',
    message: 'Password must contain a number',
    test: (value: string) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'One special character',
    message: 'Password must contain a special character',
    test: (value: string) => /[^\p{L}\p{M}\p{N}\s]/u.test(value),
  },
] as const;

const email = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));

const name = z
  .string()
  .trim()
  .min(3, 'Name must be at least 3 characters')
  .max(100, 'Name must be at most 100 characters');

const newPassword = z
  .string()
  .max(128, 'Password must be at most 128 characters')
  .superRefine((value, ctx) => {
    const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
    if (failed) ctx.addIssue({ code: 'custom', message: failed.message });
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({ name, email, password: newPassword });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
