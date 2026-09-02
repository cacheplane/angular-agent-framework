import { z } from 'zod';

import { normalizeCampaignDraft } from '../campaign/templates.js';
import { DeterministicScoreReasonSchema } from '../enrichment/schema.js';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const OPTIONAL_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const SOURCE_URL_PATTERN =
  /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\/[A-Za-z0-9._~!$&'()*+,;=:/-]*)?$/u;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const SOURCE_UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOURCE_HEX_SEGMENT_PATTERN = /^[0-9a-f]{24,}$/iu;
const SOURCE_OPAQUE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{32,}$/u;
const DESCRIPTIVE_SLUG_PATTERN = /^[a-z]+(?:-[a-z]+)+$/u;

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function containsIdentifierPathSegment(url: URL): boolean {
  return url.pathname
    .split('/')
    .filter(Boolean)
    .some(
      (segment) =>
        SOURCE_UUID_SEGMENT_PATTERN.test(segment) ||
        SOURCE_HEX_SEGMENT_PATTERN.test(segment) ||
        (SOURCE_OPAQUE_SEGMENT_PATTERN.test(segment) &&
          !DESCRIPTIVE_SLUG_PATTERN.test(segment))
    );
}

const EvidenceSourceUrlSchema = z
  .string()
  .min(1)
  .max(500)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.port !== '' ||
        url.search !== '' ||
        url.hash !== '' ||
        url.href !== value ||
        !SOURCE_URL_PATTERN.test(value) ||
        EMAIL_PATTERN.test(value) ||
        containsControlCharacter(value) ||
        containsIdentifierPathSegment(url)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'evidence source URL must be credential-free HTTPS',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'evidence source URL must be valid',
      });
    }
  });

interface FounderStopWirePayload {
  c: string;
  i: number;
  k: number;
  n?: string;
  p: 'founder_stop';
  r?: string;
}

function optionalIdentifier(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.length >= 1 &&
      value.length <= 100 &&
      OPTIONAL_IDENTIFIER_PATTERN.test(value))
  );
}

function canonicalFounderStopPayload(payload: FounderStopWirePayload): string {
  return JSON.stringify({
    c: payload.c,
    i: payload.i,
    k: payload.k,
    ...(payload.n === undefined ? {} : { n: payload.n }),
    p: payload.p,
    ...(payload.r === undefined ? {} : { r: payload.r }),
  });
}

function validFounderStopTokenEnvelope(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, encodedPayload, signature] = parts;
  if (
    version !== 'g1' ||
    !encodedPayload ||
    encodedPayload.length > 1_024 ||
    !BASE64URL_PATTERN.test(encodedPayload) ||
    !signature ||
    signature.length !== 43 ||
    !BASE64URL_PATTERN.test(signature)
  ) {
    return false;
  }

  try {
    const signatureBytes = Buffer.from(signature, 'base64url');
    if (
      signatureBytes.length !== 32 ||
      signatureBytes.toString('base64url') !== signature
    ) {
      return false;
    }
    const payloadBytes = Buffer.from(encodedPayload, 'base64url');
    if (payloadBytes.toString('base64url') !== encodedPayload) return false;
    const decoded = payloadBytes.toString('utf8');
    const candidate = JSON.parse(decoded) as unknown;
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      return false;
    }
    const record = candidate as Record<string, unknown>;
    const allowedKeys = new Set(['c', 'i', 'k', 'n', 'p', 'r']);
    if (Object.keys(record).some((key) => !allowedKeys.has(key))) return false;
    if (
      typeof record['c'] !== 'string' ||
      !UUID_V4_PATTERN.test(record['c']) ||
      !Number.isSafeInteger(record['i']) ||
      (record['i'] as number) < 0 ||
      !Number.isSafeInteger(record['k']) ||
      (record['k'] as number) <= 0 ||
      (record['k'] as number) > 32_767 ||
      record['p'] !== 'founder_stop' ||
      !optionalIdentifier(record['n']) ||
      !optionalIdentifier(record['r'])
    ) {
      return false;
    }
    const payload: FounderStopWirePayload = {
      c: record['c'],
      i: record['i'] as number,
      k: record['k'] as number,
      ...(record['n'] === undefined ? {} : { n: record['n'] as string }),
      p: record['p'],
      ...(record['r'] === undefined ? {} : { r: record['r'] as string }),
    };
    return canonicalFounderStopPayload(payload) === decoded;
  } catch {
    return false;
  }
}

const FounderStopUrlSchema = z
  .string()
  .min(1)
  .max(1_500)
  .superRefine((value, context) => {
    let valid = false;
    try {
      const url = new URL(value);
      const entries = [...url.searchParams.entries()];
      const token = entries[0]?.[1] ?? '';
      valid =
        url.origin === 'https://threadplane.ai' &&
        url.pathname === '/api/growth/stop' &&
        url.username === '' &&
        url.password === '' &&
        url.hash === '' &&
        entries.length === 1 &&
        entries[0]?.[0] === 'token' &&
        token.length <= 1_200 &&
        validFounderStopTokenEnvelope(token) &&
        !/[\r\n]/u.test(value);
    } catch {
      valid = false;
    }
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'founder stop URL must be a bounded Threadplane HTTPS URL',
      });
    }
  });

const DraftPreviewSchema = z
  .object({
    subject: z.string().min(1).max(80),
    body: z.string().min(1).max(1_200),
  })
  .strict();

const InternalNotificationInputSchema = z
  .object({
    scoreVersion: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u),
    scoreReasons: z.array(DeterministicScoreReasonSchema).max(10),
    evidenceSourceUrls: z.array(EvidenceSourceUrlSchema).max(3),
    drafts: z.array(DraftPreviewSchema).length(3),
    founderStopUrl: FounderStopUrlSchema,
  })
  .strict();

export type InternalNotificationInput = z.infer<
  typeof InternalNotificationInputSchema
>;

const DRAFT_PREVIEW_LENGTH = 180;

function compactPreview(value: string): string {
  const compact = value.replace(/\s+/gu, ' ').trim();
  return compact.length <= DRAFT_PREVIEW_LENGTH
    ? compact
    : `${compact.slice(0, DRAFT_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function draftPreview(
  draft: InternalNotificationInput['drafts'][number],
  index: number
): string {
  try {
    const normalized = normalizeCampaignDraft(draft);
    return `Draft ${index + 1} — ${normalized.subject}\n${compactPreview(
      normalized.body
    )}`;
  } catch {
    return `Draft ${index + 1} — rejected by recipient-copy checks`;
  }
}

export function renderInternalNotificationSummary(candidate: unknown): string {
  const input = InternalNotificationInputSchema.parse(candidate);
  const reasons =
    input.scoreReasons.length === 0
      ? '- none'
      : input.scoreReasons
          .map((reason) => `- ${reason.code}: ${reason.points} points`)
          .join('\n');
  const sources =
    input.evidenceSourceUrls.length === 0
      ? '- none'
      : input.evidenceSourceUrls.map((url) => `- ${url}`).join('\n');
  const previews = input.drafts
    .map((draft, index) => draftPreview(draft, index))
    .join('\n\n');

  return [
    'Review only',
    'This review summary does not authorize or schedule any recipient email.',
    '',
    `Score version: ${input.scoreVersion}`,
    'Score reasons:',
    reasons,
    '',
    'Evidence sources:',
    sources,
    '',
    'Draft previews:',
    previews,
    '',
    'Review or stop this contact (short-lived URL):',
    input.founderStopUrl,
  ].join('\n');
}
