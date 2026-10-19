/** Short, sortable, collision-safe ids (time prefix + random), safe for IndexedDB and later sync. */
export function newId(): string {
  const time = Date.now().toString(36);
  const rand =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('')
      : Math.random().toString(36).slice(2, 10);
  return `${time}${rand}`;
}
