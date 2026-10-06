import { API_URL } from './config';

export interface User {
  id: string;
  email: string;
  name: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : GENERIC_ERROR;

async function readErrorMessage(res: Response): Promise<string> {
  if (res.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || GENERIC_ERROR;
}

async function request<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please try again.');
  }

  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res));
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  me: () => request<User>('/auth/me'),
  signUp: (body: { name: string; email: string; password: string }) =>
    request<User>('/auth/sign-up', { method: 'POST', body }),
  signIn: (body: { email: string; password: string }) =>
    request<User>('/auth/sign-in', { method: 'POST', body }),
  signOut: () => request<void>('/auth/sign-out', { method: 'POST' }),
};
