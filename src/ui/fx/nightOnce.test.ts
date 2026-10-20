import { describe, expect, it } from 'vitest';
import { claimNight } from './nightOnce';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('claimNight', () => {
  it('plays once per night per key', () => {
    const s = memory();
    expect(claimNight('pillars', '2026-10-19', s)).toBe(true);
    expect(claimNight('pillars', '2026-10-19', s)).toBe(false);
    expect(claimNight('levelup.BODY', '2026-10-19', s)).toBe(true);
    expect(claimNight('pillars', '2026-10-20', s)).toBe(true);
  });

  it('does not play when storage fails', () => {
    const broken: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(claimNight('pillars', '2026-10-19', broken)).toBe(false);
  });
});
