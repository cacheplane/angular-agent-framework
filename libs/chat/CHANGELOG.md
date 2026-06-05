# `@threadplane/chat` changelog

## [Unreleased]

### Changed

- **Public API trim:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, provide `MARKDOWN_VIEW_REGISTRY` directly using `overrideViews(cacheplaneMarkdownViews, { … })` from `@threadplane/render` — the previously-documented `provideViews(withViews(…))` pattern never actually drove rendering.
- **License:** `@threadplane/chat` is dual-licensed under PolyForm Noncommercial 1.0.0 (free noncommercial use) or a Threadplane Commercial license (production use inside a for-profit context).

### Migration

Commercial users need a Threadplane Commercial license before production deployment. See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use and the 30-day evaluation window, and <https://threadplane.ai/pricing> for plans.
