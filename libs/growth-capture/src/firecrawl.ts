import { createHash } from 'node:crypto';
import {
  CompanyFetchSecurityError,
  extractEvidence,
  validatePublicCompanyHostname,
  type CompanyHostnameResolver,
} from './company-fetch.js';
import {
  CompanyPageEvidenceSchema,
  type CompanyPageEvidence,
} from './schema.js';

const MAX_BYTES = 2 * 1024 * 1024;
type Failure =
  | 'configuration'
  | 'security_rejected'
  | 'invalid_response'
  | 'invalid_provenance'
  | 'api_http_error'
  | 'page_http_error'
  | 'response_too_large'
  | 'timeout'
  | 'transport_failure';
export interface FirecrawlDiagnostic {
  provider: 'firecrawl';
  outcome: 'captured' | 'no_evidence' | Failure;
  apiStatus?: number;
  pageStatus?: number;
  bytes?: number;
}
export interface FirecrawlOptions {
  serviceUrl: string;
  secret: string;
  allowLocalHttp?: boolean;
  fetch?: typeof fetch;
  resolve?: CompanyHostnameResolver;
  now?: () => Date;
  onDiagnostic?: (diagnostic: FirecrawlDiagnostic) => void;
}
class FirecrawlError extends Error {
  constructor(readonly code: Failure) {
    super(code);
    this.name = 'FirecrawlError';
  }
}

function serviceEndpoint(value: string, allowLocalHttp = false): string {
  try {
    const url = new URL(value);
    const loopback =
      allowLocalHttp &&
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === '[::1]');
    if (
      value !== value.trim() ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      value.includes('?') ||
      value.includes('#') ||
      url.hostname === 'api.firecrawl.dev' ||
      (!loopback && (url.protocol !== 'https:' || url.port))
    ) {
      throw new Error();
    }
    return new URL('/scrape', url).toString();
  } catch {
    throw new FirecrawlError('configuration');
  }
}

// Race every asynchronous stage, including injected transports and stalled bodies.
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

function safeUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 500 || value !== value.trim())
    throw new FirecrawlError('invalid_provenance');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FirecrawlError('invalid_provenance');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    value.includes('?') ||
    value.includes('#')
  )
    throw new FirecrawlError('invalid_provenance');
  return url;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FirecrawlError('invalid_response');
  return value as Record<string, unknown>;
}
function dispose(body: ReadableStream<Uint8Array> | null): void {
  if (body)
    void body.cancel().catch(() => {
      /* Best-effort disposal. */
    });
}
async function boundedJson(
  response: Response,
  signal: AbortSignal,
  diagnostic: FirecrawlDiagnostic
): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    diagnostic.bytes = Math.min(length, Number.MAX_SAFE_INTEGER);
    dispose(response.body);
    throw new FirecrawlError('response_too_large');
  }
  if (!response.body) throw new FirecrawlError('invalid_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      signal.throwIfAborted();
      if (done) break;
      bytes += value.byteLength;
      diagnostic.bytes = bytes;
      if (bytes > MAX_BYTES) throw new FirecrawlError('response_too_large');
      chunks.push(value);
    }
  } catch (error) {
    // Cleanup must not extend the deadline if cancellation itself stalls.
    void reader.cancel().catch(() => {
      /* Preserve the read failure. */
    });
    throw error;
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks, bytes);
  try {
    return JSON.parse(body.toString('utf8')) as unknown;
  } catch {
    throw new FirecrawlError('invalid_response');
  }
}

/** One fresh homepage scrape; errors are code-only so the campaign can retry safely. */
export async function fetchFirecrawlCompanyEvidence(
  domain: string,
  signal: AbortSignal,
  options: FirecrawlOptions
): Promise<CompanyPageEvidence[]> {
  const deadline = new AbortController();
  const timer = setTimeout(
    () => deadline.abort(new FirecrawlError('timeout')),
    15_000
  );
  const combined = AbortSignal.any([signal, deadline.signal]);
  const diagnostic: FirecrawlDiagnostic = {
    provider: 'firecrawl',
    outcome: 'transport_failure',
  };
  const report = () => {
    try {
      options.onDiagnostic?.({ ...diagnostic });
    } catch {
      /* Observational only. */
    }
  };
  try {
    combined.throwIfAborted();
    if (!options.secret || /\s/u.test(options.secret))
      throw new FirecrawlError('configuration');
    const endpoint = serviceEndpoint(
      options.serviceUrl,
      options.allowLocalHttp
    );
    const hostname = await abortable(
      validatePublicCompanyHostname(domain, combined, options.resolve),
      combined
    );
    combined.throwIfAborted();
    const requestedUrl = `https://${hostname}/`;
    const pending = (options.fetch ?? fetch)(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: combined,
      headers: {
        authorization: `Bearer ${options.secret}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        url: requestedUrl,
      }),
    });
    void pending.then(
      (response) => {
        if (combined.aborted) dispose(response.body);
      },
      () => {
        /* The awaited request below handles transport errors. */
      }
    );
    const response = await abortable(pending, combined);
    combined.throwIfAborted();
    diagnostic.apiStatus = response.status;
    if (!response.ok) {
      dispose(response.body);
      throw new FirecrawlError('api_http_error');
    }
    const result = record(await boundedJson(response, combined, diagnostic));
    combined.throwIfAborted();
    const source = safeUrl(result.sourceURL);
    const final = safeUrl(result.url);
    if (source.toString() !== requestedUrl)
      throw new FirecrawlError('invalid_provenance');
    await abortable(
      validatePublicCompanyHostname(final.hostname, combined, options.resolve),
      combined
    );
    combined.throwIfAborted();
    const status = result.pageStatusCode;
    if (
      typeof status !== 'number' ||
      !Number.isInteger(status) ||
      status < 100 ||
      status > 599
    )
      throw new FirecrawlError('invalid_response');
    diagnostic.pageStatus = status;
    if (status !== 404 && (status < 200 || status >= 300))
      throw new FirecrawlError('page_http_error');
    if (status === 404) {
      diagnostic.outcome = 'no_evidence';
      report();
      combined.throwIfAborted();
      return [];
    }
    if (typeof result.content !== 'string')
      throw new FirecrawlError('invalid_response');
    const body = Buffer.from(result.content, 'utf8');
    const extracted = extractEvidence(body);
    if (!extracted.facts.length && !extracted.snippets.length) {
      diagnostic.outcome = 'no_evidence';
      report();
      combined.throwIfAborted();
      return [];
    }
    const evidence = CompanyPageEvidenceSchema.parse({
      canonicalUrl: final.toString(),
      retrievedAt: (options.now ?? (() => new Date()))().toISOString(),
      contentHash: createHash('sha256').update(body).digest('hex'),
      ...extracted,
    });
    combined.throwIfAborted();
    diagnostic.outcome = 'captured';
    report();
    combined.throwIfAborted();
    return [evidence];
  } catch (error) {
    signal.throwIfAborted();
    const failure = deadline.signal.aborted
      ? new FirecrawlError('timeout')
      : error instanceof FirecrawlError
      ? error
      : new FirecrawlError(
          error instanceof CompanyFetchSecurityError
            ? 'security_rejected'
            : 'transport_failure'
        );
    diagnostic.outcome = failure.code;
    report();
    signal.throwIfAborted();
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}
