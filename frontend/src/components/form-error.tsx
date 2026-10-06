import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
