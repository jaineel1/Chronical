import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from './Shell';
import { ShellProvider } from './shellContext';
import { RequireOnboarded } from './RequireOnboarded';
import { NativeBridge } from './NativeBridge';
import { AutoSync } from './AutoSync';
import { MorningScreen } from '@/features/morning/MorningScreen';
import { CampfireScreen } from '@/features/campfire/CampfireScreen';

// The two daily screens load with the app; everything else arrives when first opened.
const YouScreen = lazy(() => import('@/features/you/YouScreen').then((m) => ({ default: m.YouScreen })));
const MapScreen = lazy(() => import('@/features/map/MapScreen').then((m) => ({ default: m.MapScreen })));
const PeopleScreen = lazy(() => import('@/features/people/PeopleScreen').then((m) => ({ default: m.PeopleScreen })));
const VaultScreen = lazy(() => import('@/features/vault/VaultScreen').then((m) => ({ default: m.VaultScreen })));
const OnboardingScreen = lazy(() => import('@/features/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })));
const EditorsRoutes = lazy(() => import('@/features/editors/EditorsRoutes').then((m) => ({ default: m.EditorsRoutes })));
const ProgressScreen = lazy(() => import('@/features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));
const SyncScreen = lazy(() => import('@/features/vault/SyncScreen').then((m) => ({ default: m.SyncScreen })));

/** Quiet paper while a chunk loads; never a spinner. */
function Quiet() {
  return <div className="min-h-[40vh] bg-paper" aria-busy="true" />;
}

/**
 * HashRouter keeps deep links working from any static host (artifact preview, file://, Capacitor)
 * without server rewrites. Switch to BrowserRouter when a real host with rewrites exists.
 */
export function App() {
  return (
    <HashRouter>
      <ShellProvider>
        <NativeBridge />
        <AutoSync />
        <Suspense fallback={<Quiet />}>
          <Routes>
            <Route path="/onboarding/*" element={<OnboardingScreen />} />
            {/* Outside the onboarding guard: a fresh phone links here to pull an existing game. */}
            <Route element={<Shell />}>
              <Route path="sync" element={<SyncScreen />} />
            </Route>
            <Route element={<RequireOnboarded />}>
              <Route element={<Shell />}>
                <Route index element={<MorningScreen />} />
                <Route path="campfire" element={<CampfireScreen />} />
                <Route path="you" element={<YouScreen />} />
                <Route path="map" element={<MapScreen />} />
                <Route path="people" element={<PeopleScreen />} />
                <Route path="progress" element={<ProgressScreen />} />
                <Route path="vault/*" element={<VaultScreen />} />
                <Route path="edit/*" element={<EditorsRoutes />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ShellProvider>
    </HashRouter>
  );
}
