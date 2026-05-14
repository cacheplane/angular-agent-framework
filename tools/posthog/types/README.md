# Generated PostHog API types

`posthog-api.gen.ts` is generated from PostHog's published OpenAPI spec at
https://us.posthog.com/api/schema/. It is committed to the repo deliberately:

- Avoids a build-time network call to PostHog (faster, more reliable).
- Makes type-shift visible in PRs (you can `git blame` field renames).
- Keeps `tsx` startup fast (no runtime codegen step).

## Regenerating

Run quarterly or whenever PostHog announces an API change:

```bash
npx nx run posthog-tools:generate-types
```

This rewrites `posthog-api.gen.ts` in place. Commit the diff if PostHog's API
changed; review the diff carefully — field renames or required-field additions
will surface here.
