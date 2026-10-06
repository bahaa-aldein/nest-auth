import { api, type User } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccountCreatedError, AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.signIn({ email, password }));
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      await api.signUp({ name, email, password });
      try {
        await signIn(email, password);
      } catch {
        throw new AccountCreatedError();
      }
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
