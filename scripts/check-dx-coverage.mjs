#!/usr/bin/env node
/**
 * DX-coverage guard: every public exported FUNCTION in the dev-facing
 * `@threadplane/*` libraries must carry a non-empty JSDoc summary so app
 * developers get hover guidance on the surface they actually call.
 *
 * Symbols tagged `@internal` are exempt (spec-only / implementation exports).
 * Run: `node scripts/check-dx-coverage.mjs` — exits non-zero on violations.
 */
import { Application, TSConfigReader, ReflectionKind } from 'typedoc';
import fs from 'fs';
import path from 'path';

const LIBRARIES = [
  { slug: 'chat', entryPoints: ['libs/chat/src/public-api.ts'] },
  { slug: 'ag-ui', entryPoints: ['libs/ag-ui/src/public-api.ts'] },
  { slug: 'langgraph', entryPoints: ['libs/langgraph/src/public-api.ts'] },
  { slug: 'render', entryPoints: ['libs/render/src/public-api.ts'] },
];

function summaryText(comment) {
  if (!comment?.summary) return '';
  return comment.summary.map((p) => p.text ?? '').join('').trim();
}

function isInternal(reflection, signature) {
  const tagged = (c) => !!c?.blockTags?.some((t) => t.tag === '@internal') || !!c?.modifierTags?.has?.('@internal');
  return tagged(reflection.comment) || tagged(signature?.comment);
}

/** A function is documented if either the reflection or its call signature has a summary. */
function functionHasSummary(reflection) {
  const sig = reflection.signatures?.[0];
  return summaryText(reflection.comment).length > 0 || summaryText(sig?.comment).length > 0;
}

function* walk(reflections) {
  for (const ref of reflections ?? []) {
    yield ref;
    if (ref.children) yield* walk(ref.children);
  }
}

async function main() {
  const violations = [];
  let checked = 0;

  for (const lib of LIBRARIES) {
    const missing = lib.entryPoints.filter((p) => !fs.existsSync(p));
    if (missing.length) {
      console.error(`✗ ${lib.slug}: entry point(s) not found: ${missing.join(', ')}`);
      process.exitCode = 1;
      continue;
    }
    const libDir = path.dirname(path.dirname(lib.entryPoints[0]));
    const libTsconfig = fs.existsSync(path.join(libDir, 'tsconfig.lib.json'))
      ? path.join(libDir, 'tsconfig.lib.json')
      : undefined;

    const app = await Application.bootstrapWithPlugins({
      entryPoints: lib.entryPoints,
      skipErrorChecking: true,
      excludeInternal: true,
      ...(libTsconfig ? { tsconfig: libTsconfig } : {}),
    });
    app.options.addReader(new TSConfigReader());
    const project = await app.convert();
    if (!project) throw new Error(`TypeDoc failed to convert ${lib.slug}`);

    for (const ref of walk(project.children)) {
      if (ref.kind !== ReflectionKind.Function) continue;
      if (isInternal(ref, ref.signatures?.[0])) continue;
      checked++;
      if (!functionHasSummary(ref)) {
        violations.push(`@threadplane/${lib.slug} :: ${ref.name}()`);
      }
    }
  }

  if (violations.length) {
    console.error(`\n✗ DX-coverage: ${violations.length} public function(s) missing a JSDoc summary:\n`);
    for (const v of violations.sort()) console.error(`   - ${v}`);
    console.error(`\nAdd a one-line summary (and ideally an @example), or mark the symbol @internal if it is not public API.`);
    process.exit(1);
  }

  console.log(`✓ DX-coverage: all ${checked} public functions across chat/ag-ui/langgraph/render have a JSDoc summary.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
