const KEY = 'threadplane_acquisition_session_v1';
const TTL = 30 * 60 * 1000;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Session = { id: string; expiresAt: number };
let memory: Session | undefined;
let memoryOnly = false;
function valid(value: Session | undefined, now: number): value is Session {
  return (
    !!value &&
    typeof value.id === 'string' &&
    UUID.test(value.id) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > now &&
    value.expiresAt <= now + TTL
  );
}
export function getAcquisitionSession(now = Date.now()): {
  id: string;
  scope: 'session' | 'memory';
} {
  let unavailable = false;
  let serialized: string | null = null;
  try {
    serialized = sessionStorage.getItem(KEY);
  } catch {
    unavailable = true;
  }
  try {
    const stored = JSON.parse(serialized ?? 'null') as Session | undefined;
    if (valid(stored, now)) {
      memory = stored;
      memoryOnly = false;
      return { id: stored.id.toLowerCase(), scope: 'session' };
    }
  } catch {
    // Invalid stored JSON is a fresh session, not blocked storage.
    memoryOnly = false;
  }
  if ((unavailable || memoryOnly) && valid(memory, now))
    return { id: memory.id, scope: 'memory' };
  const id = globalThis.crypto.randomUUID();
  if (!UUID.test(id)) throw new Error('A secure UUID generator is required');
  memory = { id, expiresAt: now + TTL };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
    memoryOnly = false;
    return { id, scope: 'session' };
  } catch {
    memoryOnly = true;
    return { id, scope: 'memory' };
  }
}
