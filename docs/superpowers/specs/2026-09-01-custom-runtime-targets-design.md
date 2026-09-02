# Custom AG-UI and LangSmith runtime targets

## Status

Approved through interactive design review on 2026-09-01. This is release 2 of the unified control-plane program and depends on the unified workspace shell.

## Summary

Let users connect the unified workspace to either their own AG-UI endpoint or a LangSmith deployment URL and API key. Endpoint metadata may be stored on the current device. API keys are memory-only: they are never persisted, placed in URLs, included in diagnostics, emitted to analytics, or forwarded through a Threadplane server.

The parent workspace remains the sole credential-management authority: it accepts, replaces, and clears credentials. It configures the mounted Angular runtime through a strict-origin, nonce-bound iframe handshake. Angular bootstraps with the selected runtime target in memory, acknowledges the exact configuration generation, and reports actionable health states back to the control plane. The trusted child Agent client may retain the key in volatile memory only for that configured generation so it can authorize requests.

## Goals

1. Support Shared development, Custom AG-UI, and Custom LangSmith targets.
2. Keep API keys memory-only across the entire browser flow.
3. Configure compatible Angular runtime examples without query parameters or browser storage.
4. Make authorization, CORS, network, configuration, and bridge failures distinguishable.
5. Preserve the existing shared-development default and standalone examples.
6. Apply one generated, drift-tested configuration contract across compatible Cockpit runtimes.

## Non-goals

- Remembering API keys after refresh, navigation away, or tab close.
- Account-synced targets or credential vaulting.
- Proxying custom traffic through Threadplane infrastructure.
- Deployment management, server restart, or mutation commands.
- Arbitrary request headers, OAuth flows, or custom authentication schemes.
- Claiming compatibility for static examples with no Agent transport.

## Target model

```ts
type SavedRuntimeTarget =
  | { id: 'shared'; kind: 'shared'; label: 'Shared development' }
  | { id: string; kind: 'ag-ui'; label: string; endpoint: string }
  | { id: string; kind: 'langsmith'; label: string; apiUrl: string };

type EphemeralCredentials = {
  targetId: string;
  kind: 'langsmith';
  apiKey: string;
} | null;
```

Only `SavedRuntimeTarget` enters device-local preferences. The `EphemeralCredentials` record exists only in React state owned by the mounted workspace provider. After configuration, the child Agent client's separately scoped volatile key copy is permitted only under the generation-lifetime rules below; it is never an `EphemeralCredentials` store or credential-management surface.

Release 2 stores target metadata in a dedicated `threadplane:runtime-targets:v1` record:

```ts
interface RuntimeTargetPreferencesV1 {
  version: 1;
  selectedTargetId: string;
  savedTargets: SavedRuntimeTarget[];
}
```

The record contains no credential field or extension bag. Invalid selected IDs fall back to `shared`; malformed custom targets are dropped individually. Release 3 may migrate this record into the unified workspace preference schema, but release 2 keeps this narrow store independently deployable.

After refresh, a saved LangSmith target is selected but enters `credentials_required` until the key is entered again. Removing or changing a target clears any matching ephemeral credentials immediately.

## Endpoint validation

- Require an absolute HTTP or HTTPS URL.
- Allow HTTP only for `localhost`, `127.0.0.1`, and `[::1]` development targets.
- Reject URL user information, fragments, and query strings.
- Normalize trailing slashes without changing the path.
- Reject values containing control characters.
- Never echo a rejected raw value into Activity or diagnostics.
- Display the normalized origin and path only after successful validation.

The UI derives and displays the exact Angular runtime origin from the selected capability's iframe URL. It explains that the custom server must allow that runtime origin—not the top-level workspace origin—in `Access-Control-Allow-Origin`. Local fake servers assert the received browser `Origin`, and production smoke asserts that the displayed required origin exactly matches the mounted runtime iframe origin. The application does not attempt to bypass CORS.

Compatible runtime deployments must permit validated targets in `connect-src`. Supporting arbitrary validated HTTPS endpoints inherently requires HTTPS network egress from the child runtime; local development additionally requires the allowlisted loopback HTTP origins. Deployment tests inspect the effective policy and prove a validated fake target is reachable. This allowance never changes the exact destination chosen by the Agent client, relaxes parent-message authorization, or permits Threadplane to proxy the request.

## Runtime compatibility

The workspace registry adds `runtimeAdapter: 'langgraph' | 'ag-ui' | 'none'`.

- LangSmith targets are available to `langgraph` entries.
- AG-UI targets are available to `ag-ui` entries. Runtime-portability entries that consume the AG-UI Agent contract are classified as `ag-ui`; there is no unnamed compatibility exception.
- `none` entries show the target selector as unavailable with a truthful explanation.
- Switching to an incompatible target is prevented before iframe configuration.

## Secure configuration protocol

Version 2 extends the existing private runtime bridge with child-ready, host-intent, configure, and acknowledge messages. Exact message names are centralized in `@threadplane/cockpit-runtime-bridge`.

```ts
interface RuntimeChildReadyMessage {
  type: 'tplane:runtime-child-ready';
  version: 2;
  nonce: string;
}

interface RuntimeHostMessage {
  type: 'tplane:runtime-host';
  version: 2;
  nonce: string;
  generation: number;
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
```

Security rules:

- The parent sends only to the exact iframe origin; never `*`.
- Compatible child builds receive an exact `allowedParentOrigins` list generated from the repository deployment configuration for production, named previews, and local development. Tests may inject explicit origins. Wildcards, suffix matching, and arbitrary referrer-derived authority are forbidden.
- The child accepts configuration only when `window.parent` is the message source, the referrer origin exactly matches one `allowedParentOrigins` entry, and the message origin equals that referrer origin.
- The unified host sets `referrerPolicy="origin"` on runtime iframes, and runtime deployment headers must not suppress that referrer. Deployment smoke verifies that the child receives the exact parent origin required for authorization.
- Both sides validate protocol version, message shape, nonce, generation, source window, and origin.
- Before Angular bootstrap, an allowed-parent child installs its listener, creates a fresh nonce, and sends `runtime-child-ready` to its exact referrer origin. The parent listener is installed before assigning the iframe source.
- The parent validates the ready message and responds to that exact source with `runtime-host` followed by `runtime-configure`, echoing the nonce and current generation. The child repeats ready and the parent repeats host/configure on bounded timers until the matching `runtime-configured` acknowledgement ends the handshake.
- The first valid configure payload accepted for a nonce and generation is authoritative. An identical duplicate re-sends `runtime-configured` without reconstructing the Agent client or repeating bootstrap. A conflicting payload for an accepted nonce and generation is rejected and reported with an allowlisted protocol error code.
- An embed whose referrer origin is allowlisted is recognized immediately and fails closed with `incompatible_bridge` if the handshake does not complete before the bounded deadline. It never bootstraps the Shared development default, even if every parent message is lost.
- A standalone window uses its registry default immediately. An embed whose referrer origin is not allowlisted is unrecognized, ignores every configuration message, and may use the existing registry default.
- The child Agent client may retain the key in a private in-memory closure or client object only for the acknowledged generation. Disposing or superseding that generation destroys the client reference; the child exposes no credential setter, reader, persistence path, diagnostic field, or serialized copy.
- Messages are never logged, serialized to diagnostics, or copied into DOM attributes.
- A newer generation invalidates every older configure or health response.
- The acknowledgement reveals no credential or endpoint value.

The protocol does not make an untrusted custom endpoint safe. It only protects configuration transport between the unified parent and the known Angular iframe.

## Angular bootstrap integration

Add a shared Angular runtime-target provider used by all compatible Cockpit applications.

- The lightweight bridge responder installs before Angular bootstrap.
- A recognized unified embed waits for valid configuration for a bounded interval and fails closed on timeout.
- A standalone or unrecognized embed uses its existing registry default as defined by the host-detection rules above.
- A shared `provideCockpitAgent(...)` integration resolves the selected target before `bootstrapApplication(...)` and delegates to `@threadplane/langgraph` or `@threadplane/ag-ui` as declared by the registry.
- Component-scoped Agent providers are migrated explicitly; a registry-derived drift test rejects compatible applications that bypass the target provider.
- Static render-only examples remain unchanged and declare `runtimeAdapter: 'none'`.

The migration must cover production and Cockpit entry points. No application may read a key from `window`, URL parameters, local storage, or session storage.

## Runtime state

Extend the control-plane state with:

```ts
type RuntimePhase =
  | ExistingRuntimePhase
  | 'credentials_required'
  | 'configuring'
  | 'unauthorized'
  | 'network_blocked'
  | 'incompatible_bridge';
```

Required behavior:

- `credentials_required` blocks mounting or configuring a LangSmith target until a key is entered.
- Clearing credentials increments generation, cancels checks, disposes the configured child client, unmounts the runtime iframe, and remains unmounted in `credentials_required` until a replacement key exists.
- `configuring` covers the nonce-bound target handshake.
- An explicit 401 or 403 response becomes `unauthorized` without exposing response bodies.
- Fetch rejection or an opaque browser failure becomes `network_blocked` and explains CORS or network causes without pretending to distinguish them.
- A configuration timeout or wrong protocol version becomes `incompatible_bridge`.
- Existing Ready, Recheck, Reload, and recovery behavior remains available after successful configuration.
- Any effective runtime configuration change—target kind, selected target ID, normalized endpoint, or LangSmith key—increments generation, cancels checks, disposes the old child client, and remounts the runtime iframe for a fresh pre-bootstrap handshake.
- Effective-configuration equality includes the selected target ID, kind, normalized endpoint, and the current in-memory key value. Selecting a different saved target therefore remounts even when two targets point to the same endpoint.
- Renaming a target, editing an unselected target, or re-selecting the already active unchanged configuration does not remount. Recheck and Reload retain their existing semantics.

## Settings experience

Settings contains a Runtime target section:

- Target type selector.
- Saved target selector.
- Add, rename, and remove custom endpoint metadata.
- Endpoint or API URL field.
- Password input for the current LangSmith key.
- Clear credentials action.
- Connection requirements and inline validation.
- The exact runtime origin the custom server must allow for CORS.

Saving a LangSmith URL does not imply that credentials were saved. The UI labels the key `For this tab only` and shows `Credentials required after refresh`.

## Diagnostics and privacy

Diagnostics may include:

- Target kind.
- Sanitized origin and path.
- Adapter kind.
- Runtime phase and allowlisted reason code.
- Protocol version and configuration generation.

Diagnostics must not include keys, authorization headers, raw postMessage payloads, prompts, response bodies, or rejected raw URLs. Existing analytics may record target kind and allowlisted outcome only; this release does not add endpoint values or expand behavioral tracking.

## Testing

- Pure validation tests for URL rules and credential separation.
- Preference serialization tests proving keys cannot be represented or persisted.
- Redaction tests across diagnostics, Activity, errors, and analytics property bags.
- Runtime bridge contract tests for exact parent allowlists, ready/host/configure retries, idempotent duplicates, conflicting duplicates, origin, source, nonce, generation, stale replies, lost messages, timeouts, and unknown messages.
- Angular bootstrap tests for custom configuration, standalone fallback, and component-scoped providers.
- Registry-derived coverage for every compatible Angular application.
- Browser E2E with local fake AG-UI and LangSmith servers, including exact request-origin assertions, CSP reachability, Ready, acknowledgement loss, unauthorized, CORS/network failure, refresh, live credential clearing, and target switching.
- Production smoke continues to use Shared development, asserts the displayed CORS origin equals the mounted iframe origin, and verifies the deployed child referrer and connection policies. No real user key is required in CI.

## Acceptance criteria

1. A user can run a compatible workspace against a custom AG-UI endpoint.
2. A user can run a compatible workspace against a LangSmith URL and tab-memory API key.
3. Refresh retains endpoint metadata and forgets the key.
4. Repository search and automated tests prove no key persistence or URL transport path exists.
5. Every compatible Angular runtime uses the shared target integration.
6. Failure states are actionable and contain no secret or arbitrary remote response text.
7. Shared development and standalone example behavior remain unchanged.
