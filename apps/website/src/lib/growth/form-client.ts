import { getAcquisitionSession } from './acquisition-session';

export const FORM_POLICY_REFRESH_MESSAGE =
  'This form changed. Refresh the page before submitting again.';

function newUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function getAcquisitionSessionId(now = Date.now()): string {
  return getAcquisitionSession(now).id;
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
