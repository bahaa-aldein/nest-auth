import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api';
import { AuthProvider } from './auth-provider';
import { SignInPage } from './sign-in-page';
import { SignUpPage } from './sign-up-page';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { me: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn() },
}));

const user = { id: '1', email: 'jane@example.com', name: 'Jane Doe' };

function renderPage(page: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{page}</AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.me).mockRejectedValue(new ApiError(401, 'Not authenticated'));
});

describe('SignUpPage', () => {
  it('shows validation errors and does not call the API on an empty submit', async () => {
    renderPage(<SignUpPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it('ticks the password requirements as the user types', async () => {
    renderPage(<SignUpPage />);
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(rules).toHaveTextContent('One number (not met)');

    await userEvent.type(screen.getByLabelText('Password'), 'abc12345!');
    expect(rules).toHaveTextContent('One number (met)');
    expect(rules).toHaveTextContent('One special character (met)');
  });

  it('can reveal the password', async () => {
    renderPage(<SignUpPage />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('creates the account, then signs in', async () => {
    vi.mocked(api.signUp).mockResolvedValue(user);
    vi.mocked(api.signIn).mockResolvedValue(user);
    renderPage(<SignUpPage />);

    await userEvent.type(screen.getByLabelText('Name'), '  Jane Doe ');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(api.signUp).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Passw0rd!',
      }),
    );
    expect(api.signIn).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'Passw0rd!' });
  });

  it('shows a duplicate email (409) on the email field', async () => {
    vi.mocked(api.signUp).mockRejectedValue(new ApiError(409, 'Email already registered'));
    renderPage(<SignUpPage />);

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends the user to sign in when the automatic sign-in fails', async () => {
    vi.mocked(api.signUp).mockResolvedValue(user);
    vi.mocked(api.signIn).mockRejectedValue(new ApiError(429, 'Too many attempts.'));
    render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <AuthProvider>
          <Routes>
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Name'), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account was created. Please sign in.',
    );
  });
});

describe('SignInPage', () => {
  it('shows the server error for bad credentials', async () => {
    vi.mocked(api.signIn).mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    renderPage(<SignInPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('validates the email format before calling the API', async () => {
    renderPage(<SignInPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(api.signIn).not.toHaveBeenCalled();
  });
});
