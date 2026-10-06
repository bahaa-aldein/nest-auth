import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
} from './auth-cookie.js';

describe('accessTokenCookieOptions', () => {
  it('is always httpOnly, SameSite=Strict and site-wide', () => {
    for (const secure of [true, false]) {
      expect(accessTokenCookieOptions(secure)).toMatchObject({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      });
    }
  });

  it('is Secure only when asked, which is in production', () => {
    expect(accessTokenCookieOptions(true).secure).toBe(true);
    expect(accessTokenCookieOptions(false).secure).toBe(false);
  });

  it('names the cookie accessToken', () => {
    expect(ACCESS_TOKEN_COOKIE).toBe('accessToken');
  });
});
