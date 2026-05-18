# @ngaf/render

Generative UI for Angular. Agents emit structured JSON specs; this library renders them into Angular components you already own. Supports the Vercel `json-render` and Google A2UI v1-compatible protocols out of the box.

Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.

## Install

```bash
npm install @ngaf/render
```

## What it does

- **Spec-driven rendering** — agents return JSON; you map each node type to one of your Angular components via a registry
- **Two protocols supported** — Vercel `json-render` and Google A2UI v1-compatible
- **Per-component fallback API** — when a spec node has no registered component, you control what renders (and surface it to your observability layer)
- **Readiness gate** — holds renders until the surface is real, so users never see mystery partial UI
- **Streaming partial renders** — works with `@cacheplane/partial-json` to render progressive JSON as it streams

## Documentation

- [Quickstart](https://threadplane.ai/docs/render/getting-started/quickstart)
- [Component registry](https://threadplane.ai/docs/render/guides/registry)
- [Fallback patterns](https://threadplane.ai/docs/render/guides/fallback)
- [A2UI v1-compatible protocol](https://threadplane.ai/docs/render/a2ui/overview)

## License

MIT — free for any use. See [LICENSE](../../LICENSE).
