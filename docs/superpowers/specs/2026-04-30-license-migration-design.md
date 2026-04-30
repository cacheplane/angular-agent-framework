# License Migration: PolyForm-Noncommercial → MIT (Selective)

## Goal

Migrate the user-facing libraries, demo apps, marketing site, and verification client from `PolyForm-Noncommercial-1.0.0` to `MIT`. Keep the entitlement-issuing minting service (`apps/minting-service/`) on its existing proprietary terms. Result: any developer can `npm install @cacheplane/chat` and use it commercially without a license fee, in line with industry SDK norms (CopilotKit, LangChain, Vercel AI SDK).

## Motivation

`PolyForm-Noncommercial-1.0.0` blocks commercial use without a separate paid license. This creates friction:

- **Adoption:** anyone evaluating the library has to engage legal review before commercial use; many corps disqualify on first scan.
- **Ecosystem positioning:** SDK competitors (CopilotKit MIT, LangChain MIT, Vercel AI SDK Apache) are all permissively licensed. The non-commercial restriction signals "different category" rather than "alternative choice."
- **Community contribution:** non-OSI license discourages drive-by PRs and prevents inclusion in many corp tooling lists.

Future revenue is planned via:
1. **Enterprise add-ons** — features kept private, sold separately. Not in this OSS repo.
2. **Managed service** (potential, future) — hosted runtime; entitlement managed via the existing minting service.

The existing `@cacheplane/licensing` verification client and the `@cacheplane/minting-service` entitlement issuer are kept — repurposed from "license to use the OSS framework" to "entitlement to enterprise features and managed service tiers."

## Final License Map

| Path | Today | After |
|---|---|---|
| `libs/chat/` | PolyForm-NC | **MIT** |
| `libs/langgraph/` | PolyForm-NC | **MIT** |
| `libs/ag-ui/` | PolyForm-NC | **MIT** |
| `libs/render/` | PolyForm-NC | **MIT** |
| `libs/a2ui/` | PolyForm-NC | **MIT** |
| `libs/partial-json/` | PolyForm-NC | **MIT** |
| `libs/licensing/` | PolyForm-NC | **MIT** (verification client; consumers must be able to use it from MIT code) |
| `cockpit/**` (per-feature demos) | PolyForm-NC | **MIT** |
| `apps/cockpit/` (cockpit shell) | PolyForm-NC | **MIT** |
| `apps/website/` | PolyForm-NC | **MIT** |
| `apps/demo/`, `apps/demo-e2e/` | PolyForm-NC | **MIT** |
| `apps/minting-service/` | PolyForm-NC | **STAYS proprietary** (separate LICENSE; not on npm) |
| Root `LICENSE` | PolyForm-NC | **MIT** |
| Root `LICENSE-COMMERCIAL` | exists | **deleted** (no longer needed; nothing is dual-licensed for-sale) |

## File-Level Changes

### Root files

- **`LICENSE`** — replace contents with the MIT License text (with copyright "Copyright (c) 2026 Brian Love d/b/a cacheplane").
- **`LICENSE-COMMERCIAL`** — delete (no longer applicable; nothing is for-sale-licensed at the source level).
- **`README.md`** — update any reference from "PolyForm Noncommercial" / "commercial license required" to "MIT licensed". Link to the LICENSE file.

### Per-package metadata (every `libs/*/package.json` and `cockpit/**/package.json` and relevant `apps/*/package.json`)

- **`license`** field: `"PolyForm-Noncommercial-1.0.0"` → `"MIT"`.
- **`repository`** field: add `{ "type": "git", "url": "https://github.com/cacheplane/angular-agent-framework.git", "directory": "libs/<name>" }` (or analogous path for cockpit/apps).
- **`homepage`** (optional addition): point to the website or repo `README`.
- **`bugs`** (optional addition): `{ "url": "https://github.com/cacheplane/angular-agent-framework/issues" }`.

### `apps/minting-service/`

- Add a `LICENSE` file in `apps/minting-service/` with proprietary terms (port content from current root `LICENSE-COMMERCIAL` with appropriate scoping).
- `apps/minting-service/package.json` — keep `license: "PolyForm-Noncommercial-1.0.0"` OR change to `"SEE LICENSE IN LICENSE"` (the npm convention for non-standard licenses). The latter is cleaner if the LICENSE we add isn't an SPDX-recognized identifier.
- `private: true` already (presumed, since it's a service). If not, add it — npm publish must be blocked.

### Source-file SPDX headers

Every source file currently has:
```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
```

Bulk-replace to:
```ts
// SPDX-License-Identifier: MIT
```

EXCEPT: files under `apps/minting-service/` keep the original SPDX header.

Affected file count: ~470+ files (the audit found 478 references; minus the minting-service directory leaves ~450).

## Migration Mechanics

Mechanical bulk find/replace. Strategy:

1. **First pass — minting-service exclusion guard.** Determine the exact set of files under `apps/minting-service/` so the bulk operation can exclude them.
2. **Bulk SPDX header replace.** Use `rg -l 'PolyForm-Noncommercial-1.0.0' --glob '!apps/minting-service/**'` to find affected files; apply the find/replace.
3. **Per-package.json edits.** Update `license`, add `repository`, `homepage`, `bugs` to each lib + cockpit + app package.json (except minting-service).
4. **Root `LICENSE` rewrite.** Replace with MIT text.
5. **`LICENSE-COMMERCIAL` deletion.** Remove the file.
6. **`apps/minting-service/LICENSE` creation.** Add proprietary terms.
7. **README sweep.** Find any prose references to the old license; rewrite.
8. **Build/lint verification.** Confirm no SPDX-related lint rules complain (some linters enforce SPDX consistency); confirm package.json metadata passes Nx's checks.

## Repository Metadata

The `repository` field is required for npm publish (omitting it generates a warning and may break some package indexers).

Format used for the trio of user-facing libs:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/cacheplane/angular-agent-framework.git",
  "directory": "libs/chat"
}
```

`directory` is the npm convention for monorepo subpath publishing.

## Out of Scope

- **Versioning bump.** No `0.0.1` → `0.1.0` decision in this design. Stays at `0.0.1` until a separate release-readiness work item picks the first published version.
- **Actual `npm publish`.** This migration just changes the LICENSE; it does not ship to npm.
- **`@cacheplane/licensing` runtime behavior changes.** The library stays as-is; its purpose just shifts from "framework commercial-use gate" to "future enterprise-feature/managed-service entitlement gate."
- **Contributor License Agreement (CLA).** Common for projects accepting external contributions but not strictly required. Deferred until contribution velocity makes it worth setting up.
- **NOTICE file.** Required for Apache 2.0; not required for MIT. Skipped.
- **Patent grant.** MIT does not include an explicit patent grant. If there's IP exposure that warrants Apache 2.0 instead, that's a separate decision; this design proceeds with MIT.
- **Existing CI workflows for publish.** The stale `.github/workflows/publish.yml` (references nonexistent `nx test mcp` and project `agent`) needs to be fixed before any publish — that's deferred to a release-readiness implementation plan.

## Risk

- **Reversibility.** A switch from PolyForm-NC to MIT is **not reversible** for code already shipped. Anyone who downloads the MIT-licensed source has perpetual MIT rights to that snapshot. Future versions can change license again, but past releases stay MIT.
- **Contribution provenance.** All current commits are by you (Brian Love). No external contributors yet, so there's no need to retroactively re-license third-party contributions.
- **Forks and competitive use.** Under MIT, anyone — including a hyperscaler or a competitor — can fork and ship a managed service that competes with your future managed service. This is the trade-off: lower friction → broader adoption → less revenue protection on the source. The mitigation is to keep monetizable assets (enterprise add-ons, managed service runtime, brand) **outside** the MIT repository.
- **Existing commercial-license customers.** None today. If any existed, they'd need notice that the framework is now free; their contracts would need to convert to enterprise/support contracts.

## When to Revisit

- A managed-service offering is built and a competitor forks the OSS to host it themselves — at that point, consider Business Source License (BSL) or Elastic License v2 (ELv2) for *future* server-side components, NOT retroactively for the SDK.
- An external contributor pattern develops — adopt a CLA or DCO.
- An enterprise customer requires Apache 2.0 specifically (patent grant) — relicense MIT → Apache 2.0 is straightforward; any-license → Apache, less so.
