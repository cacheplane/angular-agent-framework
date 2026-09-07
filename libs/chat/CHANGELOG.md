# `@threadplane/chat` changelog

## [Unreleased]

### Removed

- **`provideChat()`, `ChatConfig`, and `CHAT_CONFIG` are gone.** No component in the library ever injected the token, so calling `provideChat({})` configured nothing: `renderRegistry`, `avatarLabel`, and `assistantName` were values only your own wrappers could read back. Delete the call and the import; `provideAgent()` from your runtime adapter is the only provider the chat components require, and everything they render is driven by component inputs. If you were reading `CHAT_CONFIG` from your own components, define your own injection token for those values.

### Fixed

- **An application-level `MARKDOWN_VIEW_REGISTRY` provider now takes effect.** `<chat-streaming-md>` provided the token on its own injector from its own default, which shadowed any provider at the application root or on a route. It now resolves most-specific-first — the `[viewRegistry]` input, then an ancestor injector, then `cacheplaneMarkdownViews` — so one root provider overrides markdown rendering across every chat surface, including inside `<chat>`, with nothing to forward.

### Changed

- **`@angular/forms` peer dependency removed:** `chat-input` now binds its textarea with a direct `[value]`/`(input)` pair (fixes the composer keeping sent text under zoneless + OnPush). `@threadplane/chat` no longer requires `@angular/forms` — consumers may drop it unless they use it themselves.
- **json-render store isolation:** `<chat>`'s json-render message surfaces no longer fall back to the conversation-wide internal store — each surface self-seeds from its spec's `state` unless you pass an explicit `[store]`. Pass `[store]` (e.g. `signalStateStore({})`) when dashboards should receive backend agent state (STATE_SNAPSHOT) or share live values across surfaces; same-key dashboards in different messages are now isolated by default. Tool views (`chat-tool-views`) keep the previous shared-store behavior.
- **Public API trim:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, pass `overrideViews(cacheplaneMarkdownViews, { … })` from `@threadplane/render` to the `[viewRegistry]` input on `<chat-streaming-md>`, or provide the same value for `MARKDOWN_VIEW_REGISTRY` at the application root or on a route to override every markdown surface at once. The previously-documented `provideViews(withViews(…))` pattern never drove rendering.
- **License:** `@threadplane/chat` is now MIT-licensed for commercial and noncommercial use. The package no longer accepts or checks activation tokens.
