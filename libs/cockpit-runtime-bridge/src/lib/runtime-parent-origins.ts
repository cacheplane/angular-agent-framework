const MAX_RUNTIME_PARENT_ORIGINS = 64;
const MAX_ORIGIN_LENGTH = 2048;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function isExactRuntimeParentOrigin(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ORIGIN_LENGTH ||
    value.trim() !== value ||
    value.includes('*') ||
    hasControlCharacters(value)
  ) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    parsed.origin !== value ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return false;
  }

  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'http:') return false;

  return (
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '::1'
  );
}

export function validateRuntimeParentOrigins(
  value: unknown
): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length > MAX_RUNTIME_PARENT_ORIGINS) {
      return null;
    }

    const origins: string[] = [];
    const seen = new Set<string>();
    for (const origin of value) {
      if (!isExactRuntimeParentOrigin(origin) || seen.has(origin)) {
        return null;
      }
      seen.add(origin);
      origins.push(origin);
    }
    return Object.freeze(origins);
  } catch {
    return null;
  }
}

export function isAllowedRuntimeParentOrigin(
  origin: string,
  allowedParentOrigins: readonly string[]
): boolean {
  return allowedParentOrigins.includes(origin);
}
