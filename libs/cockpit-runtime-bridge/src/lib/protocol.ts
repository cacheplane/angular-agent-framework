export const RUNTIME_BRIDGE_VERSION = 1 as const;

export type RuntimeCheckMessage = {
  type: 'tplane:runtime-check';
  version: typeof RUNTIME_BRIDGE_VERSION;
  nonce: string;
  capability: string;
};

export type RuntimeReadyMessage = {
  type: 'tplane:runtime-ready';
  version: typeof RUNTIME_BRIDGE_VERSION;
  nonce: string;
};

export type RuntimeErrorMessage = {
  type: 'tplane:runtime-error';
  version: typeof RUNTIME_BRIDGE_VERSION;
  nonce: string;
  code: 'bootstrap_failed';
};

export type RuntimeResponseMessage = RuntimeReadyMessage | RuntimeErrorMessage;

const checkKeys = ['type', 'version', 'nonce', 'capability'] as const;
const readyKeys = ['type', 'version', 'nonce'] as const;
const errorKeys = ['type', 'version', 'nonce', 'code'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Reflect.ownKeys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseRuntimeCheckMessage(value: unknown): RuntimeCheckMessage | null {
  try {
    if (!isRecord(value) || !hasExactKeys(value, checkKeys)) {
      return null;
    }

    if (
      value.type !== 'tplane:runtime-check' ||
      value.version !== RUNTIME_BRIDGE_VERSION ||
      !isNonEmptyString(value.nonce) ||
      !isNonEmptyString(value.capability)
    ) {
      return null;
    }

    return value as RuntimeCheckMessage;
  } catch {
    return null;
  }
}

export function parseRuntimeResponseMessage(value: unknown): RuntimeResponseMessage | null {
  try {
    if (!isRecord(value) || !isNonEmptyString(value.nonce)) {
      return null;
    }

    if (
      value.type === 'tplane:runtime-ready' &&
      value.version === RUNTIME_BRIDGE_VERSION &&
      hasExactKeys(value, readyKeys)
    ) {
      return value as RuntimeReadyMessage;
    }

    if (
      value.type === 'tplane:runtime-error' &&
      value.version === RUNTIME_BRIDGE_VERSION &&
      value.code === 'bootstrap_failed' &&
      hasExactKeys(value, errorKeys)
    ) {
      return value as RuntimeErrorMessage;
    }

    return null;
  } catch {
    return null;
  }
}
