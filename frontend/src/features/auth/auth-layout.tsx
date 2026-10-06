import { Gauge, KeyRound, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

const highlights = [
  {
    icon: KeyRound,
    title: 'Argon2 password hashing',
    text: 'Passwords are never stored in plain text.',
  },
  {
    icon: Lock,
    title: 'httpOnly session cookies',
    text: 'Your session token is out of reach of page scripts.',
  },
  {
    icon: Gauge,
    title: 'Rate-limited endpoints',
    text: 'Sign-in attempts are throttled against brute force.',
  },
];

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-700 p-10 text-white lg:flex dark:from-indigo-700 dark:via-violet-800 dark:to-fuchsia-900">
      <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-300/20 blur-3xl" />

      <Logo inverted className="relative" />

      <div className="relative space-y-8">
        <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
          Secure by default.
          <span className="block text-white/70">Simple by design.</span>
        </h2>
        <ul className="space-y-5">
          {highlights.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-white/70">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-white/60">Built with NestJS, MongoDB and React.</p>
    </aside>
  );
}

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />
      <main className="flex flex-col p-6 md:p-10">
        <Logo className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="animate-in fade-in slide-in-from-bottom-3 w-full max-w-sm space-y-6 duration-500">
            <header className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-muted-foreground text-sm">{description}</p>
            </header>
            {children}
            <p className="text-muted-foreground text-center text-sm">{footer}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
