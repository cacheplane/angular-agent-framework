import {
  fetchFirecrawlCompanyEvidence,
  type FirecrawlDiagnostic,
} from './firecrawl.js';
import type { CompanyPageEvidence } from './schema.js';

export type CompanyCaptureDiagnostic =
  | FirecrawlDiagnostic
  | { provider: 'firecrawl'; outcome: 'missing_key' };

function report(
  diagnostic: CompanyCaptureDiagnostic,
  observer?: (diagnostic: CompanyCaptureDiagnostic) => void
): void {
  try {
    console.info('company_capture', diagnostic);
  } catch {
    // Observability must not change capture behavior.
  }
  try {
    observer?.(diagnostic);
  } catch {
    // An optional observer must not change capture behavior either.
  }
}

export function createCompanyCapture(
  environment: Record<string, string | undefined>,
  onDiagnostic?: (diagnostic: CompanyCaptureDiagnostic) => void
): (domain: string, signal: AbortSignal) => Promise<CompanyPageEvidence[]> {
  return async (domain, signal) => {
    signal.throwIfAborted();
    const secret = environment['COMPANY_SCRAPER_SECRET']?.trim();
    if (!secret) {
      report({ provider: 'firecrawl', outcome: 'missing_key' }, onDiagnostic);
      signal.throwIfAborted();
      throw new Error('company_capture_missing_key');
    }
    const evidence = await fetchFirecrawlCompanyEvidence(domain, signal, {
      secret,
      serviceUrl: environment['COMPANY_SCRAPER_URL'] ?? '',
      allowLocalHttp:
        environment['NODE_ENV'] === 'development' ||
        environment['NODE_ENV'] === 'test',
      onDiagnostic: (diagnostic) => report(diagnostic, onDiagnostic),
    });
    signal.throwIfAborted();
    return evidence;
  };
}
