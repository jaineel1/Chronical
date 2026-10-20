import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useProfile } from '@/data/hooks';

const MORNING_ID = 1;
const NIGHT_ID = 2;

function hm(value: string | undefined, fallback: [number, number]): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

/**
 * Native-only side effects. In the iPhone app this schedules the two daily reminders from
 * Vault → Settings (morning letter, Campfire). On the web it renders nothing and does nothing.
 */
export function NativeBridge() {
  const profile = useProfile();
  const morning = profile?.settings.reminders.morning;
  const night = profile?.settings.reminders.night;
  const onboarded = !!profile?.onboardedAt;

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !onboarded) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await LocalNotifications.checkPermissions();
        const granted = perm.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
        if (!granted || cancelled) return;
        await LocalNotifications.cancel({ notifications: [{ id: MORNING_ID }, { id: NIGHT_ID }] });
        const [mh, mm] = hm(morning, [6, 30]);
        const [nh, nm] = hm(night, [22, 0]);
        await LocalNotifications.schedule({
          notifications: [
            { id: MORNING_ID, title: 'Your letter is in', body: 'The game master wrote back. Three quests are waiting.', schedule: { on: { hour: mh, minute: mm }, allowWhileIdle: true } },
            { id: NIGHT_ID, title: 'Light the Campfire', body: 'Thirty minutes. Log the day while it is still fresh.', schedule: { on: { hour: nh, minute: nm }, allowWhileIdle: true } },
          ],
        });
      } catch (e) {
        console.warn('Reminders not scheduled', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morning, night, onboarded]);

  return null;
}
