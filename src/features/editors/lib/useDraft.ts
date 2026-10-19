import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Form state that follows the live row until the player touches a field.
 *
 * `live` is the form-shaped projection of the stored row (memoise it). Fields the player has not
 * edited keep tracking it, so a "Log hours" or a lore update made on the same page shows up in the
 * form and is not overwritten by a stale value on Save. Edited fields keep the player's value.
 */
export function useDraft<T extends object>(live: T): [T, (patch: Partial<T>) => void, () => boolean] {
  const [draft, setDraft] = useState<T>(live);
  const touched = useRef(new Set<keyof T>());

  useEffect(() => {
    setDraft((d) => {
      let changed = false;
      const next = { ...d };
      for (const k of Object.keys(live) as (keyof T)[]) {
        if (!touched.current.has(k) && next[k] !== live[k]) {
          next[k] = live[k];
          changed = true;
        }
      }
      return changed ? next : d;
    });
  }, [live]);

  const set = useCallback((patch: Partial<T>) => {
    for (const k of Object.keys(patch) as (keyof T)[]) touched.current.add(k);
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const dirty = useCallback(() => touched.current.size > 0, []);
  return [draft, set, dirty];
}
