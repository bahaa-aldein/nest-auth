import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'accessToken';

export function accessTokenCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure, path: '/' };
}
