import { ShieldCheck } from 'lucide-react';
import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 font-semibold', className)}>
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          inverted
            ? 'bg-white/15 text-white ring-1 ring-white/25'
            : 'bg-primary text-primary-foreground',
        )}
      >
        <ShieldCheck className="size-5" aria-hidden />
      </span>
      <span className="text-lg tracking-tight">{APP_NAME}</span>
    </div>
  );
}
