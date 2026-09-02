export const RUNTIME_BRIDGE_VERSION = 1 as const;
export const RUNTIME_CONFIGURATION_VERSION = 2 as const;

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

export type RuntimeConfigurationTarget =
  | Readonly<{ kind: 'shared' }>
  | Readonly<{ kind: 'ag-ui'; endpoint: string }>
  | Readonly<{ kind: 'langsmith'; apiUrl: string; apiKey: string }>;

export type RuntimeChildReadyMessage = {
  type: 'tplane:runtime-child-ready';
  version: typeof RUNTIME_CONFIGURATION_VERSION;
  nonce: string;
};

export type RuntimeConfigureMessage = {
  type: 'tplane:runtime-configure';
  version: typeof RUNTIME_CONFIGURATION_VERSION;
  nonce: string;
  generation: number;
  target: RuntimeConfigurationTarget;
};

export type RuntimeConfiguredMessage = {
  type: 'tplane:runtime-configured';
  version: typeof RUNTIME_CONFIGURATION_VERSION;
  nonce: string;
  generation: number;
};

export type RuntimeConfigurationFailedMessage = {
  type: 'tplane:runtime-configuration-failed';
  version: typeof RUNTIME_CONFIGURATION_VERSION;
  nonce: string;
  generation: number;
  code: 'incompatible_bridge';
};

export type RuntimeOperationFailureCode = 'unauthorized' | 'network_blocked';

export type RuntimeOperationFailedMessage = {
  type: 'tplane:runtime-operation-failed';
  version: typeof RUNTIME_CONFIGURATION_VERSION;
  nonce: string;
  generation: number;
  code: RuntimeOperationFailureCode;
};

export type RuntimeConfigurationResponseMessage =
  | RuntimeConfiguredMessage
  | RuntimeConfigurationFailedMessage
  | RuntimeOperationFailedMessage;

const MAX_NONCE_LENGTH = 128;
const MAX_URL_LENGTH = 2048;
const MAX_API_KEY_LENGTH = 8192;

const checkKeys = ['type', 'version', 'nonce', 'capability'] as const;
const readyKeys = ['type', 'version', 'nonce'] as const;
const errorKeys = ['type', 'version', 'nonce', 'code'] as const;
const childReadyKeys = ['type', 'version', 'nonce'] as const;
const configureKeys = [
  'type',
  'version',
  'nonce',
  'generation',
  'target',
] as const;
const configuredKeys = ['type', 'version', 'nonce', 'generation'] as const;
const failedKeys = ['type', 'version', 'nonce', 'generation', 'code'] as const;
const sharedTargetKeys = ['kind'] as const;
const agUiTargetKeys = ['kind', 'endpoint'] as const;
const langsmithTargetKeys = ['kind', 'apiUrl', 'apiKey'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Reflect.ownKeys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function snapshotExactRecord(
  value: unknown,
  expectedKeys: readonly string[]
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => Object.hasOwn(value, key))
  ) {
    return null;
  }

  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) return null;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function isBoundedScalar(
  value: unknown,
  maximumLength: number
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximumLength &&
    !hasControlCharacters(value)
  );
}

function isNonce(value: unknown): value is string {
  return isBoundedScalar(value, MAX_NONCE_LENGTH);
}

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function getRawHostname(authority: string): string | null {
  if (authority.startsWith('[')) {
    const closingBracket = authority.indexOf(']');
    if (closingBracket === -1) return null;
    const suffix = authority.slice(closingBracket + 1);
    if (suffix !== '' && !/^:\d+$/.test(suffix)) return null;
    return authority.slice(0, closingBracket + 1).toLowerCase();
  }

  const portSeparator = authority.lastIndexOf(':');
  if (
    portSeparator !== -1 &&
    (!/^\d+$/.test(authority.slice(portSeparator + 1)) ||
      authority.indexOf(':') !== portSeparator)
  ) {
    return null;
  }
  return (
    portSeparator === -1 ? authority : authority.slice(0, portSeparator)
  ).toLowerCase();
}

function isRuntimeUrl(value: unknown): value is string {
  if (
    !isBoundedScalar(value, MAX_URL_LENGTH) ||
    value.trim() !== value ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\') ||
    !/^https?:\/\//i.test(value)
  ) {
    return false;
  }

  const authorityStart = value.indexOf('://') + 3;
  const pathStart = value.indexOf('/', authorityStart);
  const authority = value.slice(
    authorityStart,
    pathStart === -1 ? value.length : pathStart
  );
  const rawPathname = pathStart === -1 ? '' : value.slice(pathStart);
  if (authority.includes('@')) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return false;
  }
  if (parsed.pathname !== (rawPathname || '/')) return false;

  if (parsed.protocol === 'http:') {
    const rawHostname = getRawHostname(authority);
    if (
      rawHostname === null ||
      !new Set(['localhost', '127.0.0.1', '[::1]']).has(rawHostname)
    ) {
      return false;
    }
  }

  return true;
}

function parseRuntimeConfigurationTarget(
  value: unknown
): RuntimeConfigurationTarget | null {
  const shared = snapshotExactRecord(value, sharedTargetKeys);
  if (shared?.kind === 'shared') {
    return Object.freeze({ kind: 'shared' });
  }
  const agUi = snapshotExactRecord(value, agUiTargetKeys);
  if (agUi?.kind === 'ag-ui' && isRuntimeUrl(agUi.endpoint)) {
    return Object.freeze({ kind: 'ag-ui', endpoint: agUi.endpoint });
  }
  const langsmith = snapshotExactRecord(value, langsmithTargetKeys);
  if (
    langsmith?.kind === 'langsmith' &&
    isRuntimeUrl(langsmith.apiUrl) &&
    isBoundedScalar(langsmith.apiKey, MAX_API_KEY_LENGTH)
  ) {
    return Object.freeze({
      kind: 'langsmith',
      apiUrl: langsmith.apiUrl,
      apiKey: langsmith.apiKey,
    });
  }
  return null;
}

export function parseRuntimeCheckMessage(
  value: unknown
): RuntimeCheckMessage | null {
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

export function parseRuntimeResponseMessage(
  value: unknown
): RuntimeResponseMessage | null {
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

export function parseRuntimeChildReadyMessage(
  value: unknown
): RuntimeChildReadyMessage | null {
  try {
    const message = snapshotExactRecord(value, childReadyKeys);
    if (
      message === null ||
      message.type !== 'tplane:runtime-child-ready' ||
      message.version !== RUNTIME_CONFIGURATION_VERSION ||
      !isNonce(message.nonce)
    ) {
      return null;
    }
    return {
      type: 'tplane:runtime-child-ready',
      version: RUNTIME_CONFIGURATION_VERSION,
      nonce: message.nonce,
    };
  } catch {
    return null;
  }
}

export function parseRuntimeConfigureMessage(
  value: unknown
): RuntimeConfigureMessage | null {
  try {
    const message = snapshotExactRecord(value, configureKeys);
    if (
      message === null ||
      message.type !== 'tplane:runtime-configure' ||
      message.version !== RUNTIME_CONFIGURATION_VERSION ||
      !isNonce(message.nonce) ||
      !isGeneration(message.generation)
    ) {
      return null;
    }
    const target = parseRuntimeConfigurationTarget(message.target);
    if (target === null) return null;
    return {
      type: 'tplane:runtime-configure',
      version: RUNTIME_CONFIGURATION_VERSION,
      nonce: message.nonce,
      generation: message.generation,
      target,
    };
  } catch {
    return null;
  }
}

export function parseRuntimeConfiguredMessage(
  value: unknown
): RuntimeConfiguredMessage | null {
  try {
    const message = snapshotExactRecord(value, configuredKeys);
    if (
      message === null ||
      message.type !== 'tplane:runtime-configured' ||
      message.version !== RUNTIME_CONFIGURATION_VERSION ||
      !isNonce(message.nonce) ||
      !isGeneration(message.generation)
    ) {
      return null;
    }
    return {
      type: 'tplane:runtime-configured',
      version: RUNTIME_CONFIGURATION_VERSION,
      nonce: message.nonce,
      generation: message.generation,
    };
  } catch {
    return null;
  }
}

export function parseRuntimeConfigurationFailedMessage(
  value: unknown
): RuntimeConfigurationFailedMessage | null {
  try {
    const message = snapshotExactRecord(value, failedKeys);
    if (
      message === null ||
      message.type !== 'tplane:runtime-configuration-failed' ||
      message.version !== RUNTIME_CONFIGURATION_VERSION ||
      !isNonce(message.nonce) ||
      !isGeneration(message.generation) ||
      message.code !== 'incompatible_bridge'
    ) {
      return null;
    }
    return {
      type: 'tplane:runtime-configuration-failed',
      version: RUNTIME_CONFIGURATION_VERSION,
      nonce: message.nonce,
      generation: message.generation,
      code: 'incompatible_bridge',
    };
  } catch {
    return null;
  }
}

export function parseRuntimeOperationFailedMessage(
  value: unknown
): RuntimeOperationFailedMessage | null {
  try {
    const message = snapshotExactRecord(value, failedKeys);
    if (
      message === null ||
      message.type !== 'tplane:runtime-operation-failed' ||
      message.version !== RUNTIME_CONFIGURATION_VERSION ||
      !isNonce(message.nonce) ||
      !isGeneration(message.generation) ||
      (message.code !== 'unauthorized' && message.code !== 'network_blocked')
    ) {
      return null;
    }
    return {
      type: 'tplane:runtime-operation-failed',
      version: RUNTIME_CONFIGURATION_VERSION,
      nonce: message.nonce,
      generation: message.generation,
      code: message.code,
    };
  } catch {
    return null;
  }
}

export function parseRuntimeConfigurationResponseMessage(
  value: unknown
): RuntimeConfigurationResponseMessage | null {
  return (
    parseRuntimeConfiguredMessage(value) ??
    parseRuntimeConfigurationFailedMessage(value) ??
    parseRuntimeOperationFailedMessage(value)
  );
}
