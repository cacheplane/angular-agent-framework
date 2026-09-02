# Memory-only custom AG-UI and LangSmith runtime targets

## Status

Approved through interactive design review on 2026-09-01 and amended after production validation on the same date. This amendment replaces the earlier endpoint-persistence design: endpoint URLs and API keys are both memory-only.

This is the third implementation PR in the control-plane follow-up. It depends on the unified workspace shell and Cockpit surface retirement, but not on the production-polish implementation details.

## Summary

Let users run compatible capabilities against either their own AG-UI endpoint or a LangSmith deployment URL and API key. The shared development deployment remains the default.

Every custom value is volatile. Endpoint URLs, API URLs, and keys may survive mode and capability changes inside the current browser document, but they disappear on full refresh, top-level navigation away, tab close, or explicit clearing. They never enter local storage, session storage, IndexedDB, cookies, URLs, analytics, diagnostics, Activity, logs, or a Threadplane server.

The top-level workspace owns target selection and credential lifetime. It configures the mounted Angular runtime through an exact-origin, nonce-bound iframe handshake. The child builds the appropriate Agent client for that configuration generation and retains any key only inside the resulting in-memory client. Replacing or clearing the generation disposes the client reference.

## Goals

1. Support Shared development, Custom AG-UI, and Custom LangSmith targets.
2. Keep every user-entered target value in memory only.
3. Preserve a custom target through Docs, Run, Code, API, and in-shell capability navigation without writing browser storage.
4. Configure compatible Angular examples without query parameters or credential-bearing globals.
5. Make validation, authorization, network/CORS, and bridge failures actionable without exposing secrets or remote response bodies.
6. Preserve existing shared-development and standalone-example behavior.

## Non-goals

- Remembering any custom value after refresh, navigation away, or tab close.
- Saved target lists, target naming, account sync, or credential vaulting.
- Proxying custom traffic through Threadplane infrastructure.
- Deployment management, server mutation, OAuth, arbitrary headers, or custom authentication schemes.
- AG-UI credentials; this release accepts only an AG-UI endpoint.
- Changing static examples that have no Agent transport.
- Proving a remote endpoint healthy before the user performs a protocol operation when that protocol has no safe standard health request.

## Session model and lifetime

Target state is keyed by runtime adapter so a LangSmith choice cannot block AG-UI capabilities and an AG-UI choice cannot leak into LangGraph capabilities.

```ts
type SharedTarget = { kind: 'shared' };

type AgUiTarget =
  | SharedTarget
  | { kind: 'ag-ui'; endpoint: string };

type LangGraphTarget =
  | SharedTarget
  | { kind: 'langsmith'; apiUrl: string; apiKey: string };

interface RuntimeTargetSession {
  agUi: AgUiTarget;
  langgraph: LangGraphTarget;
}
```

Both adapter slots default to `{ kind: 'shared' }`. A dedicated `RuntimeTargetProvider` owns the session above route content in the Website application root and mounts once per browser document. `WorkspaceProvider` consumes the provider and resolves the current capability's `runtimeAdapter` to the matching slot. The redirect-only Cockpit domain never mounts this provider.

The provider has no serializer, hydration path, storage key, URL reader, or module-global fallback. Tests fail if target fields are added to the existing control-plane preference schema. A full document reload constructs the default session again.

Settings maintains a local draft separate from the effective session. Typing never reconfigures the runtime. `Use custom target` validates and atomically replaces the matching effective slot. `Use shared development` immediately replaces that slot with `{ kind: 'shared' }` and clears its draft, including the key.

Closing Settings does not clear an applied custom target. Navigating to another capability with the same adapter reuses it. Navigating to the other adapter uses that adapter's independent slot. `runtimeAdapter: 'none'` always uses the existing static behavior and exposes no custom-target form.

## Endpoint validation

- Require an absolute HTTP or HTTPS URL.
- Allow HTTP only for `localhost`, `127.0.0.1`, and `[::1]` development targets.
- Reject URL user information, fragments, query strings, control characters, and empty values.
- Use URL parsing to normalize scheme, host casing, and default ports. Preserve the pathname exactly, including whether a non-root path ends in a slash; `/agent` and `/agent/` may be different endpoints.
- Require a non-empty key for Custom LangSmith, but never render the key outside its password input.
- Validate the draft before committing it. Invalid drafts do not replace a working target or remount the iframe.
- Never echo rejected raw values into errors, Activity, diagnostics, or analytics.
- Display the normalized origin and path only after validation succeeds.

The UI derives and displays the exact Angular runtime origin that the custom server must allow through CORS. It explains that this is the iframe origin, not necessarily the top-level workspace origin. The application does not attempt to bypass CORS.

Compatible runtime deployments must permit validated HTTPS destinations in `connect-src` and the allowlisted loopback HTTP destinations in local development. Deployment tests inspect the effective policy. This network allowance does not relax parent-message authorization or permit Threadplane to proxy a request.

## Runtime compatibility

The existing registry field remains authoritative:

```ts
type RuntimeAdapter = 'langgraph' | 'ag-ui' | 'none';
```

- `langgraph` entries use the LangGraph session slot and expose Custom LangSmith.
- `ag-ui` entries use the AG-UI session slot and expose Custom AG-UI.
- `none` entries show a concise explanation that runtime configuration is unavailable.
- The current manifest classification and its drift tests determine compatibility; there is no product-name heuristic or unnamed exception.
- A LangSmith target retains each capability's existing assistant or graph identifier. The user supplies only the API URL and key.

## Settings experience

The shared Settings utility adds a `Runtime target` section below Language and before Theme.

For a compatible capability it contains:

1. A two-option selector: Shared development or the adapter-compatible custom target.
2. An Endpoint field for AG-UI, or API URL and API key fields for LangSmith.
3. `Use custom target` as the explicit apply action.
4. `Use shared development` when custom configuration exists; this is the explicit clear action.
5. Inline validation and the exact runtime origin required for CORS.
6. A persistent-in-session note: `Kept in this tab until refresh. Nothing is saved.`

The API key uses a password input with browser autofill disabled as far as the platform permits. The UI does not offer reveal, copy, save, rename, or target-history actions. The active Runtime section shows only target kind plus sanitized origin and path. It never shows the key.

Mobile uses the existing control-plane utility panel. Fields and actions meet the 44px target baseline, the panel owns its scroll, and closing it restores focus to Settings.

## Secure configuration protocol

Version 2 extends the existing private runtime bridge with child-ready, configure, configured, configuration-failure, and operation-failure messages. Exact message names and parsers live in `@threadplane/cockpit-runtime-bridge`.

```ts
interface RuntimeChildReadyMessage {
  type: 'tplane:runtime-child-ready';
  version: 2;
  nonce: string;
}

interface RuntimeConfigureMessage {
  type: 'tplane:runtime-configure';
  version: 2;
  nonce: string;
  generation: number;
  target:
    | { kind: 'shared' }
    | { kind: 'ag-ui'; endpoint: string }
    | { kind: 'langsmith'; apiUrl: string; apiKey: string };
}

interface RuntimeConfiguredMessage {
  type: 'tplane:runtime-configured';
  version: 2;
  nonce: string;
  generation: number;
}

type RuntimeFailureMessage =
  | {
      type: 'tplane:runtime-configuration-failed';
      version: 2;
      nonce: string;
      generation: number;
      code: 'incompatible_bridge';
    }
  | {
      type: 'tplane:runtime-operation-failed';
      version: 2;
      nonce: string;
      generation: number;
      code: 'unauthorized' | 'network_blocked';
    };
```

The full protocol follows these rules:

- The parent sends only to the iframe's exact origin; never `*`.
- Compatible child builds receive an exact `allowedParentOrigins` array generated from repository deployment configuration for the production Website, supported Website previews, and explicit localhost development origins. The retired production Cockpit origin is not included. Wildcards, suffix matching, and referrer-derived additions are forbidden.
- A child is a recognized embed only when `window.parent !== window`, `document.referrer` parses to an exact member of `allowedParentOrigins`, and the incoming message source and origin match that parent. The runtime iframe keeps `referrerPolicy="origin"`, and deployment smoke verifies the referrer is not suppressed.
- The child accepts configuration only from `window.parent`, that exact recognized parent origin, the expected source window, and the current protocol version.
- A recognized child installs its listener before Angular bootstrap, creates a fresh nonce, and announces ready to its exact parent origin. A standalone window bootstraps its registry default immediately. An embedded window with a missing or unallowlisted referrer ignores configuration messages and uses its existing unrecognized-embed fallback.
- The parent listener exists before iframe navigation. It echoes the nonce and current generation in the configure message.
- Both sides validate message shape, nonce, generation, source, and origin.
- Ready and configure messages retry on bounded timers until the matching acknowledgement arrives.
- The first valid payload for a nonce and generation is authoritative. An identical duplicate only repeats the acknowledgement; a conflicting duplicate is rejected with an allowlisted failure code.
- A recognized embed fails closed if configuration does not complete before the bounded deadline. It does not silently bootstrap Shared development.
- A standalone or unrecognized embed keeps its existing registry default and ignores configuration messages.
- Messages and payloads are never logged, serialized, placed in DOM attributes, or copied into diagnostics.
- A newer generation invalidates older configure, acknowledgement, and failure messages.
- Configuration and operation failure messages contain allowlisted status codes only, never endpoint values, keys, authorization headers, error messages, or remote response text.

The protocol protects configuration transport between the known workspace and known Angular iframe. It does not make an untrusted custom endpoint safe.

## Angular bootstrap and client integration

A shared pre-bootstrap target resolver is used by every compatible embedded Angular example application.

- A recognized embed waits for the valid configuration message before constructing Angular providers.
- The resolver maps Shared development to the current environment configuration.
- It maps Custom AG-UI to `provideAgent({ url: endpoint })`.
- It maps Custom LangSmith to the existing capability assistant ID plus `apiUrl` and an explicit SDK `apiKey` client option.
- `@threadplane/langgraph` adds a narrowly typed `apiKey?: string | null` client option and passes it directly to the installed LangGraph SDK `Client`.
- The runtime resolver creates a generation-bound `reportOperationFailure` callback and supplies it through private adapter integration hooks. Existing AG-UI and LangGraph error catch points call the hook only when a classifier can prove HTTP 401/403 or a fetch/network failure. The callback sends `runtime-operation-failed` through the installed bridge. Unknown application errors remain in the Angular UI and are not reported to the parent.
- The Agent client exists only for the accepted generation. Superseding or clearing the generation destroys the Angular application/client reference before mounting the replacement.
- Component-scoped Agent providers are migrated explicitly. Registry-derived drift coverage rejects compatible applications that bypass the resolver.
- Static render-only applications remain unchanged and declare `runtimeAdapter: 'none'`.

The key may exist only in the explicitly generation-bound volatile references needed to use it: the root session state, the transient configure message, the child resolver/provider configuration, and the SDK client. JavaScript strings cannot be zeroed in place, so disposal means cancelling work and dropping every reachable reference owned by the application. No additional credential cache or reader is introduced.

Standalone examples still bootstrap immediately from their existing environment. No application reads target data from `window`, URL parameters, local storage, session storage, IndexedDB, or cookies.

## Runtime state and data flow

Add the following runtime phases to the current controller:

```ts
type CustomRuntimePhase =
  | 'configuring'
  | 'unauthorized'
  | 'network_blocked'
  | 'incompatible_bridge';
```

Data flows as follows:

1. Settings validates a draft and commits an adapter slot.
2. The provider derives an effective target for the current manifest entry.
3. Any effective change increments the configuration generation, cancels active checks, disposes the old iframe/client, and mounts a new iframe.
4. The parent and child complete the configuration handshake before Angular bootstrap.
5. The existing runtime-ready handshake continues after bootstrap.
6. The generation-bound adapter failure reporter may update the parent only with `unauthorized` or `network_blocked`; all other Agent errors remain inside the runtime.

Effective equality includes adapter, target kind, normalized endpoint, and—for LangSmith—the current in-memory key. Reapplying an identical configuration does not remount. Editing a draft does not remount. Recheck and Reload retain their existing semantics after configuration.

`Ready` continues to mean that the embedded runtime booted and accepted its configuration. It does not claim that an arbitrary remote server passed a universal health check. A 401 or 403 observed during an Agent operation becomes `unauthorized`. Fetch rejection or an opaque browser failure becomes `network_blocked` and explains that CORS or network policy may be responsible. A configuration timeout or protocol mismatch becomes `incompatible_bridge`.

Using Shared development or replacing a LangSmith configuration increments generation, cancels checks, disposes the client, and unmounts the configured runtime before mounting the replacement. No stale key-bearing client may remain reachable.

## Diagnostics, Activity, and analytics

Diagnostics and Activity may include:

- Target kind.
- Adapter kind.
- Runtime phase and allowlisted reason code.
- Protocol version and configuration generation.

They must not include endpoint origins or paths, keys, authorization headers, raw messages, raw drafts, rejected values, prompts, response bodies, or remote error text. The sanitized endpoint is visible only in the active Settings and Runtime UI for the current tab. Existing analytics may record target kind and allowlisted outcome only. This release does not add endpoint values or expand behavioral tracking.

## Document lifecycle and browser restoration

In-shell routing retains the root provider and therefore retains both adapter slots. A top-level navigation or reload fires `pagehide`; the provider synchronously resets both slots and clears mounted draft inputs before the document can enter the back-forward cache. A `pageshow` event with `persisted === true` defensively resets the provider again, so browser Back cannot revive a custom target from a cached document.

The form uses non-identifying field names. Endpoint fields use `autocomplete="off"`; the password input uses `autocomplete="new-password"` to avoid treating the value as a reusable login. The application never requests browser credential storage. Browser or password-manager behavior outside the application's control is not treated as an application persistence path, but E2E verifies that the DOM and provider state are empty after reload and a back-forward-cache restoration.

## Error handling

- Invalid input leaves the current effective target untouched and focuses the first invalid field.
- A failed handshake keeps Settings and non-Run modes usable and offers Reload or Shared development.
- Unauthorized and network failures do not clear the user's in-memory configuration automatically; using Shared development or refreshing does.
- Navigating to `runtimeAdapter: 'none'` leaves both adapter slots untouched but never sends either to the static iframe.
- If the browser blocks required storage APIs, custom targets are unaffected because they do not use storage.

## Testing

- Pure URL validation and normalization tests.
- Provider lifetime tests proving values survive in-shell mode/capability navigation and reset after provider remount.
- Lifecycle tests for `pagehide`, persisted `pageshow`, reload, and back-forward-cache restoration.
- Structural tests proving runtime-target fields cannot enter control-plane preferences or any storage serializer.
- Redaction tests across diagnostics, Activity, error objects, DOM attributes, and analytics property bags; sanitized endpoint text is permitted only in the active Settings and Runtime UI.
- Runtime bridge contract tests for exact allowlists, retries, idempotent duplicates, conflicting duplicates, origin, source, nonce, generation, stale replies, lost messages, timeouts, and unknown messages.
- `@threadplane/langgraph` tests proving the explicit key reaches the SDK `Client` and never appears in public diagnostics.
- Angular bootstrap tests for custom configuration, generation replacement, disposal, standalone fallback, and component-scoped providers.
- Registry-derived coverage for every compatible Angular application.
- Browser E2E with local fake AG-UI and LangSmith servers, including CORS origin assertions, CSP reachability, successful streaming, 401/403, network failure, reload clearing, live clearing, same-adapter navigation, and cross-adapter navigation.
- Production smoke continues to use Shared development and verifies that custom controls exist without entering a real endpoint or key.
- Repository scans reject runtime target storage keys and credential-bearing URL/message/log patterns.
- Because `@threadplane/langgraph` gains a public client option, run the smallest relevant API-doc and public agent-context generators and review their diffs.

## Acceptance criteria

1. A user can run an AG-UI-compatible capability against a custom AG-UI endpoint.
2. A user can run a LangGraph-compatible capability against a LangSmith URL and API key.
3. Both configurations survive in-shell navigation within the current document and disappear after full refresh, top-level navigation away, back-forward-cache restoration, or tab close.
4. Automated tests and repository scans prove that endpoint URLs and keys have no persistence, URL, analytics, diagnostics, Activity, or logging path.
5. Every compatible Angular runtime uses the shared pre-bootstrap resolver.
6. Replacing or clearing a target disposes the prior key-bearing client and rejects stale bridge messages.
7. Failure states are actionable and contain no secret or arbitrary remote response text.
8. Shared development and standalone example behavior remain unchanged.
