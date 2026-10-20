import { Navigate, Route, Routes } from 'react-router';
import { ArchiveDetail, ArchiveList } from './ArchiveScreen';
import { DataScreen } from './DataScreen';
import { GuideScreen } from './GuideScreen';
import { LettersScreen } from './LettersScreen';
import { OriginScreen } from './OriginScreen';
import { SettingsScreen } from './SettingsScreen';
import { SyncScreen } from './SyncScreen';
import { MealsLibraryScreen } from './MealsLibraryScreen';
import { TimetableScreen } from './TimetableScreen';
import { VaultIndex } from './VaultIndex';

/**
 * The Vault, mounted at /vault/* inside the Shell:
 *   /vault                 sections
 *   /vault/archive         every prompt, searchable      /vault/archive/:id   prompt + reply
 *   /vault/letters         every morning letter + kept affirmations
 *   /vault/origin          State of Me, Origin Sheet, run the origin prompt again
 *   /vault/settings        name, rollover, deep mode, money, models, reminders, API key
 *   /vault/data            backup, import, exports, storage, start over
 *   /vault/sync            GitHub sync (also at /sync, outside the onboarding guard)
 *   /vault/guide           Night 1
 */
export function VaultScreen() {
  return (
    <Routes>
      <Route index element={<VaultIndex />} />
      <Route path="archive" element={<ArchiveList />} />
      <Route path="archive/:id" element={<ArchiveDetail />} />
      <Route path="letters" element={<LettersScreen />} />
      <Route path="origin" element={<OriginScreen />} />
      <Route path="settings" element={<SettingsScreen />} />
      <Route path="data" element={<DataScreen />} />
      <Route path="guide" element={<GuideScreen />} />
      <Route path="sync" element={<SyncScreen />} />
      <Route path="meals" element={<MealsLibraryScreen />} />
      <Route path="timetable" element={<TimetableScreen />} />
      <Route path="*" element={<Navigate to="/vault" replace />} />
    </Routes>
  );
}
