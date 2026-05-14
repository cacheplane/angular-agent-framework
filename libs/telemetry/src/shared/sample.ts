// Cheap deterministic 32-bit hash (Fnv-1a) — no crypto needed for sampling.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function shouldSample(rate: number, anonId: string): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return hashString(anonId) / 0xffffffff < rate;
}
