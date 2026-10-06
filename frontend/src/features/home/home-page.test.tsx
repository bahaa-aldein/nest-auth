import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/lib/api';
import { AuthProvider } from '@/features/auth/auth-provider';
import { HomePage } from './home-page';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { me: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn() },
}));

const user = { id: '1', email: 'jane@example.com', name: 'Jane Doe' };

function renderHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.me).mockResolvedValue(user);
});

describe('HomePage', () => {
  it('greets the signed-in user', async () => {
    renderHome();

    expect(
      await screen.findByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('signs out through the API and leaves the page', async () => {
    vi.mocked(api.signOut).mockResolvedValue(undefined);
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(api.signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
  });

  it('stays signed in and shows an error when the server cannot be reached', async () => {
    vi.mocked(api.signOut).mockRejectedValue(
      new ApiError(0, 'Cannot reach the server. Please try again.'),
    );
    renderHome();

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    expect(
      screen.getByRole('heading', { name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
  });
});
