# Operational control plane for Docs and Cockpit

## Status

Approved through interactive design review on 2026-08-31. This document is the implementation contract for the second control-plane iteration.

## Summary

Extend the existing rail-plus-context sidebar from navigation into a truthful operational control plane.

Cockpit owns live runtime state and safe recovery commands. Its context pane shows the resolved runtime, validated readiness, last check, and icon-led actions. A new Activity rail utility shows a bounded timeline of meaningful events from the current browser session without unmounting the active workspace.

Docs remains read-only. It previews the configured Cockpit target and mapped capability, then hands the user to the exact Cockpit context for live status and commands. Docs never polls a runtime or claims live health.

This iteration also closes the accessibility and shell-polish issues found during the production Chrome audit: mobile target sizing, focus restoration, modal inertness, sidebar scroll isolation, remaining uppercase labels, and Cockpit favicon routing.

## Baseline

The first control-plane iteration is already implemented and merged. It provides:

- One shared visual grammar across Docs and Cockpit: activity rail, contextual pane, and main workspace.
- Docs, Run, Code, and API as stable primary rail destinations.
- Scope, Learn or Capability, Environment, and Actions sections.
- Settings as a Cockpit utility panel.
- Versioned, per-surface preferences for mode and disclosure state.
- Deterministic Docs-to-Cockpit capability mapping and one-time mode query handoff.
- A page-actions ellipsis menu in Docs.
- Shared structural and accessibility primitives in `@threadplane/ui-react`.

The current Cockpit can prove only whether a runtime URL is configured. `RunMode` mounts that URL in a `ThemedFrame`; it does not yet expose readiness, reload control, or runtime lifecycle events to the shell.

## Product decisions

The approved decisions for this iteration are:

1. The next control-plane layer is operational rather than a general workflow launcher.
2. Cockpit operates; Docs previews and hands off.
3. Commands are limited to inspection and safe recovery. Server lifecycle mutations such as stop, restart, redeploy, or deployment switching are out of scope.
4. Activity is current-browser-session state. It is neither persisted locally nor stored on a server.
5. Operational controls remain contextual. They do not become a fifth primary mode or a persistent footer.

## Goals

1. Show live runtime readiness only when Cockpit can validate it.
2. Give users safe, immediate recovery controls without leaving the active capability.
3. Explain operational transitions through a compact, truthful session timeline.
4. Keep Run mounted across mode and utility changes.
5. Give Docs readers a clear, deterministic route into the matching live controls.
6. Preserve the existing four-mode mental model and control-plane geometry.
7. Close the concrete accessibility and responsive issues found in the Chrome audit.
8. Add analytics for consequential operational decisions without collecting runtime details or click noise.

## Non-goals

- Starting, stopping, restarting, redeploying, or switching a server deployment.
- Authentication or authorization for deployment-management APIs.
- Durable, multi-user, or cross-tab operational history.
- Backend log aggregation, traces, metrics, or LangSmith event ingestion.
- Generic command-palette work.
- Polling runtime health from Docs.
- Treating iframe `load` as proof that the embedded application is healthy.
- Inferring independent deployments when multiple capabilities share one runtime URL.
- Persisting runtime state or Activity in control-plane preferences.
- Rebuilding the existing Run, Code, Docs, or API workspaces.

## Design principles

### Operational claims require evidence

`Ready` is reserved for a validated response from the mounted runtime. A configured URL, an iframe `load` event, or a successful navigation is not sufficient.

### Recovery remains user-directed

Cockpit does not create retry storms or automatically remount a runtime. Recheck and Reload are explicit user commands. A failed readiness check never hides or disables the existing Run surface.

### The control plane governs; the workspace remains mounted

Runtime status and commands live in the context pane. Activity temporarily replaces that pane. Neither interaction changes the selected primary mode or unmounts Run.

### Docs shows intent, not borrowed health

Docs can prove which Cockpit capability and environment a page maps to. It cannot prove the current health of an iframe it has not mounted, so it does not display a live status label.

### Dense, icon-led, and accessible

Familiar commands use modern icons with accessible names and focusable tooltips. Status combines icon, text, and color. Target size and focus behavior are requirements, not later polish.

## Information architecture

### Cockpit context pane

The ordinary Cockpit context pane contains, in order:

1. **Scope** — current product, section, and capability.
2. **Capability** — existing navigation tree.
3. **Runtime** — configured target, validated state, last-check information, and safe commands.

The existing static Environment section is replaced by Runtime. Product and language remain available through Scope or Runtime metadata; the UI does not repeat the same values merely to fill rows.

Runtime is expanded by default. Its disclosure state continues to use the existing per-surface preference record.

Representative layout:

```text
Runtime                         ● Ready
Shared development
Python · LangGraph
https://runtime.example/path
Checked 12 seconds ago

[↻]  [⟳]  [↗]  […]
```

The first three buttons are Recheck, Reload runtime, and Open runtime. The ellipsis menu contains Copy diagnostics. Future secondary commands may use this menu only when they have real handlers and remain within the safe-recovery boundary.

### Cockpit utility rail

Activity appears above Settings in the bottom utility group. It uses the Lucide `Activity` icon, an accessible name, and the shared tooltip behavior.

Selecting Activity replaces the ordinary context pane with the Activity panel. It does not change `activeMode`, navigate, or unmount Run. Selecting Activity again, selecting any primary mode, pressing Escape, or using the panel close button restores the ordinary context pane.

The Activity icon may show a small attention indicator while the current runtime phase is Unresponsive, Error, or Invalid configuration. The indicator is not a numeric unread badge and is not cleared merely by opening Activity. Leaving the terminal failure state clears it. The accessible label becomes `Activity, attention required` while present.

### Activity panel

Activity is a compact chronological timeline, newest first. Each row contains:

- Timestamp.
- Severity icon.
- Short semantic summary.
- Capability label when the event belongs to a capability other than the current one.

Meaningful events include:

- Runtime check requested.
- Runtime ready.
- Runtime unresponsive.
- Runtime initialization error.
- Runtime reload requested.
- Runtime recovered.
- Primary mode changed.
- Open runtime requested.
- Diagnostics copied or copy failed.

Timer ticks, disclosure toggles, hover, focus, relative-time refreshes, and ordinary navigation clicks are not events.

The panel keeps at most 50 entries in memory. `Clear session activity` is a secondary item in the panel ellipsis menu. Clearing does not alter the current runtime state or attention indicator.

### Docs context pane

Docs replaces its static Environment section with a collapsed Runtime preview. It may show only facts derived from configuration and deterministic mapping:

- Environment label: `Shared development`.
- Destination: Cockpit.
- Mapped capability when one exists.
- Requested mode associated with the selected rail destination or `Run` for the explicit Open controls action.

The preview does not display Ready, Unresponsive, last checked, or recent activity. Its primary action is `Open controls in Cockpit`, which uses the existing exact capability mapping and validated mode query.

Unsupported Docs pages continue to use the approved Cockpit home fallback rather than guessing a capability.

## Runtime state model

### States

```ts
type RuntimePhase =
  | 'not_configured'
  | 'invalid_configuration'
  | 'connecting'
  | 'checking'
  | 'ready'
  | 'unresponsive'
  | 'reloading'
  | 'error';
```

The runtime snapshot contains:

- Current phase.
- Sanitized target: origin and pathname only.
- Current capability.
- Active check nonce while a check is pending.
- `checkedAt` for the latest completed check.
- `lastReadyAt` when a validated reply was last accepted.
- An allowlisted error code when the runtime explicitly reports initialization failure.
- Reload generation used to remount the frame.

The snapshot is component state and is never persisted.

### Transitions

```text
not_configured
      │ runtime value appears
      ├── invalid URL ─────────▶ invalid_configuration
      │ valid URL
      ▼
  connecting ── valid reply ──▶ ready
      │                           │
      │ timeout                   │ recheck
      ▼                           ▼
 unresponsive ◀────────────── checking
      │                           │
      └──── reload ──▶ reloading ─┘

Explicit runtime bridge failure ──▶ error
```

Detailed rules:

- With no runtime URL, the phase is `not_configured` and runtime commands are omitted.
- A configured value that cannot be parsed as an absolute HTTP or HTTPS URL enters `invalid_configuration`. No iframe is mounted; Recheck, Reload, and Open are omitted. Copy diagnostics remains available and records `runtime: null` without copying the rejected value.
- Entering `invalid_configuration` records one local `configuration_invalid` Activity event and one terminal status analytics transition. It does not repeat on renders.
- Mounting a configured frame enters `connecting`.
- The iframe `load` event triggers a readiness check but does not itself change the phase to `ready`.
- Every check nonce comes from `crypto.randomUUID()`. A nonce is single-use and is invalidated after a valid reply, timeout, cancellation, reload, route change, or unmount.
- A user Recheck enters `checking` without remounting the frame.
- A user Reload increments the reload generation, enters `reloading`, and remounts only the iframe. The new frame load begins a new check.
- A valid ready reply enters `ready`, records `checkedAt` and `lastReadyAt`, and cancels the active timeout.
- A five-second check timeout enters `unresponsive` and records `checkedAt`.
- A validated runtime error reply enters `error` with an allowlisted code.
- A transition from `unresponsive` or `error` to `ready` emits `recovered` instead of an additional generic Ready event.
- A route change that resolves a different runtime URL or capability creates a fresh controller snapshot. Session Activity remains and labels older entries with their capability.
- Stale replies cannot change the snapshot after a newer check, reload, route change, or unmount.

`Unresponsive` means only that the mounted runtime did not answer the readiness protocol before timeout. The Run surface remains visible and usable. Invalid configuration is distinct from runtime Error: it is produced locally before mounting, while Error is reserved for a validated `bootstrap_failed` bridge reply.

## Runtime bridge protocol

### Package boundary

Create a small private, framework-neutral package, `@threadplane/cockpit-runtime-bridge`. It owns:

- Protocol version and message types.
- Runtime validation functions that reject unknown or malformed objects.
- A browser-side embedded responder with explicit initializing, ready, and error state.
- `markRuntimeReady()` and `markRuntimeError()` lifecycle functions.
- No React, Angular, analytics, or control-plane UI.

`bootstrapWithCockpitHarness()` in `@threadplane/cockpit-telemetry` becomes the single Angular integration point. It installs the responder before calling Angular bootstrap, calls `markRuntimeReady()` only after `bootstrapApplication(...)` fulfills, and calls `markRuntimeError('bootstrap_failed')` before rethrowing a rejected bootstrap.

Every registry-discovered Cockpit Angular entry point must use this wrapper:

- The existing 40 `main.cockpit.ts` files already use `bootstrapWithCockpitHarness()` and gain bridge behavior through the wrapper.
- Migrate all 40 production `cockpit/**/angular/src/main.ts` files from direct `bootstrapApplication(...)` calls to the same wrapper.
- Add a registry-derived drift test that fails when any current or future Cockpit Angular project has a `main.ts` or `main.cockpit.ts` entry point that bypasses the wrapper.

This is an exhaustive mechanical migration, not capability-specific runtime logic. The top-level `examples/chat/angular` and `examples/ag-ui/angular` applications are separate demo deployments and are not Cockpit-mounted capability runtimes, so this spec does not require them to install the bridge.

While initialization is pending, the responder retains only the newest valid pending check envelope: source, origin, version, and nonce. `markRuntimeReady()` or `markRuntimeError()` replies to that check and immediately discards it. This allows a check sent during Angular bootstrap to complete without equating module evaluation with application readiness.

The lifecycle functions are idempotent. Ready cannot be emitted before explicit bootstrap success, and arbitrary application exceptions after successful bootstrap do not retroactively become bootstrap failures.

Cockpit imports only the protocol types and validators. It owns the controller and timers.

### Messages

Version 1 defines three messages:

```ts
interface RuntimeCheckMessage {
  type: 'tplane:runtime-check';
  version: 1;
  nonce: string;
  capability: string;
}

interface RuntimeReadyMessage {
  type: 'tplane:runtime-ready';
  version: 1;
  nonce: string;
}

interface RuntimeErrorMessage {
  type: 'tplane:runtime-error';
  version: 1;
  nonce: string;
  code: 'bootstrap_failed';
}
```

The protocol does not transmit stack traces, prompts, chat content, user identifiers, deployment credentials, model details, or arbitrary error text.

### Validation and origin rules

- Cockpit derives an exact `targetOrigin` from `runtimeUrl`; it never sends runtime checks with `*`.
- Cockpit accepts replies only when `event.source` equals the mounted iframe's `contentWindow`.
- Cockpit requires `event.origin` to equal the target runtime origin.
- Cockpit validates message shape, protocol version, active nonce, and current capability context before accepting a reply.
- Cockpit gives the iframe `referrerPolicy="origin"` so the child receives only the parent origin, not the Cockpit path or query.
- The embedded responder derives the actual embedding origin from `document.referrer`. It accepts checks only when `event.source === window.parent` and `event.origin` equals that referrer origin.
- If the referrer is absent or cannot be parsed, the responder does not answer. It does not fall back to `*` or to a caller-supplied query parameter.
- The responder sends its reply to `event.origin`, not `*`.
- The responder echoes the nonce but does not store it after replying.
- Unknown versions, types, codes, or fields that fail validation are ignored.

The runtime examples are public, non-sensitive demo UIs. Any origin may embed them, and the v1 bridge reveals only whether that already-rendered demo completed bootstrap. The protocol does not claim that embedding origin is an authenticated Threadplane client. It binds replies to the actual parent origin to prevent sibling-frame or forged-message confusion. Any future protocol that exposes data or performs mutations requires an explicit server-controlled origin allowlist and is outside v1.

The existing theme protocol remains independent. This iteration does not redesign theme messaging.

## Commands

### Recheck

- Sends a new runtime check to the existing frame.
- Cancels the previous check timer.
- Records one Activity event and one user-action analytics event.
- Remains available in Ready, Unresponsive, and Error.
- Is disabled while Connecting, Checking, or Reloading to prevent overlapping checks.

### Reload runtime

- Increments the iframe reload generation and remounts the runtime with the same sanitized base URL plus the existing required Cockpit query parameters.
- Does not reset selected mode, capability route, theme, disclosure preferences, or Activity.
- Is disabled while Reloading.
- Records the request and eventual outcome as separate Activity events.

### Open runtime

- Opens the configured runtime URL in a new tab with `noopener noreferrer`.
- Uses the configured URL, not the iframe URL containing Cockpit session and telemetry parameters.
- Records only that the command was requested.

### Copy diagnostics

Copies a formatted JSON object containing:

```json
{
  "capability": "streaming",
  "runtime": "https://runtime.example/path",
  "state": "unresponsive",
  "checkedAt": "2026-08-31T17:00:00.000Z",
  "lastReadyAt": null,
  "protocolVersion": 1,
  "recentEvents": []
}
```

Sanitization requirements:

- Strip the entire query string and hash from the runtime URL.
- Exclude Cockpit distinct IDs, PostHog keys and hosts, message nonces, raw errors, stack traces, document content, prompts, and chat state.
- Include at most the 20 most recent operational events.
- Events contain timestamp, kind, severity, capability, and fixed-format summary only.
- A clipboard failure leaves the menu usable and records a local failure without showing false success.

## State ownership and data flow

`CockpitShell` is the composition root because it coordinates the mounted Run frame, selected mode, control plane, and Activity.

```text
CockpitShell
├── useRuntimeController(runtimeUrl, capability)
│   ├── runtime reducer
│   ├── iframe ref
│   ├── handshake listener and timeout
│   └── recheck / reload / open / diagnostics actions
├── useSessionActivity(limit: 50)
│   └── accepts semantic runtime, mode, and command events
├── CockpitControlPlane
│   ├── RuntimeSection
│   └── ActivityPanel
└── RunMode
    └── ThemedFrame with forwarded frame ref and load callback
```

The runtime controller reports semantic events through a callback rather than owning the Activity UI. `CockpitShell` also records successful primary-mode transitions into the same Activity store.

`RunMode` continues to stay mounted while Code, Docs, or API is selected. Only a user Reload command changes the frame generation.

The controller parses `runtimeUrl` before `RunMode` builds an iframe source. `RunMode` receives only a validated HTTP or HTTPS target. Invalid configuration therefore renders a concise non-frame empty state rather than allowing `new URL(...)` to throw during the client effect.

`@threadplane/ui-react` remains operationally ignorant. Existing control-plane sections, rail utilities, icon buttons, toolbars, and utility-panel primitives are reused. New shared presentation primitives are added only if both Docs and Cockpit need the exact behavior; the Cockpit-only timeline remains in the Cockpit application.

## Visual design

### Runtime section

- Use sentence-case Inter labels and the existing muted section-heading style.
- Show status at the right edge of the Runtime heading when space permits; stack below the heading at narrow pane widths.
- Use a compact metadata stack rather than a bordered dashboard card.
- Truncate long runtime paths visually while preserving the sanitized full path in an accessible label or tooltip.
- Use the existing fully rounded hover, active, and focus backgrounds. Do not add left-edge accents.
- Invalid configuration renders `Invalid runtime URL` with `TriangleAlert`, no raw configured value, and only the sanitized Copy diagnostics command.

### Icon vocabulary

Use Lucide icons consistently:

- `CircleCheck` — Ready.
- `LoaderCircle` — Connecting, Checking, or Reloading.
- `TriangleAlert` — Unresponsive or Error.
- `CircleSlash` — Not configured.
- `RefreshCw` — Recheck.
- `RotateCw` — Reload runtime.
- `ExternalLink` — Open runtime.
- `Ellipsis` — secondary commands.
- `Activity` — Activity utility.
- `Settings` — Settings utility.

Status never relies on color alone. It always includes an icon and visible text.

### Activity timeline

- Newest entries appear first.
- Routine events use neutral text and icons.
- Errors use the error token; recovery uses the success token.
- Connecting lines are decorative and hidden from assistive technology.
- Relative time may update at a low cadence but never creates an event or analytics call.
- Empty state: `No operational activity this session.`

## Responsive behavior

### Desktop and tablet

Retain the current rail-plus-context geometry. Runtime and Activity scroll within the context pane. Focusing a sidebar control must scroll only the sidebar container, never the main Docs document or Cockpit workspace.

### Mobile

Runtime lives in the existing control-plane drawer. Activity replaces only the drawer body while the rail and utility controls remain mounted.

Requirements:

- External navigation trigger, dialog close button, rail items, and action buttons have a minimum 44 by 44 CSS-pixel target on coarse pointers.
- Closing the drawer through Escape, close button, backdrop, mode selection, or capability navigation restores focus to the external trigger after the closing transition completes.
- Background content is inert for the entire open and closing interval.
- The external trigger is not exposed as a second `Close navigation` control while the modal is active.
- Focus remains trapped within the active drawer.
- Closing Activity returns to the ordinary drawer and focuses the Activity utility; closing the drawer returns to the external trigger.
- The UI does not overflow horizontally at 320 CSS pixels.

## Accessibility

- Runtime status uses visible text and an icon in addition to color.
- User-triggered check and command results are announced through one polite live region.
- Passive Activity additions and relative-time updates are not announced.
- Icon-only commands have `aria-label`, keyboard-focus tooltips, and visible focus rings.
- The action toolbar preserves roving arrow-key behavior plus Home and End.
- Loading icons stop rotating under `prefers-reduced-motion`; drawer transitions are removed.
- Forced-colors mode uses system text, canvas, highlight, and border colors rather than transparent color-only distinctions.
- Activity attention state is present in the accessible label.
- Utility-panel close behavior returns focus to the invoking rail item.
- The manual release check includes VoiceOver navigation through the rail, Runtime section, actions, Activity timeline, Settings, and the mobile drawer.

## Audit hardening included in scope

The implementation must also resolve these verified issues:

1. Docs mobile drawer Escape currently leaves focus on `body`.
2. Docs mobile search handoff can also lose trigger focus after Escape.
3. Cockpit mobile drawer Escape currently leaves focus on `body` after the transition.
4. The Cockpit mobile opener is approximately 20 by 20 CSS pixels instead of the required 44 by 44 target.
5. The Cockpit modal exposes both its internal close button and the background trigger as `Close navigation` to assistive technology.
6. Keyboard focus on bottom Docs sidebar actions can scroll the main document canvas instead of only the sidebar.
7. Remaining uppercase presentation such as the API language heading should use the approved minimal sentence-case treatment.
8. `/favicon.ico` currently enters the Cockpit catch-all capability route and produces a server error. Add an explicit favicon asset or route so it resolves normally and never reaches capability resolution.

## Error handling

- Missing runtime URL renders Not configured and omits commands that require a target.
- Invalid runtime URL is treated as configuration error before attempting to mount a frame.
- A readiness timeout produces Unresponsive without claiming a network, server, or application root cause.
- Runtime Error is used only for the validated `bootstrap_failed` bridge code.
- Invalid configuration shows no rejected URL, does not mount an iframe, omits Recheck, Reload, and Open, and permits only sanitized Copy diagnostics.
- Malformed or untrusted messages are ignored and do not create user-facing errors or Activity entries.
- Clipboard failure keeps Copy diagnostics available for retry and reports a concise local outcome.
- Popup blocking does not alter runtime status.
- An Activity rendering error must not affect the Run iframe.
- Status failure never disables Code, Docs, API, capability navigation, Settings, or the existing Run content.

## Analytics

Add only these consequential events.

### `cockpit:runtime_action`

Properties:

- `capability`
- `action`: `recheck | reload | open | copy_diagnostics`
- `state_before`
- `outcome`: `requested | succeeded | failed`

### `cockpit:runtime_status_changed`

Emit only for terminal semantic transitions:

- Ready.
- Unresponsive.
- Error.
- Invalid configuration.

Emit exactly one analytics event per transition. A transition from Unresponsive or Error to Ready is one event with `to_state: 'ready'` and `transition: 'recovered'`; it is not followed by a second Ready event.

Properties:

- `capability`
- `from_state`
- `to_state`
- `elapsed_ms` when a check duration is known.
- `transition: 'recovered'` only for recovery.
- `reason_code: 'bootstrap_failed' | 'invalid_runtime_url'` only for the corresponding terminal condition.

Do not emit for Connecting, Checking, Reloading, timer ticks, or relative-time updates.

### `docs:cockpit_handoff`

Properties:

- Docs library, section, and slug.
- Destination product and capability when mapped.
- Requested mode.
- `mapped: boolean`.

No operational analytics event may contain a runtime URL, URL query parameter, copied diagnostics, nonce, session identifier, raw error, prompt, or document content.

Activity-panel opens, Activity clears, section toggles, and passive status renders are not tracked.

## Testing strategy

### Runtime bridge package

- Accept valid version-1 messages.
- Reject invalid types, versions, nonces, codes, and malformed data.
- Remain initializing after installation and emit no Ready reply before `markRuntimeReady()`.
- Retain only the newest valid pending check while initializing.
- Emit `bootstrap_failed` only after `markRuntimeError('bootstrap_failed')`.
- Reply only when the source is `window.parent` and the sender origin matches the origin parsed from `document.referrer`.
- Decline to reply when the referrer is absent or invalid.
- Reply to the requesting origin rather than `*`.
- Accept the actual parent origin without treating it as authenticated, consistent with the public-demo boundary.

### Runtime controller

Use fake timers and a mocked iframe window to cover:

- Not configured default.
- Invalid configured URL: no iframe, one Activity entry, one terminal analytics transition, safe diagnostics, and no target commands.
- Connecting on mount.
- Iframe load starting a check without setting Ready.
- Valid ready response.
- Five-second timeout.
- Explicit bridge error.
- Collision-resistant nonces from `crypto.randomUUID()` and single-use invalidation after every terminal or cancellation path.
- Recheck cancellation and nonce replacement.
- Reload generation and iframe-only remount.
- Stale reply after recheck, reload, route change, and unmount.
- Wrong source, origin, version, and nonce.
- Recovery event derivation.
- Runtime URL sanitization.

### Session Activity

- Semantic event formatting.
- Newest-first order.
- 50-entry bound.
- Cross-capability labels.
- Clear behavior.
- A full Cockpit page reload or shell unmount clears Activity.
- The Reload runtime command retains Activity while remounting only the iframe.
- Attention indicator set and cleared by state, not panel visibility.

### Diagnostics

- Query and hash removal.
- Exclusion of Cockpit telemetry and session parameters.
- Event truncation at 20.
- Exclusion of raw errors and arbitrary message data.
- Clipboard success and failure outcomes.

### Cockpit components

- Every Runtime phase and command state.
- Runtime disclosure persistence.
- Activity replacement-pane behavior and focus restoration.
- Run remains mounted across mode and utility changes.
- Reload remounts only Run's iframe.
- Settings remains reachable.
- Mobile focus trap, inert background, one exposed close control, and 44-pixel targets.
- Favicon does not reach catch-all route resolution.

### Docs components

- Read-only Runtime preview renders configured target and exact mapped capability.
- No live-health language appears.
- Open controls uses deterministic mapping and safe fallback.
- Handoff analytics contains no URL.
- Mobile drawer and search focus restoration.
- Sidebar focus does not scroll the main document.

### Browser and accessibility verification

- Exercise 1440 by 900, 768 by 900, 390 by 844, and 320-pixel-wide layouts.
- Check light and dark themes.
- Verify no horizontal overflow.
- Emulate forced colors and reduced motion.
- Verify page and server consoles, including favicon requests.
- Complete a manual VoiceOver pass.
- Re-run the production Chrome audit after deployment.

## Expected file-level changes

The implementation plan may refine names, but should preserve these boundaries.

### New private protocol package

- `libs/cockpit-runtime-bridge/src/lib/protocol.ts`
- `libs/cockpit-runtime-bridge/src/lib/install-runtime-bridge.ts`
- Corresponding unit tests, project configuration, and public API.

### Example bootstrap

- `libs/cockpit-telemetry/src/lib/harness.ts`
- All registry-discovered `cockpit/**/angular/src/main.ts` files, migrated mechanically to `bootstrapWithCockpitHarness()`.
- Existing `cockpit/**/angular/src/main.cockpit.ts` files remain on the same wrapper.
- A registry-derived drift test proving every Cockpit Angular entry point uses the wrapper.
- Harness tests proving the responder is installed once and Ready follows successful Angular bootstrap rather than module evaluation.

### Cockpit state and UI

- `apps/cockpit/src/lib/runtime-controller.ts`
- `apps/cockpit/src/lib/session-activity.ts`
- `apps/cockpit/src/components/control-plane/runtime-section.tsx`
- `apps/cockpit/src/components/control-plane/activity-panel.tsx`
- `apps/cockpit/src/components/cockpit-shell.tsx`
- `apps/cockpit/src/components/run-mode/run-mode.tsx`
- `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx`
- `apps/cockpit/src/components/mobile-nav-overlay.tsx`
- `apps/cockpit/src/lib/analytics/events.ts`
- `apps/cockpit/src/app/cockpit.css`
- Explicit Cockpit favicon asset or route.
- Corresponding tests.

### Deployment workflow

- `.github/workflows/ci.yml`
- Workflow tests that prove changed example/bridge artifacts deploy before the Cockpit shell.

### Docs preview and audit fixes

- `apps/website/src/components/docs/DocsControlPlane.tsx`
- `apps/website/src/components/shared/Nav.tsx`
- `apps/website/src/lib/analytics/events.ts`
- `apps/website/src/styles/docs.css`
- Corresponding tests.

### Shared UI

Reuse existing primitives by default. Modify `@threadplane/ui-react` only for behavior that is genuinely shared, such as focus restoration or coarse-pointer target sizing. Keep the Cockpit-only timeline and runtime semantics out of the shared package.

## Rollout order

1. Land the complete implementation in one PR: audit hardening, bridge lifecycle, controller, Cockpit operations, Docs preview, analytics, and deployment-order changes.
2. CI builds and verifies both the example artifacts and Cockpit before production deployment.
3. When bridge or example artifacts changed, the production job deploys Angular examples first. A failed example deployment stops the job before Cockpit deployment.
4. Deploy Cockpit only after the instrumented examples are live. The previously deployed Cockpit safely ignores v1 bridge messages during the gap.
5. Verify the deployed Cockpit handshake and control-plane flows, then run the production Chrome audit.

No feature flag is required while the existing single-job deploy order can enforce this sequence. If deployment is later split across independent jobs or repositories, the Cockpit operational UI must remain disabled until the matching protocol deployment is confirmed.

## Verification commands

Use the repository's actual Nx project names after inspecting project configuration. At minimum, verify the smallest affected surfaces and then their consumers:

- Runtime bridge unit tests, lint, and build.
- `cockpit-telemetry` tests, lint, and build.
- `ui-react` tests, lint, and build if modified.
- `npx nx test cockpit`
- `npx nx build cockpit`
- `npx nx test website`
- `npx nx lint website`
- `npx nx build website`
- Relevant browser end-to-end coverage.

Do not regenerate public agent context unless implementation changes public product guidance rather than shell behavior alone.

## Acceptance criteria

1. Cockpit displays Ready only after a valid, current, same-frame, same-origin runtime handshake.
2. A configured iframe load without a valid reply never becomes Ready.
3. The runtime bridge reports Ready only after explicit framework bootstrap success, not after bridge installation.
4. Every registry-discovered Cockpit Angular production and local-harness entry point uses the shared readiness-aware bootstrap wrapper.
5. Invalid runtime configuration mounts no frame, exposes no raw value, offers only sanitized diagnostics, and remains distinct from a bridge-reported Error.
6. Recheck, Reload runtime, Open runtime, and Copy diagnostics work without server lifecycle mutations.
7. Reload remounts only the runtime iframe and preserves capability, mode, theme, disclosure preferences, and Activity.
8. Runtime failure never makes Run, Code, Docs, API, navigation, or Settings inaccessible.
9. Activity is truthful, bounded to 50 entries, session-only, and independent of panel visibility.
10. Copied diagnostics include no query parameters, telemetry keys, session identifiers, nonces, raw errors, prompts, or document content.
11. Docs shows configured operational context and exact Cockpit handoff without claiming live health.
12. The control plane retains four primary modes; Activity and Settings remain bottom utilities.
13. Mobile drawers provide 44-pixel targets, focus trapping, inert background, one exposed close control, and reliable focus restoration.
14. Keyboard focus in the Docs sidebar does not scroll the main document canvas.
15. Remaining changed-surface headings use sentence case and the approved rounded interaction treatment.
16. Cockpit favicon requests resolve without entering capability route resolution.
17. Operational analytics contains only the approved events and safe properties.
18. Production deploys changed example bridge artifacts before the Cockpit shell exposes the operational UI.
19. Relevant unit, integration, Nx, browser, forced-colors, reduced-motion, and manual VoiceOver checks pass before merge.
