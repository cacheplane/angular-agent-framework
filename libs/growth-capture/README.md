# Growth company capture

Private server-side capture library shared by lifecycle and the local research
evaluation harness. It owns the authenticated crawler client, hostname/SSRF
checks, DNS cancellation, HTML evidence extraction, and page-evidence schema.
It does not own contact records, model calls, research claims, or email policy.

`createCompanyCapture(environment, onDiagnostic?)` returns the bounded capture
function. Callers supply configuration and an abort signal; the library does not
load credential files. Production capture uses the separately deployed crawler.
The `company-fetch.ts` helpers validate hosts and extract evidence; they do not
restore the retired direct-fetch enrichment pipeline.

Run `npx nx test growth-capture`, `npx nx lint growth-capture`, and
`npx nx run growth-capture:check`. Lifecycle's native build verifies the bundled
consumer. The research app lists capture as a development dependency because
its local evaluation harness acquires pages; its standalone deployment receives
captured evidence and excludes this package.

See [Growth architecture and operations](../../docs/growth/README.md).
