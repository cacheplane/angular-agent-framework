# examples/chat/smoke

Interactive CLI that scaffolds a fresh, npm-installed Angular consumer
of the canonical `examples/chat` demo. Used to validate that the
published `@threadplane/*` packages still behave correctly in a clean
external consumer.

## Run

```bash
npx nx run examples-chat-smoke:run
# or, equivalently:
node examples/chat/smoke/cli.mjs
```

## Flow

1. Prompts for target directory (default: `~/tmp/threadplane`).
2. If the target exists, asks: refresh / update in place / cancel.
3. Resolves the latest `@threadplane/chat` version from npm; prompts to override.
4. Copies `template/` (Angular CLI scaffold sans `src/app/`) into the target.
5. Copies `examples/chat/angular/src/app/` into the target's `src/app/`.
6. Selects an exact Angular compatibility lane with `--angular-major 20|21|22` (default: `21`) and rewrites all Angular, Angular CLI, and TypeScript pins from the registry.
7. Pins `@threadplane/*` deps to the resolved version, then runs `npm install` with strict peer resolution (`legacy-peer-deps=false`).
8. Optionally runs `npm start`.
9. Drops `CHECKLIST.md` and `SMOKE_RUN.md` (capture metadata, including the selected Angular lane) in the target.

## What's in `template/`

The Angular CLI bones — `package.json`, `angular.json`, `tsconfig`s,
`src/main.ts`, `src/styles.css`, `src/index.html`, `public/favicon.ico`.
The actual app code (`src/app/`) is **not** in the template — it's
copied from the live demo at generate-time. Result: the generator's
reviewable surface is just the scaffold; the app body never drifts.

The placeholder `"@threadplane/chat": "*"` in `template/package.json` is a
valid semver range ("any version"); the CLI replaces it with the
explicit `^X.Y.Z` it resolved before writing. The template supplies a
direct dependency closure for the default Angular 21 scaffold, while the
generator owns the exact Angular version pins for every generated consumer.

## Don't run `npm install` directly in `template/`

`template/` is a template, not a runnable consumer. Use the CLI from
the workspace root.
