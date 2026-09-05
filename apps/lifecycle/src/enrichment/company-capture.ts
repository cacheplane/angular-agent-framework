import { fetchCompanyEvidence } from './company-fetch.js';
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
    const provider = environment['LIFECYCLE_COMPANY_CAPTURE_PROVIDER'];
    let evidence: CompanyPageEvidence[];
    if (provider === undefined || provider === 'direct') {
      evidence = await fetchCompanyEvidence(domain, signal, {
        onDiagnostic: (diagnostic) =>
          report({ provider: 'direct', ...diagnostic }),
      });
    } else if (provider === 'firecrawl') {
      const apiKey = environment['FIRECRAWL_API_KEY']?.trim();
      if (!apiKey) {
        report({ provider: 'firecrawl', outcome: 'missing_key' });
        signal.throwIfAborted();
        throw new Error('company_capture_missing_key');
      }
      evidence = await fetchFirecrawlCompanyEvidence(domain, signal, {
        apiKey,
        onDiagnostic: report,
      });
    } else {
      report({ outcome: 'invalid_provider' });
      signal.throwIfAborted();
      throw new Error('company_capture_invalid_provider');
    }
    signal.throwIfAborted();
    return evidence;
  };
}
