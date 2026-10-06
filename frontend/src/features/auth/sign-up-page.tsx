import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { ApiError, getErrorMessage } from '@/lib/api';
import { signUpSchema, type SignUpValues } from '@/lib/schemas';
import { AccountCreatedError, useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { FormError } from '@/components/form-error';
import { PasswordRequirements } from './password-requirements';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });
  const { isSubmitting, errors } = form.formState;
  const password = useWatch({ control: form.control, name: 'password' });

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    try {
      await signUp(name, email, password);
    } catch (error) {
      if (error instanceof AccountCreatedError) {
        navigate('/sign-in', {
          replace: true,
          state: { notice: 'Your account was created. Please sign in.' },
        });
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message: error.message }, { shouldFocus: true });
      } else {
        form.setError('root.server', { message: getErrorMessage(error) });
      }
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Get started in less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError message={errors.root?.server?.message} />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    autoComplete="new-password"
                    placeholder="Create a password"
                    maxLength={128}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <PasswordRequirements value={password} invalid={!!errors.password} />
                </FormDescription>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
