# `@threadplane/chat` changelog

## [Unreleased]

### Changed

- **`@angular/forms` peer dependency removed:** `chat-input` now binds its textarea with a direct `[value]`/`(input)` pair (fixes the composer keeping sent text under zoneless + OnPush). `@threadplane/chat` no longer requires `@angular/forms` — consumers may drop it unless they use it themselves.
- **json-render store isolation:** `<chat>`'s json-render message surfaces no longer fall back to the conversation-wide internal store — each surface self-seeds from its spec's `state` unless you pass an explicit `[store]`. Pass `[store]` (e.g. `signalStateStore({})`) when dashboards should receive backend agent state (STATE_SNAPSHOT) or share live values across surfaces; same-key dashboards in different messages are now isolated by default. Tool views (`chat-tool-views`) keep the previous shared-store behavior.
- **Public API trim:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, pass `overrideViews(cacheplaneMarkdownViews, { … })` from `@threadplane/render` to the `[viewRegistry]` input on `<chat-streaming-md>`. That input is the only override point: the component always provides `MARKDOWN_VIEW_REGISTRY` on its own injector, so an app-level or route-level provider for that token is shadowed and never reaches the markdown node components. The previously-documented `provideViews(withViews(…))` pattern never drove rendering either.
- **License:** `@threadplane/chat` is now MIT-licensed for commercial and noncommercial use. The package no longer accepts or checks activation tokens.
