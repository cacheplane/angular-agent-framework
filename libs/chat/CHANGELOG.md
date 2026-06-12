# `@threadplane/chat` changelog

## [Unreleased]

### Changed

- **`@angular/forms` peer dependency removed:** `chat-input` now binds its textarea with a direct `[value]`/`(input)` pair (fixes the composer keeping sent text under zoneless + OnPush). `@threadplane/chat` no longer requires `@angular/forms` — consumers may drop it unless they use it themselves.
- **json-render store isolation:** `<chat>`'s json-render message surfaces no longer fall back to the conversation-wide internal store — each surface self-seeds from its spec's `state` unless you pass an explicit `[store]`. Pass `[store]` (e.g. `signalStateStore({})`) when dashboards should receive backend agent state (STATE_SNAPSHOT) or share live values across surfaces; same-key dashboards in different messages are now isolated by default. Tool views (`chat-tool-views`) keep the previous shared-store behavior.
- **Public API trim:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, provide `MARKDOWN_VIEW_REGISTRY` directly using `overrideViews(cacheplaneMarkdownViews, { … })` from `@threadplane/render` — the previously-documented `provideViews(withViews(…))` pattern never actually drove rendering.
- **License:** `@threadplane/chat` is dual-licensed under PolyForm Noncommercial 1.0.0 (free noncommercial use) or a Threadplane Commercial license (production use inside a for-profit context).

### Migration

Commercial users need a Threadplane Commercial license before production deployment. See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use and the 30-day evaluation window, and <https://threadplane.ai/pricing> for plans.
