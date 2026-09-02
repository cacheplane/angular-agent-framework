// The website intentionally consumes the growth library through its internal boundary.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createDatabaseExecutor,
  parseGoogleMailboxEvent,
  processGoogleMailboxEvent,
  sha256Base64Url,
  verifyGoogleReplySignature,
  type GoogleMailboxEvent,
  type ProcessGoogleMailboxEventInput,
  type ProcessGoogleMailboxEventResult,
  type SqlExecutor,
} from '@threadplane-internal/growth';

import { readBoundedBody } from '../../../_internal/read-bounded-body';

const MAX_BODY_BYTES = 32_768;
const MAX_HEADER_LENGTH = 256;

interface GoogleRepliesRouteDependencies {
  now: () => Date;
  loadSecret: () => string;
  verifySignature: typeof verifyGoogleReplySignature;
  parseEvent: (rawBody: string) => GoogleMailboxEvent;
  createDatabase: () => SqlExecutor;
  processEvent: (
    executor: SqlExecutor,
    input: ProcessGoogleMailboxEventInput
  ) => Promise<ProcessGoogleMailboxEventResult>;
}

function response(status: number): Response {
  return new Response(
    status === 200 ? 'Accepted' : 'Unable to process request',
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    }
  );
}

function requiredHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.trim() ?? '';
  if (
    value.length === 0 ||
    value.length > MAX_HEADER_LENGTH ||
    /[\r\n\0]/u.test(value)
  ) {
    return null;
  }
  return value;
}

function isJson(request: Request): boolean {
  return (
    request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase() === 'application/json'
  );
}

function defaultDependencies(): GoogleRepliesRouteDependencies {
  return {
    now: () => new Date(),
    loadSecret: () => process.env['GOOGLE_REPLY_HMAC_SECRET'] ?? '',
    verifySignature: verifyGoogleReplySignature,
    parseEvent: parseGoogleMailboxEvent,
    createDatabase: () => createDatabaseExecutor(),
    processEvent: processGoogleMailboxEvent,
  };
}

export function createGoogleRepliesRoute(
  dependencies: GoogleRepliesRouteDependencies = defaultDependencies()
): { POST: (request: Request) => Promise<Response> } {
  return {
    async POST(request: Request): Promise<Response> {
      if (!isJson(request)) return response(400);
      const timestamp = requiredHeader(request, 'x-threadplane-timestamp');
      const nonce = requiredHeader(request, 'x-threadplane-nonce');
      const signature = requiredHeader(request, 'x-threadplane-signature');
      if (!timestamp || !nonce || !signature) return response(400);

      const rawBody = await readBoundedBody(request, MAX_BODY_BYTES);
      if (rawBody === null) return response(413);

      let secret: string;
      const receivedAt = dependencies.now();
      try {
        secret = dependencies.loadSecret();
        dependencies.verifySignature({
          rawBody,
          timestamp,
          nonce,
          signature,
          secret,
          now: receivedAt,
        });
      } catch {
        return response(400);
      }

      let event: GoogleMailboxEvent;
      try {
        event = dependencies.parseEvent(rawBody);
      } catch {
        return response(400);
      }

      let database: SqlExecutor;
      try {
        database = dependencies.createDatabase();
      } catch {
        return response(503);
      }
      try {
        await dependencies.processEvent(database, {
          event,
          nonce,
          timestamp,
          requestDigest: sha256Base64Url(rawBody),
          receivedAt,
        });
        return response(200);
      } catch {
        // Authentication/schema failures are terminal 400 responses above.
        // Once the request reaches persistence, failures are retryable
        // infrastructure errors; authenticated domain rejections resolve 200.
        return response(503);
      } finally {
        await database.close?.();
      }
    },
  };
}

export const { POST } = createGoogleRepliesRoute();
