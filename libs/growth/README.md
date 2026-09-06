# Internal growth operator reports

Run the existing CLI with the intended read-only database credentials:

```sh
npm run growth:observability -- funnel --from 2026-09-01T00:00:00Z --to 2026-09-05T00:00:00Z
npm run growth:observability -- journey --contact 11111111-1111-4111-8111-111111111111
```

`funnel` requires a positive UTC date range of at most 31 days, with an exclusive end. Independent observation/subject counts are grouped by source, kind, and install environment. Processing status reflects the current state of observations received in that window. Activation decisions use their evaluation timestamps. The linked cohort consists only of distinct contacts in those persisted decisions; its campaign outcomes include all recorded history as of the read and its authorization/stops reflect current control state (approval prerequisites, not full campaign eligibility). These counts are not a sequential conversion rate or anonymous website attribution.

`journey` accepts one opaque contact UUID. It shows the latest 50 directly linked observations, activation decisions, jobs, and activity records, and the latest enrichment artifact's company profile and up to three source references. Each section declares its limit and truncation; missing records return `no_evidence`, an unknown contact returns `not_found`, and a deleted contact returns `redacted` with control state only. Missing profile fields mean unavailable. Profiles are candidate-domain research, not verified employment.

Both commands are read-only and need neither the processing switch nor the email HMAC keyring. Output excludes plaintext contact/install identity, full job payloads, activity data, email drafts, and raw artifact contents. Only explicit job provenance fields are shown. Source links omit query strings and fragments; unsafe or identity-bearing links are unavailable. Persisted provider results may lag delivery; ingress rejection details require service logs. Reads are not a transaction snapshot.
