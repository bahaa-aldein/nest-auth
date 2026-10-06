import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { FormError } from '@/components/form-error';
import { getErrorMessage } from '@/lib/api';

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase())
    .join('');

export function HomePage() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string>();

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(undefined);
    try {
      await signOut();
    } catch (failure) {
      setError(getErrorMessage(failure));
      setSigningOut(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-muted/40 flex min-h-svh flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Logo />
          <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
            <LogOut aria-hidden />
            Log out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        {error && (
          <div className="w-full max-w-md">
            <FormError message={error} />
          </div>
        )}
        <Card className="animate-in fade-in slide-in-from-bottom-3 w-full max-w-md text-center duration-500">
          <CardHeader className="justify-items-center gap-4">
            <div
              className="bg-primary/10 text-primary ring-primary/5 flex size-16 items-center justify-center rounded-full text-xl font-semibold ring-4"
              aria-hidden
            >
              {getInitials(user.name)}
            </div>
            <CardTitle className="text-2xl leading-tight tracking-tight">
              <h1>Welcome to the application.</h1>
            </CardTitle>
            <CardDescription>You&apos;re signed in as</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <p className="font-medium">{user.name}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
