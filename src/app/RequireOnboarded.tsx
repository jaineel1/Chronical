import { Navigate, Outlet } from 'react-router';
import { useProfile } from '@/data/hooks';

/** Sends a fresh install to the Origin Sheet until it has been completed once. */
export function RequireOnboarded() {
  const profile = useProfile();
  if (profile === undefined) {
    return <div className="min-h-dvh bg-paper" aria-busy="true" />;
  }
  if (!profile?.onboardedAt) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
