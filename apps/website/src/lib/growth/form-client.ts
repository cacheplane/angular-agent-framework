const ACQUISITION_SESSION_KEY = 'threadplane_acquisition_session_v1';
const ACQUISITION_SESSION_TTL_MS = 30 * 60 * 1_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const FORM_POLICY_REFRESH_MESSAGE =
  'This form changed. Refresh the page before submitting again.';

interface StoredSession {
  id: string;
  expiresAt: number;
}

function newUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function getAcquisitionSessionId(now = Date.now()): string {
  try {
    const raw = sessionStorage.getItem(ACQUISITION_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSession;
      if (
        typeof parsed.id === 'string' &&
        UUID_V4.test(parsed.id) &&
        typeof parsed.expiresAt === 'number' &&
        Number.isFinite(parsed.expiresAt) &&
        parsed.expiresAt > now &&
        parsed.expiresAt <= now + ACQUISITION_SESSION_TTL_MS
      ) {
        return parsed.id.toLowerCase();
      }
    }
  } catch {
    // Storage availability must not block form submission.
  }

  const id = newUuid();
  if (!UUID_V4.test(id)) {
    throw new Error('A secure UUID generator is required');
  }
  try {
    sessionStorage.setItem(
      ACQUISITION_SESSION_KEY,
      JSON.stringify({ id, expiresAt: now + ACQUISITION_SESSION_TTL_MS })
    );
  } catch {
    // The request can still carry the in-memory acquisition identity.
  }
  return id;
}

export type GrowthFormJsonPrimitive = boolean | number | string | null;
export type GrowthFormJsonValue =
  | GrowthFormJsonPrimitive
  | readonly GrowthFormJsonValue[]
  | GrowthFormFacts;
export interface GrowthFormFacts {
  readonly [key: string]: GrowthFormJsonValue;
}

type DeepReadonlyJson<Value extends GrowthFormJsonValue> =
  Value extends GrowthFormJsonPrimitive
    ? Value
    : Value extends readonly (infer Entry extends GrowthFormJsonValue)[]
    ? readonly DeepReadonlyJson<Entry>[]
    : Value extends GrowthFormFacts
    ? { readonly [Key in keyof Value]: DeepReadonlyJson<Value[Key]> }
    : never;

export interface GrowthFormRequestSnapshot<
  Facts extends GrowthFormFacts = GrowthFormFacts
> {
  acquisition_session_id: string;
  submission_id: string;
  facts: DeepReadonlyJson<Facts>;
  fingerprint: string;
}

const INVALID_FORM_FACTS = 'Growth form facts must be JSON-safe';

function invalidFormFacts(): never {
  throw new Error(INVALID_FORM_FACTS);
}

function isJsonArray(
  value: GrowthFormJsonValue
): value is readonly GrowthFormJsonValue[] {
  return Array.isArray(value);
}

function copyJsonValue(
  value: unknown,
  ancestors: Set<object>
): GrowthFormJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) invalidFormFacts();
    return value;
  }
  if (typeof value !== 'object') invalidFormFacts();
  if (ancestors.has(value)) invalidFormFacts();

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) invalidFormFacts();
      const indexKeys = Reflect.ownKeys(value).filter(
        (key) => key !== 'length'
      );
      if (
        indexKeys.length !== value.length ||
        indexKeys.some(
          (key, index) => typeof key !== 'string' || key !== String(index)
        )
      ) {
        invalidFormFacts();
      }
      const copy: GrowthFormJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index)
        );
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          invalidFormFacts();
        }
        copy.push(copyJsonValue(descriptor.value, ancestors));
      }
      return copy;
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) invalidFormFacts();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) invalidFormFacts();

    const copy: Record<string, GrowthFormJsonValue> = {};
    for (const key of (keys as string[]).sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0
    )) {
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        invalidFormFacts();
      }
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: copyJsonValue(descriptor.value, ancestors),
        writable: true,
      });
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
}

function copyGrowthFormFacts(value: unknown): GrowthFormFacts {
  try {
    const copy = copyJsonValue(value, new Set());
    if (copy === null || typeof copy !== 'object' || isJsonArray(copy)) {
      invalidFormFacts();
    }
    return copy;
  } catch {
    throw new Error(INVALID_FORM_FACTS);
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
  }
  return value;
}

export function growthFormRequestSnapshot<Facts extends GrowthFormFacts>(
  current: GrowthFormRequestSnapshot<Facts> | null,
  facts: Facts
): GrowthFormRequestSnapshot<Facts> {
  const capturedFacts = copyGrowthFormFacts(facts) as Facts;
  const fingerprint = JSON.stringify(capturedFacts);
  if (current?.fingerprint === fingerprint) return current;
  return Object.freeze({
    acquisition_session_id: getAcquisitionSessionId(),
    submission_id: newUuid(),
    facts: deepFreeze(capturedFacts) as DeepReadonlyJson<Facts>,
    fingerprint,
  });
}
