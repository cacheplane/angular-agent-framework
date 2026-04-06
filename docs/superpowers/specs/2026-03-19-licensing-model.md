# Angular Stream Resource Licensing Model — Design Specification

**Date:** 2026-03-19
**Status:** Implemented
**Author:** Brian Love d/b/a cacheplane

---

## Overview

Angular Stream Resource uses a **source-available dual-license model**. It is **not** open source and must never be described as MIT or OSI-approved. The project is publicly readable and freely usable for noncommercial purposes, with a paid commercial license required for any for-profit or revenue-generating use.

---

## License Files

| File | Purpose |
|---|---|
| `LICENSE` | Full text of PolyForm Noncommercial 1.0.0 |
| `LICENSE-COMMERCIAL` | Full text of the Angular Stream Resource Commercial License |
| `COMMERCIAL.md` | Plain-English commercial licensing explainer |
| `NOTICE` | Required copyright notice per PolyForm terms |

---

## Public/Community License

**License:** PolyForm Noncommercial License 1.0.0
**SPDX Identifier:** `PolyForm-Noncommercial-1.0.0`
**URL:** https://polyformproject.org/licenses/noncommercial/1.0.0
**SPDX Registry:** https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html

### Permitted uses (noncommercial)

- Personal research, experiment, and study
- Hobby projects and amateur pursuits
- Academic and educational use
- Use by organizations with no substantial commercial activity (non-profits, charities, government)
- Evaluation for up to 32 consecutive calendar days

### Not permitted under PolyForm Noncommercial

- Any use in a for-profit product or service
- Use at a revenue-generating company (even internal tools)
- Consulting or client work deploying the library commercially

---

## Commercial License

**License:** Angular Stream Resource Commercial License
**File:** `LICENSE-COMMERCIAL`

### Tiers

| Tier | Price | Scope |
|---|---|---|
| Developer Seat | $500 / seat / year | One developer, all environments, 12-month release lock |
| App Deployment | $2,000 / app (one-time) | One named application, all developers, all environments, perpetual for version |
| Enterprise | Custom | Volume licensing, priority support, custom contract |

**Contact:** hello@cacheplane.ai
**Pricing page:** https://stream-resource.dev/pricing

**Governing law:** State of Oregon, Deschutes County, United States.
**Copyright:** Brian Love d/b/a cacheplane

---

## Package Metadata

All `package.json` files must set:

```json
"license": "PolyForm-Noncommercial-1.0.0"
```

Affected packages:
- Root `package.json`
- `libs/stream-resource/package.json`
- `packages/mcp/package.json`

---

## SPDX Headers

All non-test, non-setup TypeScript source files in `libs/stream-resource/src/` and `packages/mcp/src/` must begin with:

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
```

For files with a shebang (`#!/usr/bin/env node`), the SPDX line goes on line 2, after the shebang.

Spec files (`*.spec.ts`) and `test-setup.ts` do not require SPDX headers.

---

## Messaging Constraints

### DO NOT use

- MIT
- open source
- open-source
- OSI-approved
- "free for open source projects"

### DO use

- source-available
- noncommercial
- community
- "free for noncommercial use"
- PolyForm Noncommercial 1.0.0

---

## Website Implementation

### Pricing tier name

The free/community tier is called **"Community"** (not "Open Source").

### Pricing page copy

- Free tier: "Community · Free · noncommercial use · PolyForm Noncommercial 1.0.0"
- Commercial tiers: "Commercial use requires a paid Angular Stream Resource Commercial License"

### Footer

```
PolyForm Noncommercial 1.0.0 · Commercial License
```

### Feature card

```
Source-available licensing. Free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial license at $500/seat/year or $2,000/app deployment.
```

### README badge

```markdown
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%20%2B%20Commercial-6C8EFF?labelColor=080B14&style=flat-square)](./LICENSE)
```

### README license section

```markdown
`@cacheplane/stream-resource` is source-available software dual-licensed:

- **PolyForm Noncommercial 1.0.0** — free for noncommercial use. See LICENSE.
- **Angular Stream Resource Commercial License** — required for any for-profit or revenue-generating use. See LICENSE-COMMERCIAL and COMMERCIAL.md.

This is **not** an open-source license. Commercial use requires a paid commercial license.
```

---

## Compliance Checklist

- [ ] `LICENSE` contains full PolyForm Noncommercial 1.0.0 text
- [ ] `NOTICE` contains `Required Notice: Copyright (c) 2026 Brian Love d/b/a cacheplane`
- [ ] `LICENSE-COMMERCIAL` is present with correct governing law (Oregon, Deschutes County) and contact email (hello@cacheplane.ai)
- [ ] `COMMERCIAL.md` provides plain-English explainer
- [ ] All `package.json` files set `"license": "PolyForm-Noncommercial-1.0.0"`
- [ ] SPDX headers present in all library and MCP source files
- [ ] No MIT, open-source, or OSI language anywhere in website, README, or docs content
- [ ] Pricing page uses "Community" not "Open Source"
- [ ] E2e tests reference "Community" not "Open Source"
