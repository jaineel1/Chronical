import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from './Shell';
import { ShellProvider } from './shellContext';
import { RequireOnboarded } from './RequireOnboarded';
import { MorningScreen } from '@/features/morning/MorningScreen';
import { CampfireScreen } from '@/features/campfire/CampfireScreen';
import { YouScreen } from '@/features/you/YouScreen';
import { MapScreen } from '@/features/map/MapScreen';
import { PeopleScreen } from '@/features/people/PeopleScreen';
import { VaultScreen } from '@/features/vault/VaultScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { EditorsRoutes } from '@/features/editors/EditorsRoutes';

/**
 * HashRouter keeps deep links working from any static host (artifact preview, file://, Capacitor)
 * without server rewrites. Switch to BrowserRouter when a real host with rewrites exists.
 */
export function App() {
  return (
    <HashRouter>
      <ShellProvider>
        <Routes>
          <Route path="/onboarding/*" element={<OnboardingScreen />} />
          <Route element={<RequireOnboarded />}>
            <Route element={<Shell />}>
              <Route index element={<MorningScreen />} />
              <Route path="campfire" element={<CampfireScreen />} />
              <Route path="you" element={<YouScreen />} />
              <Route path="map" element={<MapScreen />} />
              <Route path="people" element={<PeopleScreen />} />
              <Route path="vault/*" element={<VaultScreen />} />
              <Route path="edit/*" element={<EditorsRoutes />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ShellProvider>
    </HashRouter>
  );
}
