import { fetchFirecrawlCompanyEvidence } from './firecrawl.js';
import type { CompanyPageEvidence } from './schema.js';

function report(diagnostic: object): void {
  try {
    console.info('company_capture', diagnostic);
  } catch {
    // Observability must not change capture behavior.
  }
}

export function createCompanyCapture(
  environment: Record<string, string | undefined>
): (domain: string, signal: AbortSignal) => Promise<CompanyPageEvidence[]> {
  return async (domain, signal) => {
    signal.throwIfAborted();
    const secret = environment['COMPANY_SCRAPER_SECRET']?.trim();
    if (!secret) {
      report({ provider: 'firecrawl', outcome: 'missing_key' });
      signal.throwIfAborted();
      throw new Error('company_capture_missing_key');
    }
    const evidence = await fetchFirecrawlCompanyEvidence(domain, signal, {
      secret,
      serviceUrl: environment['COMPANY_SCRAPER_URL'] ?? '',
      allowLocalHttp:
        environment['NODE_ENV'] === 'development' ||
        environment['NODE_ENV'] === 'test',
      onDiagnostic: report,
    });
    signal.throwIfAborted();
    return evidence;
  };
}
