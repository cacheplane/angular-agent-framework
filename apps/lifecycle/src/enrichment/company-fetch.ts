import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import type {
  ClientRequest,
  IncomingHttpHeaders,
  IncomingMessage,
} from 'node:http';
import {
  request as nodeHttpsRequest,
  type RequestOptions as HttpsRequestOptions,
} from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';

import {
  CompanyPageEvidenceSchema,
  type CompanyPageEvidence,
} from './schema.js';

const PAGE_PATHS = ['/', '/about', '/pricing'] as const;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 250 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface CompanyRequestInit extends RequestInit {
  resolvedAddresses: readonly string[];
}

export interface CompanyFetchDependencies {
  resolve: (
    hostname: string,
    signal: AbortSignal
  ) => Promise<readonly string[]>;
  fetch: (url: URL, init: CompanyRequestInit) => Promise<Response>;
  now: () => Date;
  createTimeoutSignal: (
    parentSignal: AbortSignal,
    timeoutMs: number
  ) => { signal: AbortSignal; clear: () => void };
}

export type HttpsRequestFactory = (
  options: HttpsRequestOptions,
  callback: (response: IncomingMessage) => void
) => ClientRequest;

export interface CompanyFetchOverrides
  extends Partial<CompanyFetchDependencies> {
  request?: HttpsRequestFactory;
}

function defaultTimeoutSignal(
  parentSignal: AbortSignal,
  timeoutMs: number
): { signal: AbortSignal; clear: () => void } {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort(
      new DOMException('Company request timed out', 'TimeoutError')
    );
  }, timeoutMs);
  return {
    signal: AbortSignal.any([parentSignal, timeout.signal]),
    clear: () => clearTimeout(timer),
  };
}

export interface NodeResolverLike {
  cancel: () => void;
  resolve4: (hostname: string) => Promise<string[]>;
  resolve6: (hostname: string) => Promise<string[]>;
}

export async function resolveWithNodeDns(
  hostname: string,
  signal: AbortSignal,
  createResolver: () => NodeResolverLike = () => new Resolver()
): Promise<readonly string[]> {
  signal.throwIfAborted();
  const resolver = createResolver();

  return new Promise<readonly string[]>((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void): void => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = (): void => {
      resolver.cancel();
      finish(() =>
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      );
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    void Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname),
    ]).then((results) => {
      finish(() => {
        const addresses = results.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : []
        );
        if (addresses.length === 0) {
          const failure = results.find(
            (result): result is PromiseRejectedResult =>
              result.status === 'rejected'
          );
          reject(
            new Error('Company domain DNS resolution failed', {
              cause: failure?.reason,
            })
          );
          return;
        }
        resolve([...new Set(addresses)]);
      });
    });
  });
}

function responseHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
}

function incomingMessageBody(
  incoming: IncomingMessage
): ReadableStream<Uint8Array> {
  const reader = (
    Readable.toWeb(incoming) as ReadableStream<Uint8Array>
  ).getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        reader.releaseLock();
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        if (!incoming.destroyed) {
          incoming.destroy(reason instanceof Error ? reason : undefined);
        }
      }
    },
  });
}

function pinnedHttpsFetch(
  url: URL,
  init: CompanyRequestInit,
  request: HttpsRequestFactory
): Promise<Response> {
  const address = init.resolvedAddresses[0];
  if (!address || !isPublicAddress(address)) {
    throw new Error('Pinned HTTPS request requires a validated public address');
  }
  const headers = new Headers(init.headers);
  headers.set('host', url.hostname);

  return new Promise<Response>((resolve, reject) => {
    const clientRequest = request(
      {
        agent: false,
        family: isIP(address),
        headers: Object.fromEntries(headers.entries()),
        hostname: address,
        method: init.method ?? 'GET',
        path: `${url.pathname}${url.search}`,
        port: 443,
        rejectUnauthorized: true,
        servername: url.hostname,
        signal: init.signal ?? undefined,
      },
      (incoming) => {
        try {
          const status = incoming.statusCode ?? 502;
          const body = [204, 205, 304].includes(status)
            ? null
            : incomingMessageBody(incoming);
          resolve(
            new Response(body, {
              headers: responseHeaders(incoming.headers),
              status,
              statusText: incoming.statusMessage,
            })
          );
        } catch (error) {
          try {
            incoming.destroy();
          } catch {
            // Cleanup must not replace the response-construction error.
          }
          reject(error);
        }
      }
    );
    clientRequest.once('error', reject);
    clientRequest.end();
  });
}

function completeDependencies(
  overrides: CompanyFetchOverrides
): CompanyFetchDependencies {
  const request = overrides.request ?? nodeHttpsRequest;
  return {
    resolve: overrides.resolve ?? resolveWithNodeDns,
    fetch:
      overrides.fetch ?? ((url, init) => pinnedHttpsFetch(url, init, request)),
    now: overrides.now ?? (() => new Date()),
    createTimeoutSignal: overrides.createTimeoutSignal ?? defaultTimeoutSignal,
  };
}

function validatedCompanyHostname(companyDomain: string): string {
  if (
    companyDomain !== companyDomain.trim() ||
    companyDomain.length > 253 ||
    isIP(companyDomain) !== 0 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(
      companyDomain
    )
  ) {
    throw new Error('Invalid company_domain');
  }
  return companyDomain.toLowerCase();
}

function ipv4Bytes(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split('.').map(Number);
}

function ipv6Words(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  const expand = (part: string): number[] => {
    if (!part) return [];
    const tokens = part.split(':');
    const words: number[] = [];
    for (const token of tokens) {
      if (token.includes('.')) {
        const bytes = ipv4Bytes(token);
        if (!bytes) return [];
        words.push((bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3]);
      } else {
        words.push(Number.parseInt(token, 16));
      }
    }
    return words;
  };
  const pieces = address.toLowerCase().split('::');
  const left = expand(pieces[0] ?? '');
  const right = expand(pieces[1] ?? '');
  if (pieces.length === 1) return left.length === 8 ? left : null;
  if (pieces.length !== 2 || left.length + right.length >= 8) return null;
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

function inIpv4Range(bytes: number[], prefix: number[], bits: number): boolean {
  const addressValue =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const prefixValue =
    ((prefix[0] << 24) | (prefix[1] << 16) | (prefix[2] << 8) | prefix[3]) >>>
    0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (addressValue & mask) === (prefixValue & mask);
}

function inIpv6Range(words: number[], prefix: number[], bits: number): boolean {
  const completeWords = Math.floor(bits / 16);
  for (let index = 0; index < completeWords; index += 1) {
    if (words[index] !== prefix[index]) return false;
  }
  const remainingBits = bits % 16;
  if (remainingBits === 0) return true;
  const mask = (0xffff << (16 - remainingBits)) & 0xffff;
  return (words[completeWords] & mask) === (prefix[completeWords] & mask);
}

const UNSAFE_IPV4_RANGES: ReadonlyArray<readonly [number[], number]> = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

function isPublicAddress(address: string): boolean {
  const ipv4 = ipv4Bytes(address);
  if (ipv4) {
    return !UNSAFE_IPV4_RANGES.some(([prefix, bits]) =>
      inIpv4Range(ipv4, prefix, bits)
    );
  }

  const ipv6 = ipv6Words(address);
  if (!ipv6) return false;
  if (!inIpv6Range(ipv6, [0x2000], 3)) return false;
  const excluded: ReadonlyArray<readonly [number[], number]> = [
    [[0x2001, 0x0000], 23],
    [[0x2001, 0x0db8], 32],
    [[0x2002], 16],
    [[0x3ffe], 16],
    [[0x3fff], 20],
  ];
  return !excluded.some(([prefix, bits]) => inIpv6Range(ipv6, prefix, bits));
}

async function resolvePublicAddresses(
  hostname: string,
  signal: AbortSignal,
  dependencies: CompanyFetchDependencies
): Promise<readonly string[]> {
  const addresses = await dependencies.resolve(hostname, signal);
  signal.throwIfAborted();
  if (addresses.length === 0) throw new Error('Company domain did not resolve');
  for (const address of addresses) {
    if (!isPublicAddress(address)) {
      throw new Error(`Company domain resolved to unsafe address: ${address}`);
    }
  }
  return addresses;
}

function validatedRedirectUrl(
  location: string,
  current: URL,
  hostname: string
): URL {
  let redirect: URL;
  try {
    redirect = new URL(location, current);
  } catch {
    throw new Error('Invalid company redirect');
  }
  if (
    redirect.protocol !== 'https:' ||
    redirect.username !== '' ||
    redirect.password !== '' ||
    (redirect.port !== '' && redirect.port !== '443') ||
    redirect.hostname.toLowerCase() !== hostname
  ) {
    throw new Error('Unsafe company redirect');
  }
  return redirect;
}

async function cancelResponseBody(
  response: Response,
  reason?: unknown
): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel(reason);
  } catch {
    // Disposal failures must not replace the original fetch policy error.
  }
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const advertisedLength = response.headers.get('content-length');
  if (
    advertisedLength !== null &&
    Number.parseInt(advertisedLength, 10) > MAX_PAGE_BYTES
  ) {
    await cancelResponseBody(response);
    throw new Error('Company page exceeds 250 KiB');
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PAGE_BYTES) {
        throw new Error('Company page exceeds 250 KiB');
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // Preserve the read or policy error that caused disposal.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&(?:nbsp|#160);/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 240);
}

function matches(html: string, expression: RegExp, limit: number): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(expression)) {
    const value = cleanText(match[1] ?? '');
    if (value && !values.includes(value)) values.push(value);
    if (values.length === limit) break;
  }
  return values;
}

function extractEvidence(
  body: Uint8Array
): Pick<CompanyPageEvidence, 'facts' | 'snippets'> {
  const html = new TextDecoder('utf-8', { fatal: false }).decode(body);
  const withoutExecutableContent = html.replace(
    /<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>/giu,
    ' '
  );
  const facts = [
    ...matches(
      withoutExecutableContent,
      /<title\b[^>]*>([\s\S]*?)<\/title>/giu,
      1
    ),
    ...matches(withoutExecutableContent, /<h1\b[^>]*>([\s\S]*?)<\/h1>/giu, 3),
    ...matches(
      withoutExecutableContent,
      /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/giu,
      2
    ),
  ].slice(0, 6);
  const snippets = matches(
    withoutExecutableContent,
    /<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/giu,
    6
  );
  return { facts, snippets };
}

export async function fetchCompanyEvidence(
  companyDomain: string,
  signal: AbortSignal,
  overrides: CompanyFetchOverrides = {}
): Promise<CompanyPageEvidence[]> {
  const dependencies = completeDependencies(overrides);
  const hostname = validatedCompanyHostname(companyDomain);
  signal.throwIfAborted();
  let redirects = 0;
  const evidence: CompanyPageEvidence[] = [];

  for (const path of PAGE_PATHS) {
    let currentUrl = new URL(path, `https://${hostname}/`);
    const timeout = dependencies.createTimeoutSignal(
      signal,
      REQUEST_TIMEOUT_MS
    );
    try {
      while (true) {
        signal.throwIfAborted();
        const addresses = await resolvePublicAddresses(
          hostname,
          timeout.signal,
          dependencies
        );
        const response = await dependencies.fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: timeout.signal,
          resolvedAddresses: addresses,
          headers: {
            accept: 'text/html,text/plain;q=0.8',
            'user-agent': 'ThreadplaneCompanyResearch/1.0',
          },
        });
        if (REDIRECT_STATUSES.has(response.status)) {
          const location = response.headers.get('location');
          await cancelResponseBody(response);
          if (!location)
            throw new Error('Company redirect is missing Location');
          redirects += 1;
          if (redirects > MAX_REDIRECTS) {
            throw new Error('Company redirect limit exceeded');
          }
          currentUrl = validatedRedirectUrl(location, currentUrl, hostname);
          continue;
        }
        if (!response.ok) {
          await cancelResponseBody(response);
          throw new Error(`Company page returned HTTP ${response.status}`);
        }
        const body = await readBoundedBody(response);
        evidence.push(
          CompanyPageEvidenceSchema.parse({
            canonicalUrl: currentUrl.toString(),
            retrievedAt: dependencies.now().toISOString(),
            contentHash: createHash('sha256').update(body).digest('hex'),
            ...extractEvidence(body),
          })
        );
        break;
      }
    } finally {
      timeout.clear();
    }
  }

  return evidence;
}
