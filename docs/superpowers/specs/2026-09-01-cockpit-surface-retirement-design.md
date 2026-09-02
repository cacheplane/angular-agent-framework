# Cockpit surface retirement and Website workspace cutover

## Status

Approved through interactive design review on 2026-09-01 after the unified Website workspace reached production parity. This is the second implementation PR in the control-plane follow-up, after production polish and before memory-only custom runtime targets.

This specification completes migration steps 6 and 7 of the unified workspace shell design.

## Summary

Make `threadplane.ai` the only user-facing Docs and operational workspace. Remove the separate `Examples` navigation link and every Website-to-Cockpit handoff. Convert `cockpit.threadplane.ai` into a permanent, registry-derived redirect service so old bookmarks and external links continue to work without preserving a second product surface.

`examples.threadplane.ai` is not retired. It remains the execution origin for Angular runtimes embedded by the Website workspace. The standalone `demo.threadplane.ai` and `ag-ui.threadplane.ai` demos also remain available through the existing Demos menu.

The redirect domain remains indefinitely. The interactive Cockpit application, its separate analytics/bootstrap code, and its duplicate shell deployment are retired once equivalent Website smoke coverage is green.

## Goals

1. Establish `threadplane.ai` as the sole canonical product surface for Docs, Run, Code, API, Runtime, Activity, and Settings.
2. Remove the redundant `Examples` header and footer links without adding another generic workspace destination.
3. Replace every intentional Cockpit link with a same-origin canonical Docs or workspace route.
4. Preserve known Cockpit deep links with permanent, registry-derived redirects and truthful mode semantics.
5. Move production confidence from the duplicate Cockpit shell to the unified Website shell.
6. Keep the examples runtime deployment and standalone demos unchanged.
7. Narrow the following custom-runtime-target release to the Website host only.

## Non-goals

- Retiring `examples.threadplane.ai`, `demo.threadplane.ai`, or `ag-ui.threadplane.ai`.
- Moving Angular example source out of the repository's `cockpit/` tree.
- Adding a new `/examples` or `/workspace` landing page solely to replace the removed header link.
- Redirecting unknown Cockpit paths to an unrelated capability.
- Preserving arbitrary Cockpit query parameters.
- Changing capability content, runtime adapters, or deployment URLs.
- Rewriting the shared workspace library that already powers the Website.
- Adding redirect analytics or user tracking.

## Canonical host roles

After cutover, host responsibilities are:

| Host | Role |
| --- | --- |
| `threadplane.ai` | Canonical Website, Docs, and operational workspace |
| `cockpit.threadplane.ai` | Redirect-only compatibility domain |
| `examples.threadplane.ai` | Embedded Angular runtime assets and application origin |
| `demo.threadplane.ai` | Standalone LangGraph demo |
| `ag-ui.threadplane.ai` | Standalone AG-UI demo |

The Website owns every user-facing capability URL. The registry remains the authority for legacy Cockpit paths, canonical Docs paths, workspace-only paths, supported modes, and default modes.

## Navigation and content cutover

### Global navigation

- Remove `Examples` from desktop and mobile header navigation. Do not rename or replace it.
- Remove `Examples` from the Product column in the footer.
- Keep the existing Demos menu and its two standalone demo destinations.
- Keep GitHub, Docs, Pricing, and marketing navigation unchanged.

The control-plane rail and context navigation are now the capability discovery surface. Adding a second generic header destination would recreate the split the unified shell removed.

### Website links

Replace all hard-coded `https://cockpit.threadplane.ai` links in Website source and authored content:

- Capability-specific CTAs deep-link to the corresponding canonical route and requested mode.
- A capability with a primary Docs page uses that Docs path, for example `/docs/langgraph/guides/streaming?mode=run`.
- A secondary or Docs-less capability uses its registry-owned workspace path, for example `/workspace/ag-ui/json-render?mode=run`.
- Generic marketing CTAs that previously opened Cockpit home use the representative streaming Run route only when their copy promises a live workspace. Otherwise they point to Docs or are removed.
- Blog and documentation links retain their capability identity rather than collapsing to a generic destination.

Links are internal Next links or same-origin anchors and do not open a new tab. Authored copy stops calling Cockpit a separate hosted product. Repository paths such as `cockpit/langgraph/...` may continue to use the word Cockpit because they name source directories, not the retired URL surface.

### Docs-only pages

The legacy `DocsControlPlane` on `/docs` and `/docs/choosing-an-adapter` must not send Run, Code, or API to Cockpit home. These pages have no mapped capability, so operational modes remain disabled with the existing truthful explanation. Search and explicit standalone-demo actions remain available.

Delete the fallback rule that treated an unmapped page as a Cockpit-home handoff.

## Internal route helpers and analytics

Replace the cross-origin `cockpit-links` boundary with registry-derived Website destinations:

- `buildCockpitModeHref` becomes a same-origin workspace destination helper or is deleted where the mounted `WorkspaceProvider` already owns mode changes.
- `NEXT_PUBLIC_COCKPIT_BASE_URL` and the Cockpit environment-label dependency are removed from Website navigation code.
- `docsCockpitHandoff` and `docs:cockpit_handoff` are removed after their final call sites disappear.
- Mounted workspace mode changes continue through the existing workspace mode-change analytics. Static marketing CTAs use the existing CTA contract with a relative destination.
- No event records the redirect source URL or arbitrary query data.

One helper must derive both direct Website links and legacy redirect destinations from `WorkspaceResolution`; link code must not reconstruct five-segment Cockpit paths or duplicate the primary-capability mapping.

## Legacy redirect contract

`cockpit.threadplane.ai` keeps only a minimal Next application or equivalent redirect deployment. It does not render the shared shell, load Angular runtimes, bootstrap product analytics, or expose interactive metadata pages.

### Known capability paths

For an exact `legacyPath` in the manifest:

1. Resolve the entry through `resolveLegacyPath`.
2. Derive the Website path through `getWorkspaceDestinationPath`.
3. Determine the destination mode.
4. Issue a permanent redirect using the framework's explicit permanent-redirect API.

Mode rules:

- A single explicit `mode=docs|run|code|api` is preserved only when that mode is available for the resolved entry.
- With no mode, preserve the old Cockpit route default: Run for runnable entries and Docs for narrative-only entries.
- Invalid, unavailable, or duplicate mode values fall back to that old route default.
- All unrelated query parameters are discarded. Incoming fragments do not participate in route resolution; browser fragment behavior follows the platform's redirect rules and is not part of the compatibility contract.

Destination serialization is canonical and route-aware:

- Docs mode on a canonical `/docs/...` destination has no `mode` query.
- Docs mode on a `/workspace/...` destination uses `?mode=docs`, because that route otherwise defaults to Run.
- Run, Code, and API use their lowercase `mode` query on either route kind.
- The same serializer is used by in-Website links, mode history, and legacy redirects so reload and Back/Forward cannot disagree about the selected panel.

Examples:

```text
/langgraph/core-capabilities/streaming/overview/python
  -> https://threadplane.ai/docs/langgraph/guides/streaming?mode=run

/langgraph/core-capabilities/streaming/overview/python?mode=code
  -> https://threadplane.ai/docs/langgraph/guides/streaming?mode=code

/ag-ui/core-capabilities/json-render/overview/python?mode=run&utm_source=x
  -> https://threadplane.ai/workspace/ag-ui/json-render?mode=run
```

### Root and unknown paths

- `/` permanently redirects to the representative streaming Run route: `https://threadplane.ai/docs/langgraph/guides/streaming?mode=run`.
- An unknown, malformed, or partial legacy path returns 404. It never guesses a capability or redirects to Docs home.
- Asset and favicon routes may use same-origin redirect or static behavior only when they cannot influence the Website destination.

### Destination origin

The redirect service accepts one exact configured Website origin. Production requires `https://threadplane.ai`; local development may use an explicit HTTP localhost origin. The value must contain no credentials, path, query, or fragment. An invalid or missing production origin fails the build or deployment smoke rather than falling back to a request-controlled authority.

The redirect response never derives host or protocol from `Host`, `Forwarded`, `X-Forwarded-Host`, referrer, or user input.

## Application retirement

Remove the interactive responsibilities from `apps/cockpit`:

- Cockpit shell route composition and host adapters.
- Cockpit-only navigation, theme, analytics bootstrap, session ID, metadata, and Open Graph presentation.
- Duplicate shell and pane-rendering tests after their equivalent Website coverage exists.
- Production code paths that mount `WorkspaceProvider` from the Cockpit application.

Keep only the smallest redirect application boundary and registry mapping tests needed to serve the compatibility domain. The shared `workspace-react`, `cockpit-shell`, `cockpit-registry`, `cockpit-runtime-bridge`, and example projects remain because the Website and embedded runtimes consume them.

The `apps/cockpit` project name may remain for the redirect deployment during this release. Renaming the project or Vercel project is unnecessary churn and is not required for retirement.

## CI and deployment sequence

The production pipeline already deploys Website before Cockpit. Preserve that order and validate the permanent mapping before it can reach the production alias:

1. Build, deploy, and smoke the Website containing all replacement links and integrated shell coverage.
2. Build and deploy the redirect-only Cockpit application to a non-production preview URL.
3. Against that preview, exhaustively verify every manifest legacy path plus root, mode variants, hostile authorities, and unknown-path 404 behavior.
4. Promote that already-verified redirect build to the production Cockpit alias.
5. Smoke exact production redirects for root and representative Docs-backed and workspace-only capabilities.
6. Smoke the unified Website journey and the examples runtime host.
7. Advance the deployment marker only after all checks pass.

The former Cockpit production smoke matrix moves to Website and examples-host coverage:

- Website owns Docs, Run, Code, API, Runtime, Activity, Settings, responsive shell, and history. The following release adds custom-target control coverage to this same suite.
- `examples.threadplane.ai` retains Angular application reachability and live-provider canaries.
- The Cockpit deployment owns only redirect status and `Location` correctness.

The permanent cutover is intentionally one-way at the legacy URLs. Before production promotion, a failure aborts the redirect deployment and leaves the old Cockpit deployment untouched. After a 308 reaches clients, recovery never assumes that cached redirects can be recalled or that the interactive Cockpit shell can be restored reliably. A Website regression rolls the Website back to its last green build while keeping destination paths stable. A bad redirect mapping receives a forward fix at both the Website destination and redirect service as needed. The redirect service does not retain a hidden interactive-shell feature flag after cutover.

## Custom runtime target dependency

The following custom-target PR implements `RuntimeTargetProvider` only in the Website root. Production allowed-parent origins for the configuration bridge contain the Website origin, supported Website previews, and explicit localhost/test origins. They do not contain the retired production Cockpit origin.

The redirect domain never receives a custom endpoint or key and never embeds a runtime.

## Error handling

- Invalid Website-origin configuration stops the redirect deployment.
- Unknown legacy paths return 404.
- A known path with an invalid mode redirects using its truthful old default.
- A registry entry with no valid Website destination fails registry/build validation rather than shipping a broken redirect.
- Link migration tests fail on new user-facing `cockpit.threadplane.ai` references.
- If Website smoke fails, the pipeline does not deploy the redirect-only Cockpit build.

## Testing

- Registry unit tests for every `legacyPath` to Website-destination round trip.
- Redirect tests for permanent status, exact `Location`, old default mode, explicit modes, unavailable modes, duplicate modes, query stripping, root, unknown paths, and hostile authority headers.
- Website component tests proving the desktop/mobile header and footer contain no `Examples` link while the Demos menu remains.
- Docs-only control-plane tests proving unavailable modes are disabled and never receive an external fallback.
- Link and analytics tests for same-origin capability destinations and removal of Cockpit handoff events.
- A source/content guard that rejects new user-facing `https://cockpit.threadplane.ai` references outside the redirect application, migration fixtures, and historical documents that are explicitly allowlisted.
- Website E2E for Docs -> Run -> Code -> API, history, capability navigation, Activity, Settings, mobile Search, and the four target widths.
- Production redirect smoke for root, a Docs-backed capability, a workspace-only capability, and an unknown path.
- Existing examples-host smoke remains unchanged except for moving ownership out of the Cockpit-shell suite.

## Acceptance criteria

1. Website desktop and mobile navigation contain no separate `Examples` link.
2. No user-facing Website CTA or authored link intentionally navigates to the Cockpit domain.
3. Known Cockpit URLs permanently redirect to exact registry-derived Website destinations and preserve truthful mode behavior.
4. Unknown Cockpit paths return 404 and cannot become open redirects.
5. `cockpit.threadplane.ai` renders no interactive shell and loads no embedded runtime.
6. `examples.threadplane.ai` and both standalone demo hosts continue to work.
7. Website production smoke owns every former Cockpit shell journey before the duplicate shell is removed.
8. Custom runtime targets require only the Website as their production parent surface.
