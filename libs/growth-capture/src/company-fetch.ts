import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

import { parse, type DefaultTreeAdapterTypes } from 'parse5';

import type { CompanyPageEvidence } from './schema.js';

// Raised when a target fails the SSRF controls. Unlike a transport or
// content failure, a security violation never degrades to "no evidence";
// it propagates so the caller can treat the domain as suspect.
export class CompanyFetchSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyFetchSecurityError';
  }
}

export type CompanyHostnameResolver = (
  hostname: string,
  signal: AbortSignal
) => Promise<readonly string[]>;

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

function validatedCompanyHostname(companyDomain: string): string {
  if (
    companyDomain !== companyDomain.trim() ||
    companyDomain.length > 253 ||
    isIP(companyDomain) !== 0 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(
      companyDomain
    )
  ) {
    throw new CompanyFetchSecurityError('Invalid company_domain');
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
  resolve: CompanyHostnameResolver
): Promise<readonly string[]> {
  const addresses = await resolve(hostname, signal);
  signal.throwIfAborted();
  if (addresses.length === 0) throw new Error('Company domain did not resolve');
  for (const address of addresses) {
    if (!isPublicAddress(address)) {
      throw new CompanyFetchSecurityError(
        `Company domain resolved to unsafe address: ${address}`
      );
    }
  }
  return addresses;
}

/** Validate company hostnames against the shared public-address policy. */
export async function validatePublicCompanyHostname(
  domain: string,
  signal: AbortSignal,
  resolve: CompanyHostnameResolver = resolveWithNodeDns
): Promise<string> {
  const hostname = validatedCompanyHostname(domain);
  signal.throwIfAborted();
  await resolvePublicAddresses(hostname, signal, resolve);
  return hostname;
}

function cleanText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 240);
}

const EXECUTABLE_ELEMENTS = new Set(['script', 'style', 'noscript']);
const CHROME_ROLES = new Set(['navigation', 'menu', 'menubar', 'contentinfo']);

function excludesEvidence(element: DefaultTreeAdapterTypes.Element): boolean {
  // Header lists commonly hold navigation without a nav landmark. Keep hero
  // headings and paragraphs, and keep product lists elsewhere in the page.
  if (element.tagName === 'ul' || element.tagName === 'ol') {
    let parent = element.parentNode;
    while (parent) {
      if ('tagName' in parent && parent.tagName === 'header') return true;
      parent = 'parentNode' in parent ? parent.parentNode : null;
    }
  }
  return (
    EXECUTABLE_ELEMENTS.has(element.tagName) ||
    element.tagName === 'nav' ||
    element.tagName === 'footer' ||
    (element.attrs.find((attribute) => attribute.name === 'role')?.value ?? '')
      .toLowerCase()
      .split(/\s+/u)
      .some((role) => CHROME_ROLES.has(role))
  );
}

function nodeText(node: DefaultTreeAdapterTypes.Node): string {
  const text: string[] = [];
  const pending: DefaultTreeAdapterTypes.Node[] = [node];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate) break;
    if ('tagName' in candidate && excludesEvidence(candidate)) {
      continue;
    }
    if (candidate.nodeName === '#text') {
      text.push((candidate as DefaultTreeAdapterTypes.TextNode).value);
      continue;
    }
    if ('childNodes' in candidate) {
      for (
        let index = candidate.childNodes.length - 1;
        index >= 0;
        index -= 1
      ) {
        const child = candidate.childNodes[index];
        if (child) pending.push(child);
      }
    }
  }
  return text.join(' ');
}

function collectElements(
  node: DefaultTreeAdapterTypes.Node,
  tagNames: ReadonlySet<string>,
  stopAtMatch = false
): DefaultTreeAdapterTypes.Element[] {
  const elements: DefaultTreeAdapterTypes.Element[] = [];
  const pending: DefaultTreeAdapterTypes.Node[] = [node];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate) break;
    if ('tagName' in candidate) {
      if (excludesEvidence(candidate)) continue;
      if (tagNames.has(candidate.tagName)) {
        elements.push(candidate);
        if (stopAtMatch) continue;
      }
    }
    if ('childNodes' in candidate) {
      for (
        let index = candidate.childNodes.length - 1;
        index >= 0;
        index -= 1
      ) {
        const child = candidate.childNodes[index];
        if (child) pending.push(child);
      }
    }
  }
  return elements;
}

function textValues(
  roots: DefaultTreeAdapterTypes.Node[],
  tagNames: string | readonly string[],
  limit: number
): string[] {
  const values: string[] = [];
  const selectedTags = new Set(
    typeof tagNames === 'string' ? [tagNames] : tagNames
  );
  for (const element of roots.flatMap((root) =>
    collectElements(root, selectedTags)
  )) {
    const value = cleanText(nodeText(element));
    if (value && !values.includes(value)) values.push(value);
    if (values.length === limit) break;
  }
  return values;
}

function descriptionValues(
  document: DefaultTreeAdapterTypes.Document,
  limit: number
): string[] {
  const values: string[] = [];
  for (const element of collectElements(document, new Set(['meta']))) {
    const attributes = new Map(
      element.attrs.map((attribute) => [
        attribute.name.toLowerCase(),
        attribute.value,
      ])
    );
    if (attributes.get('name')?.toLowerCase() !== 'description') continue;
    const value = cleanText(attributes.get('content') ?? '');
    if (value && !values.includes(value)) values.push(value);
    if (values.length === limit) break;
  }
  return values;
}

export function extractEvidence(
  body: Uint8Array
): Pick<CompanyPageEvidence, 'facts' | 'snippets'> {
  const html = new TextDecoder('utf-8', { fatal: false }).decode(body);
  const document = parse(html);
  const facts = [
    ...textValues([document], 'title', 1),
    ...textValues([document], 'h1', 3),
    ...descriptionValues(document, 2),
  ].slice(0, 6);
  const mainSnippets = textValues(
    // Nested main elements share one root; do not repeatedly scan their subtree.
    collectElements(document, new Set(['main']), true),
    ['p', 'li'],
    6
  );
  // Some sites put substantive hero content outside an empty main landmark.
  const snippets = mainSnippets.length
    ? mainSnippets
    : textValues([document], ['p', 'li'], 6);
  return { facts, snippets };
}
