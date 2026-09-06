# Production enrichment

The lifecycle service is the single production enrichment worker. Approved form submissions and eligible install/runtime links enqueue `enrich` jobs in Growth's existing SQL queue. The worker captures public company evidence with the self-hosted Firecrawl service, invokes the structured model generator, validates its result, and stores an `enrichment.v1` artifact in Neon. It does not call a separately hosted research agent.

Install/runtime research derives a candidate domain from admitted install identity and carries the linked observation references. It is not proof of employment. Personal-email domains are excluded. Current authorization, stops, evidence and lease checks govern execution and persistence; evidence redaction cancels affected work and removes its research artifacts. The generic three-step founder sequence does not wait for this research.

Form enrichment remains a supported entry point with its existing submission context. Both entry points share capture and generation. The capture service uses `COMPANY_SCRAPER_URL` and `COMPANY_SCRAPER_SECRET`; there is no provider selector or direct HTTP fallback. HTML extraction and public-host validation remain shared lifecycle utilities.

Use the [operator reports](../../libs/growth/README.md) to distinguish observations, activation decisions, contact outcomes and retained research. Captured observations can remain pending projection while activation succeeds from raw evidence. Company source references and schema validation are not semantic quality labels; unknown fields and capture failures must remain visible.

## Retired research experiment

The standalone `growth-research` app, its local comparison CLI, synthetic deployment packaging, dedicated CI lane and workspace dependencies have been retired. They were an experiment rather than a production dependency. The shared cockpit demo and the Dawn-powered lifecycle service remain separate, supported consumers of their own infrastructure and credentials.

The former implementation and reproduction tests are preserved in repository history at commit `40fe89e30df4664f3f6e8a7ab9e379a412f1fb16`, under `apps/growth-research`. Historical plans remain historical records, not current deployment instructions. Reintroducing research experiments should start from a concrete hypothesis and bounded evidence corpus rather than restoring another always-on service.

## Findings to carry back into Dawn

These observations came from the retired Dawn 0.8.24 / Agent Server 0.13.4-node24 probes. They are historical reproduction pointers, not assertions about current upstream releases.

| Observation | Practical lesson / next upstream verification |
| --- | --- |
| Nullable tool fields became required strings during schema conversion. | Rerun the original schema and unknown-field submission tests before claiming a package upgrade resolves this. |
| Bound-model calls bypassed subclass generation hooks. | Verify budgets, cancellation and usage accounting at the actual provider boundary. |
| Delegated children used `checkpointer: false` and started fresh conversations. | Pass relevant context explicitly; do not assume child conversational continuity. |
| Route-local memory ignored `memory.enabled`; the pilot disabled eager indexing separately. | Test disabled-memory behavior and credential-free graph import independently from durable reads/writes. |
| Managed interruption could be acknowledged before a child stopped, with a later checkpoint. | Test managed cancellation and persistence after cancellation on the target deployment. Local signal tests alone do not prove the cloud boundary. |
| The local harness shared a checkpoint file and could conflict under parallel runs. | Isolate harness state or serialize stateful tests. |
| Company capture sometimes returned empty or navigation-heavy evidence. | Preserve failed/empty cases, improve extraction, and review claims against the captured source. The lifecycle extractor now excludes navigation and omits empty pages. |
| A provider billing rejection prevented a comparison run. | Record operational failures separately from research quality. Later lifecycle provider probes succeeded, but that does not retroactively validate the failed comparison. |

The retired comparison did not establish that an agent outperformed the bounded generator. Semantic review and managed data-lifecycle verification remain prerequisites for any future experiment involving real developer context.
