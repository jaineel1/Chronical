import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { useProfile } from '@/data/hooks';
import { CompileStep } from './CompileStep';
import { DoneStep } from './DoneStep';
import { PartStep } from './PartStep';
import { PromptStep } from './PromptStep';
import { ReviewStep } from './ReviewStep';
import { WelcomeStep } from './WelcomeStep';
import { QuietPaper } from './WizardFrame';
import { WizardProvider } from './wizard';

/**
 * The Origin Sheet wizard at /onboarding/*:
 *   /onboarding                 welcome: name, Begin, "Try the demo first"
 *   /onboarding/part/:n         parts 1-10 (`?edit=1` from the Vault edits an onboarded profile)
 *   /onboarding/compile         the compiled sheet
 *   /onboarding/prompt          the first Claude hand-off (or "Skip Claude for now")
 *   /onboarding/review          accept skills, routines, goals → "Create my game"
 *   /onboarding/done            closing page
 * An onboarded profile is sent home, except in edit mode and on /done.
 */
export function OnboardingScreen() {
  const profile = useProfile();
  const [params] = useSearchParams();
  const location = useLocation();
  const editMode = params.get('edit') === '1';

  if (profile === undefined) return <QuietPaper />;
  if (profile?.onboardedAt && !editMode && !location.pathname.endsWith('/done')) return <Navigate to="/" replace />;

  return (
    <WizardProvider profile={profile} editMode={editMode}>
      <Routes>
        <Route index element={<WelcomeStep />} />
        <Route path="part/:n" element={<PartStep />} />
        <Route path="compile" element={<CompileStep />} />
        <Route path="prompt" element={<PromptStep />} />
        <Route path="review" element={<ReviewStep />} />
        <Route path="done" element={<DoneStep />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </WizardProvider>
  );
}
