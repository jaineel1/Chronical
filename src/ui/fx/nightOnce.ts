/**
 * "Once per night per device" for reward moments. The night's date is kept in localStorage under
 * `chronicle.fx.<key>`. Storage that is missing, blocked or full means the moment does not play.
 */

const PREFIX = 'chronicle.fx.';

/** True the first time `key` is claimed for `date` on this device; false after, or when storage fails. */
export function claimNight(key: string, date: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalStorage()): boolean {
  if (!storage) return false;
  try {
    const k = PREFIX + key;
    if (storage.getItem(k) === date) return false;
    storage.setItem(k, date);
    return true;
  } catch {
    return false;
  }
}

function globalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
