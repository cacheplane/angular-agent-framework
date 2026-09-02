import 'server-only';

// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  acceptFormSubmission,
  createDatabaseExecutor,
  type AcceptFormSubmissionInput,
  type AcceptFormSubmissionResult,
  type EmailHmacKeyring,
  type SqlExecutor,
} from '@threadplane-internal/growth';

import { readBoundedBody } from '../../app/api/_internal/read-bounded-body';
import { loadEmailHmacKeyring } from './email-keyring';
import { getFormPolicy, type PublicFormPolicy } from './form-policy';
import { invokeLifecycle } from './lifecycle-client';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface GrowthFormRouteDependencies {
  getPolicy: () => PublicFormPolicy;
  accept: (
    executor: SqlExecutor,
    input: AcceptFormSubmissionInput
  ) => Promise<AcceptFormSubmissionResult>;
  createDatabase: () => SqlExecutor;
  loadKeyring: () => EmailHmacKeyring;
  now: () => Date;
  nudge: (input: { submissionId: string }) => Promise<void>;
}

export function defaultGrowthFormRouteDependencies(): GrowthFormRouteDependencies {
  return {
    getPolicy: getFormPolicy,
    accept: acceptFormSubmission,
    createDatabase: () => createDatabaseExecutor(),
    loadKeyring: loadEmailHmacKeyring,
    now: () => new Date(),
    nudge: nudgeLifecycle,
  };
}

export async function readBoundedJsonObject(
  request: Request,
  maximumBytes: number
): Promise<Record<string, unknown> | null> {
  if (
    request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase() !== 'application/json'
  ) {
    if (request.body !== null && !request.body.locked) {
      await request.body.cancel().catch(() => undefined);
    }
    return null;
  }
  const rawBody = await readBoundedBody(request, maximumBytes);
  if (rawBody === null) return null;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function stalePolicyResponse(policy: PublicFormPolicy): Response {
  return jsonResponse(
    {
      error: 'This form changed. Please retry.',
      policy_version: policy.version,
      retryable: true,
    },
    409,
    { 'Retry-After': '0' }
  );
}

export function strictText(
  body: Record<string, unknown>,
  key: string,
  maximumLength: number
): string {
  const value = body[key];
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new Error(`${key} must be text`);
  }
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new Error(`${key} is too long`);
  }
  return normalized;
}

export function strictOptionalEnum<T extends string>(
  body: Record<string, unknown>,
  key: string,
  values: readonly T[]
): T | undefined {
  if (body[key] === undefined || body[key] === '') return undefined;
  const value = strictText(body, key, 100);
  if (!values.includes(value as T)) {
    throw new Error(`${key} is invalid`);
  }
  return value as T;
}

export function validGrowthFormIdentities(
  submissionId: string,
  acquisitionSessionId: string
): boolean {
  return (
    UUID_V4.test(submissionId) &&
    (acquisitionSessionId.length === 0 || UUID_V4.test(acquisitionSessionId))
  );
}

export interface LifecycleNudgeDependencies {
  environment: Readonly<Record<string, string | undefined>>;
  invoke: typeof invokeLifecycle;
}

const defaultLifecycleNudgeDependencies: LifecycleNudgeDependencies = {
  environment: process.env,
  invoke: invokeLifecycle,
};

export async function nudgeLifecycle(
  input: { submissionId: string },
  dependencies: LifecycleNudgeDependencies = defaultLifecycleNudgeDependencies
): Promise<void> {
  const endpoint = dependencies.environment['LIFECYCLE_DAWN_URL']?.trim();
  const secret = dependencies.environment['LIFECYCLE_SERVICE_SECRET'];
  if (!endpoint || !secret || secret.trim().length === 0) return;
  await dependencies.invoke({
    baseUrl: endpoint,
    serviceSecret: secret,
    submissionId: input.submissionId,
    timeoutMs: 2_000,
    trigger: 'nudge',
  });
}
