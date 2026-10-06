import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/schemas';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  value: string;
  invalid?: boolean;
}

export function PasswordRequirements({ value, invalid = false }: PasswordRequirementsProps) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const Icon = met ? Check : Circle;
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 transition-colors',
              met
                ? 'text-emerald-600 dark:text-emerald-400'
                : invalid
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            <Icon className={met ? 'size-4' : 'mx-0.5 size-3'} aria-hidden />
            {rule.label}
            <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
