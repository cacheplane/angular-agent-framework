# OpenSSF Best Practices Badge — Passing-level answer sheet

**Project:** Threadplane (`cacheplane/angular-agent-framework`)
**Purpose:** fill-in sheet for the bestpractices.dev "passing" questionnaire. Each criterion → answer + evidence. Status as of 2026-06-20.

**How to submit (owner action):**
1. Sign in at <https://www.bestpractices.dev> with GitHub.
2. "Add a new project" → repo URL `https://github.com/cacheplane/angular-agent-framework`. Many fields auto-detect.
3. For each criterion below, set the answer (Met / N/A) and paste the justification/URL.
4. Once all MUST criteria are **Met/N/A**, the badge shows **passing**. Add the badge to `README.md`:
   `[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/<ID>/badge)](https://www.bestpractices.dev/projects/<ID>)`
5. OSSF Scorecard's `CII-Best-Practices` check reads it on the next scan.

Project description for the form: *"An open-source, Angular-native framework for building AI agent UIs — streaming chat, durable threads, interrupts, subagents, planning, memory, and generative UI for LangGraph, AG-UI, A2UI, and custom backends."*

---

## Basics
| Criterion | Answer | Evidence |
|---|---|---|
| description_good | Met | README.md + <https://threadplane.ai> describe the purpose plainly |
| interact | Met | README (install/use), `CONTRIBUTING.md` (How to contribute), docs site |
| contribution | Met | `CONTRIBUTING.md` → "How to contribute" (issues → branch → PR) |
| floss_license | Met | MIT (OSI-approved) — `LICENSE` |
| license_location | Met | `LICENSE` at repo root; `license` in each `package.json` |
| documentation_basics | Met | README + docs at <https://threadplane.ai>; `SECURITY.md` |
| documentation_interface | Met | API reference docs (generated) on the docs site |
| sites_https | Met | threadplane.ai serves HTTPS/TLS (HTTP 200) |
| discussion | Met | GitHub Issues — searchable, URL-addressable: <https://github.com/cacheplane/angular-agent-framework/issues> |
| maintained | Met | Actively maintained — daily commits/releases |

## Change Control
| Criterion | Answer | Evidence |
|---|---|---|
| repo_public | Met | Public GitHub repo |
| repo_track | Met | Git (authors + timestamps) |
| repo_interim | Met | Work lands via PRs/commits, not only tagged releases |
| version_unique | Met | Synchronized SemVer tags `vX.Y.Z` (e.g. v0.0.52) |
| release_notes | Met | Each GitHub Release has auto-generated notes (`gh release create --generate-notes`) |
| release_notes_vulns | N/A | No CVE fixes shipped to date; will note CVEs in release notes if/when applicable |

## Reporting
| Criterion | Answer | Evidence |
|---|---|---|
| report_process | Met | `CONTRIBUTING.md` directs bug reports to GitHub Issues |
| report_responses | Met | Maintainer responds to issues (self-asserted) |
| report_archive | Met | GitHub Issues = public, searchable archive |
| vulnerability_report_process | Met | `SECURITY.md` + GitHub private vulnerability reporting (enabled) |

## Quality
| Criterion | Answer | Evidence |
|---|---|---|
| build | Met | Nx build (`npx nx run-many -t build`); CI builds on every PR |
| test | Met | Automated suites via Nx/Vitest (`npx nx test <project>`) |
| test_policy | Met | `CONTRIBUTING.md` → "Testing": new functionality + fixes must add tests |
| tests_are_added | Met | Recent PRs add `*.spec.ts` / type-spec tests alongside changes |
| warnings | Met | ESLint enabled across projects; CI runs `lint` |
| warnings_fixed | Met | Lint runs in CI/publish path; warnings addressed (e.g. langgraph empty-generator fix) |

## Security
| Criterion | Answer | Evidence |
|---|---|---|
| know_secure_design | Met | Maintainer understands secure design (self-asserted) |
| know_common_errors | Met | Self-asserted; supply-chain hardening (OSSF Scorecard, provenance, signing) demonstrates it |
| crypto_published | Met¹ | `@threadplane/licensing` verifies Ed25519 signatures — a published algorithm |
| crypto_keylength | Met¹ | Ed25519 meets NIST minimums |
| crypto_working | Met¹ | Ed25519 is not a broken algorithm |
| crypto_random | Met/N/A¹ | Libraries **verify** signatures (public-key); key generation is out of scope of the published libs |
| delivery_mitm | Met | npm over HTTPS + SLSA provenance; git over HTTPS/SSH |
| vulnerabilities_fixed_60_days | Met | Published `@threadplane/*` are dependency-free (chat pulls 2 `@cacheplane/*`); no known unpatched vulns in shipped code |

¹ **Owner: confirm the crypto answers.** The published libs only *verify* Ed25519 license signatures (no key generation). If you'd rather, the badge allows answering the crypto group "N/A — project does not implement its own cryptography" with that justification.

## Analysis
| Criterion | Answer | Evidence |
|---|---|---|
| static_analysis | Met | CodeQL (`.github/workflows/codeql.yml`) on every push/PR + weekly |
| static_analysis_fixed | Met | CodeQL findings triaged via GitHub code scanning |

---

## Pre-submit gaps closed (2026-06-20)
- `contribution` + `report_process`: added "How to contribute" to `CONTRIBUTING.md`.
- `test_policy`: added "Testing" policy to `CONTRIBUTING.md`.

## The only owner judgment call
The **crypto** criteria (¹). Everything else is Met with the evidence above — this should pass on first submission.
