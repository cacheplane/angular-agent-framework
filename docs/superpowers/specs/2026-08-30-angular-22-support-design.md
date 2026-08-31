# Angular 22 Consumer Support Design

**Date:** 2026-08-30
**Status:** Reviewed; awaiting user approval
**Scope:** Add Angular 22 to the supported consumer-version contract without upgrading the monorepo authoring toolchain to Angular 22

## Summary

Threadplane will add Angular 22 as a supported consumer version by widening Angular peer ranges, making the fresh-consumer smoke harness version-aware, and adding strict install/build/runtime coverage for Angular 20, 21, and 22. The packages will continue to be built by the current Angular 21 toolchain in this change.

The monorepo-wide Angular 22 migration is intentionally deferred. That migration requires Nx 23.1 or newer, TypeScript 6, a newer Node floor, and broader source/configuration migrations. Combining it with the consumer-support change would make failures harder to attribute and would expand the release risk without being necessary to validate Angular 22 consumers.

## Context

The public compatibility matrix currently marks Angular 20 and 21 as supported and Angular 22 as planned. Angular-facing package manifests likewise advertise only `^20.0.0 || ^21.0.0`. The root workspace currently builds with Angular 21.1 and TypeScript 5.9.

Angular 22 changes more than the framework version:

- Angular 22 requires TypeScript `>=6.0.0 <6.1.0` and Node `^22.22.3 || ^24.15.0 || ^26.0.0` ([Angular version compatibility](https://angular.dev/reference/versions)).
- Nx supports Angular 22 starting at Nx 23.1 ([Nx and Angular compatibility](https://nx.dev/docs/kb/angular-nx-version-matrix)).
- TypeScript 6 changes defaults and deprecates `baseUrl`, which this workspace uses ([TypeScript 6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)).
- Angular 22 makes `ChangeDetectionStrategy.OnPush` the component default ([Angular advanced component configuration](https://angular.dev/guide/components/advanced-configuration)). Angular's update migration adds an explicit eager strategy to existing components to preserve prior behavior ([Angular core migrations](https://github.com/angular/angular/blob/main/packages/core/schematics/migrations.json)).

The publishable Angular libraries already use partial-Ivy compilation. Angular recommends partial-Ivy for npm libraries because application builds process that portable form with the consumer's compiler ([Angular library guidance](https://angular.dev/tools/libraries/creating-libraries)).

## Goals

1. Make npm accept Angular 22 consumers without `--force` or `--legacy-peer-deps`.
2. Prove that the exact package artifacts intended for release install and build in fresh Angular 20, 21, and 22 consumers.
3. Prove that a representative browser surface bootstraps and renders under each supported major, including Angular 22's change-detection default.
4. Keep package metadata, the executable compatibility matrix, and public documentation aligned.
5. Update public claims only after all supported-major checks pass.

## Non-goals

- Upgrading the root workspace to Angular 22, Nx 23, or TypeScript 6.
- Running Angular migration schematics across every application and library.
- Modernizing components to OnPush where doing so is unrelated to compatibility.
- Dropping Angular 20 or 21 support.
- Reworking the canonical chat demo or its backend behavior.
- Testing every feature against every Angular major. The matrix is a compatibility boundary test, not a duplicate of the full repository test suite.

## Chosen approach

### Support first; toolchain migration later

The support change will preserve the current Angular 21 build toolchain and validate the resulting partial-Ivy artifacts in external consumers. This isolates the consumer-facing contract from root migration work.

The alternatives were rejected for this change:

1. **One-shot root migration:** moving the root to Angular 22 would also require Nx 23.1+, TypeScript 6, Node updates, lint/documentation-tool upgrades, and Angular migrations. This is too broad for a support declaration.
2. **Oldest-compiler release lane:** compiling publishable artifacts with Angular 20 would most closely follow Angular's documented rule that an application compiler should not be older than the library compiler. It would require a second build toolchain or release workspace and is disproportionate for the current release process. Angular 20 compatibility remains an empirically tested project contract rather than a guarantee derived solely from Angular's compiler-version rule.

The selected design does not claim that peer-range editing alone creates support. Support is established by the external artifact matrix described below.

## Support contract

The supported majors are Angular 20, 21, and 22. A major is supported only when all of these checks pass against a fresh consumer:

1. npm resolves dependencies with legacy peer behavior disabled.
2. The consumer installs locally packed artifacts produced by the normal production library builds.
3. Angular completes a production application build.
4. A browser loads the generated application, Angular bootstraps successfully, and representative Threadplane UI is visible.
5. The browser run reports no uncaught page errors or console errors attributable to the packages.

The matrix will select one maintained minor line per major:

| Angular major | Framework line | TypeScript line | Node used in CI |
| --- | --- | --- | --- |
| 20 | latest supported 20.3 patch | 5.9 | 22.22.3 or newer |
| 21 | latest supported 21.2 patch | 5.9 | 22.22.3 or newer |
| 22 | latest supported 22.x patch | 6.0 | 22.22.3 or newer |

Exact patch versions live in one executable version registry rather than being repeated in workflow YAML, template metadata, and scripts. Version updates to that registry are ordinary dependency-maintenance changes.

## Design components

### 1. Executable Angular version registry

Create a small module next to the smoke harness that exports the supported-major records. Each record owns:

- Angular framework package versions;
- Angular CLI, builder, and compiler versions;
- TypeScript version;
- version-aligned Angular CDK and Google Maps dependencies used by the copied demo;
- the minimum Node version required by that lane.

The module validates unsupported majors early and produces a clear error listing accepted values. Unit tests cover record completeness, supported-major parsing, and rejection of unsupported values.

This module is the executable compatibility source of truth. Package peer ranges and website copy remain separate formats, so a verification script will compare them to the registry rather than attempting to generate package manifests or React source.

### 2. Version-aware fresh-consumer generator

Extend `examples/chat/smoke/cli.mjs` with `--angular-major <20|21|22>`. The generator will:

1. Copy the existing scaffold and canonical example sources.
2. Apply the selected Angular record to the generated `package.json`.
3. Pin Threadplane dependencies to local tarballs or the requested published version as it does today.
4. Include all direct dependencies required by the copied application. This fixes the current drift where the copied example imports Angular CDK, Google Maps, LangGraph SDK, licensing, and rendering dependencies that are absent from the smoke template.
5. Run installation with `legacy-peer-deps` explicitly disabled, regardless of the repository `.npmrc`.
6. Optionally run the production build and runtime verifier.

The checked-in smoke template should describe the consumer structure, not act as an independent Angular-version declaration. The generator overwrites every version-controlled Angular dependency from the selected registry before installation.

The generated consumer must actively compile a representative runtime import from every public Angular-facing package: `@threadplane/chat`, `@threadplane/langgraph`, `@threadplane/ag-ui`, `@threadplane/render`, and `@threadplane/telemetry`. Installing a tarball without importing it does not count as compatibility coverage. The canonical chat surface already exercises chat, LangGraph, render, and telemetry; the generated compatibility entrypoint will add an AG-UI probe and will keep explicit probes for the other packages so later demo refactors cannot silently reduce matrix coverage. Each probe must reference a runtime export in reachable application code so TypeScript-only imports or tree-shaken dead code cannot produce a false green build.

Install failures must preserve npm's output and identify the selected Angular lane. Unknown versions or missing local artifacts fail before changing the target directory.

### 3. Packaged-artifact CI matrix

The existing production library build remains the artifact producer. A new compatibility job will depend on it and use a matrix of Angular 20, 21, and 22.

For each lane, CI will:

1. Check out the same revision and restore/install root dependencies.
2. Download one uploaded production-build artifact from the library build job so every lane tests identical bytes.
3. Invoke the fresh-consumer generator with local package packing and the matrix major.
4. Install with `npm_config_legacy_peer_deps=false`.
5. Run the generated consumer's production build.
6. Start the generated application and run the backend-free browser verification.

The job uses an explicit Node version satisfying Angular 22, not the ambiguous `node-version: 22` label. The Angular 20 and 21 lanes use the same Node runtime so Angular major is the only intended variable.

The compatibility job should run whenever publishable-library source, Angular-facing package metadata, the smoke harness, the compatibility verifier, root dependency metadata, or the workflow itself changes. It may run unconditionally at first if integrating a new scope key would make the change unnecessarily complex.

The existing library producer is conditional, so compatibility-triggering changes must also force that producer to run and upload the production artifact. A matrix job must never be skipped or left waiting because its artifact-producing dependency was filtered out by CI scope detection.

### 4. Backend-free runtime verification

The runtime check reuses the generated canonical chat consumer but does not send a prompt or require a LangGraph deployment. It verifies the cold welcome state, which is locally renderable.

The verifier launches a Chromium page against the generated app and asserts:

- the root route reaches the embed welcome state;
- the “How can I help?” heading is visible;
- the message input is visible;
- a welcome suggestion is visible;
- at least one Threadplane custom element/component host is present;
- a visible AG-UI compatibility marker rendered by code that imports and instantiates the AG-UI probe is present;
- no uncaught page exception occurs;
- no unexpected console error occurs.

The existing root Playwright dependency can drive this check; the generated consumer does not need to own a second Playwright installation. Request failures to the intentionally absent backend are ignored only if they are known, narrowly matched startup probes. The preferred design is for cold bootstrap not to contact the backend at all.

This browser step is required because Angular 22 changes the default change-detection strategy. A production build proves linker and type compatibility but cannot prove that component state reaches the DOM.

### 5. Explicit change-detection behavior

Published components that omit `changeDetection` currently inherit a version-dependent default. The implementation will inventory those components and make their intended behavior explicit:

- choose `ChangeDetectionStrategy.OnPush` when existing state flow and tests demonstrate OnPush compatibility;
- otherwise choose `ChangeDetectionStrategy.Default` to preserve Angular 20–22 behavior;
- add or extend focused component tests for any component whose strategy becomes explicit.

`Default` is used for preservation rather than the new `Eager` spelling because the source must still compile against the current Angular 21.1 toolchain and remain compatible with Angular 20 consumers. No component is converted to OnPush solely as cleanup.

### 6. Peer metadata and drift guard

Update Angular peer ranges to `^20.0.0 || ^21.0.0 || ^22.0.0` in:

- `libs/chat/package.json`;
- `libs/langgraph/package.json`;
- `libs/ag-ui/package.json`;
- `libs/render/package.json`;
- `libs/telemetry/package.json`;
- `libs/cockpit-telemetry/package.json`;
- `libs/example-layouts/package.json`.

The first five are public package contracts. The last two are internal manifests kept aligned to prevent workspace-only resolution from concealing incompatibilities.

A repository verification script will fail if:

- an Angular-facing manifest omits a supported major;
- a manifest advertises a major absent from the executable registry;
- the pricing compatibility data disagrees with the registry;
- Angular 22 is still represented as planned after the matrix is enabled.

The check reads structured package JSON and the exported version registry. Website compatibility data should be moved to a small exported data module if necessary so the verifier and React component can consume a stable structure without parsing TSX text.

### 7. Documentation and public claims

Only after all three compatibility lanes pass:

- move Angular 22 from “Planned” to “Supported” in the pricing matrix;
- update pricing detail copy that names Angular 20 and 21;
- update root and package README compatibility badges/ranges;
- update active installation documentation for chat, LangGraph, AG-UI, and render;
- document Angular 22's Node minimum where consumers choose framework versions.

Historical posts remain historical. Generated public context or API/narrative documentation is regenerated only if its source inputs actually change; no generator runs solely because compatibility metadata changed elsewhere.

## Data flow

```text
supported version registry
        │
        ├── smoke generator rewrites fresh consumer dependencies
        │          │
        │          ├── strict npm install of packed dist artifacts
        │          ├── Angular production build
        │          └── backend-free browser bootstrap
        │
        └── drift verifier compares
                   ├── Angular peer ranges
                   └── website compatibility data
```

The release artifact flows in one direction: normal production library build → npm tarballs → external consumer. Compatibility tests must not import library source through workspace path mappings.

## Failure behavior and diagnostics

- **Peer-resolution failure:** npm output is retained and the lane fails before build. The test must never retry with legacy peers.
- **Missing smoke dependency:** build output identifies the unresolved package; the dependency is added to the explicit consumer manifest rather than hidden through root resolution.
- **Angular compiler/linker failure:** the affected major fails independently, preserving the other matrix results.
- **Runtime bootstrap failure:** Playwright retains console errors, page exceptions, and a screenshot/trace as CI artifacts.
- **Documentation drift:** the verifier names the mismatched file, actual range/status, and expected supported majors.
- **Unsupported requested major:** the CLI exits non-zero before removing or copying the target and prints the supported values.

## Testing strategy

### Unit tests

- Version registry contains complete records for 20, 21, and 22.
- CLI argument parsing accepts supported majors and rejects unsupported or missing values.
- Package rewriting pins all Angular-related dependencies to the selected record.
- The drift verifier detects missing, extra, and stale majors.

### Integration tests

- Existing smoke-generator tests continue to cover local tarball packing and Threadplane package pinning.
- A lightweight fixture verifies that each lane produces the expected consumer `package.json` without running npm.
- Production package builds are inspected to confirm their emitted manifests contain the new peer ranges.

### Compatibility tests

For each Angular major, run strict install, production build, and browser bootstrap using packed release artifacts. The generated compatibility entrypoint must cause all five public Angular-facing packages to be compiled, and the browser check must exercise at least the chat surface plus the AG-UI probe. Angular 22 must execute under a supported Node and TypeScript 6 combination.

### Existing project verification

Run targeted lint, unit tests, and production builds for `chat`, `langgraph`, `ag-ui`, `render`, and `telemetry`, followed by website tests/build for the compatibility-copy changes.

## Rollout and release gate

The support change is one atomic branch/PR. Its implementation commits may be incremental, but no intermediate commit is a releasable support state and the final PR state must satisfy every release gate below.

1. Add the executable registry, harness repair, compatibility entrypoint, and their tests while retaining the existing public support claims.
2. Widen peers and make component change-detection behavior explicit so strict Angular 22 installation can succeed.
3. Add the three-major CI matrix, download the single production-build artifact in every lane, and confirm all packaged-artifact lanes pass.
4. Update documentation and pricing to mark Angular 22 supported.
5. Add/enable the drift verifier only after the executable registry, peer ranges, and website support status represent the same final set. Make the compatibility job and drift check required for relevant changes.
6. Publish the next package release only after generated tarball inspection and a final strict Angular 22 smoke run.

The drift verifier has one final-state contract; it does not need a permissive “planned” mode. During implementation it may be introduced after the other metadata changes, and the PR is not ready to merge until the verifier passes.

If the Angular 22 browser lane reveals behavior that cannot be fixed without a root Angular 22 migration, Angular 22 remains planned and that blocker becomes input to the separate toolchain-migration design.

## Risks and mitigations

### Angular 20 is older than the build compiler

Angular documents that an application's compiler should be at least as new as a dependent library's compiler. The repository already builds with Angular 21 while advertising Angular 20. The Angular 20 lane therefore remains an empirical compatibility commitment backed by CI, not a guarantee derived from Angular's documented compiler direction. A future oldest-compiler release design may remove that ambiguity.

### Root npm settings can conceal peer errors

The root `.npmrc` enables `legacy-peer-deps`. Compatibility installs explicitly disable it and run in a generated consumer so peer failures remain visible.

### Smoke-template drift

Copying the full canonical demo makes the smoke test representative but creates dependency drift. The generated manifest will explicitly include every imported third-party package, and build failures are treated as harness defects rather than worked around with root resolution.

### Angular 22 default OnPush behavior

Missing component metadata can turn a compile-success into a runtime regression. Explicit strategies plus browser assertions make the behavior stable across supported majors.

### Matrix cost and flakiness

Build artifacts are produced once and reused. The runtime assertion is backend-free and narrow. Full feature E2E remains on the root workspace rather than being multiplied across three majors.

## Deferred Angular 22 root migration

A separate design will cover:

- updating to the latest Nx 22 minor, then Nx 23.1+ using generated migrations;
- upgrading root Angular packages and `ng-packagr` to 22;
- adopting TypeScript 6 and resolving `baseUrl`, module-resolution, and implicit `types` assumptions;
- enforcing a Node version supported by Angular 22 in local setup and every CI job that runs `npm ci`;
- updating Angular ESLint, typescript-eslint, Analog, TypeDoc, and other TypeScript/Angular-coupled tools;
- reviewing Angular 22 component, template, hydration, HTTP, routing, test-runner, and builder migrations;
- running the full workspace test/build/E2E surface.

That migration may follow immediately after consumer support, but it is not a prerequisite for advertising Angular 22 consumption once this design's release gate is satisfied.

## Definition of done

1. Every Angular-facing manifest advertises Angular 20, 21, and 22 consistently.
2. Strict fresh-consumer installs succeed for all three majors without legacy peer behavior.
3. The same packed production artifacts build successfully in all three consumers.
4. Backend-free Chromium bootstrap checks pass in all three consumers with no unexpected errors.
5. Published component behavior does not depend unintentionally on the consumer compiler's default change-detection strategy.
6. CI prevents compatibility metadata and public compatibility copy from drifting.
7. Pricing, active documentation, and README compatibility statements mark Angular 22 supported only after the matrix is green.
8. Root Angular 22/Nx 23/TypeScript 6 migration work remains outside this change.
