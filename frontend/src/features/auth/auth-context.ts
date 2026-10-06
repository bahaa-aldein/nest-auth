import { createContext, useContext } from 'react';
import type { User } from '@/lib/api';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export class AccountCreatedError extends Error {
  constructor() {
    super('Your account was created, but we could not sign you in automatically.');
    this.name = 'AccountCreatedError';
  }
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
