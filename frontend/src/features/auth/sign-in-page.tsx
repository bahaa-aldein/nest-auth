import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { getErrorMessage } from '@/lib/api';
import { signInSchema, type SignInValues } from '@/lib/schemas';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { FormError } from '@/components/form-error';

export function SignInPage() {
  const { signIn } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { isSubmitting, errors } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await signIn(email, password);
    } catch (error) {
      form.setError('root.server', { message: getErrorMessage(error) });
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your account to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/sign-up"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError message={errors.root?.server?.message} />
          {notice && !errors.root?.server && (
            <Alert>
              <CircleCheck aria-hidden />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
