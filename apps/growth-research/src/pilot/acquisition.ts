import { fetchCompanyEvidence } from '../../../lifecycle/src/enrichment/company-fetch.js';
import type { CompanyPageEvidence } from '../../../lifecycle/src/enrichment/schema.js';

const expectedPaths = ['/', '/about', '/pricing'];
export async function acquireCompanies(
  domains: string[],
  signal: AbortSignal,
  capture: (
    domain: string,
    signal: AbortSignal
  ) => Promise<CompanyPageEvidence[]> = fetchCompanyEvidence
) {
  if (
    domains.length < 1 ||
    domains.length > 6 ||
    new Set(domains).size !== domains.length ||
    domains.some(
      (domain) =>
        domain.length > 253 ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)
    )
  )
    throw new Error('pilot_invalid_domains');
  const cases: {
    id: string;
    kind: 'public';
    domain: string;
    pages: CompanyPageEvidence[];
    expected: { claims: string[]; unknowns: []; contradiction: boolean };
    acquisitionError?: string;
  }[] = [];
  const captures: {
    caseId: string;
    status: 'complete' | 'partial' | 'empty' | 'failed';
    unavailablePaths: string[];
    reason: 'unavailable' | 'capture_failed' | null;
    redirectedPathsIndeterminate: boolean;
    filteredIdentityItems: number;
  }[] = [];
  for (const [index, domain] of domains.entries()) {
    signal.throwIfAborted();
    const id = `public-${index + 1}`;
    let pages: CompanyPageEvidence[] = [],
      failed = false;
    try {
      pages = await capture(domain, signal);
    } catch {
      signal.throwIfAborted();
      failed = true;
    }
    let filteredIdentityItems = 0;
    const safeExcerpt = (text: string) => {
      if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
        filteredIdentityItems++;
        return false;
      }
      return true;
    };
    pages = pages.map((page) => ({
      ...page,
      facts: page.facts.filter(safeExcerpt),
      snippets: page.snippets.filter(safeExcerpt),
    }));
    const paths = pages.map((page) => new URL(page.canonicalUrl).pathname);
    const unavailablePaths = expectedPaths.filter(
      (path) => !paths.includes(path)
    );
    cases.push({
      id,
      kind: 'public',
      domain,
      pages,
      expected: { claims: [], unknowns: [], contradiction: false },
      ...(failed ? { acquisitionError: 'capture_failed' } : {}),
    });
    captures.push({
      caseId: id,
      status: failed
        ? 'failed'
        : !pages.length
        ? 'empty'
        : pages.length === 3
        ? 'complete'
        : 'partial',
      unavailablePaths,
      reason: failed
        ? 'capture_failed'
        : unavailablePaths.length
        ? 'unavailable'
        : null,
      redirectedPathsIndeterminate: paths.some(
        (path) => !expectedPaths.includes(path)
      ),
      filteredIdentityItems,
    });
  }
  return {
    version: 'company-public-v1',
    repetitions: 2 as const,
    cases,
    captures,
  };
}
