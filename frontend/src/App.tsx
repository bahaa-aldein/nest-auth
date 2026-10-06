import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/route-guards';
import { SignInPage } from '@/features/auth/sign-in-page';
import { SignUpPage } from '@/features/auth/sign-up-page';
import { HomePage } from '@/features/home/home-page';

export function App() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
