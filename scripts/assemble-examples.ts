#!/usr/bin/env npx tsx
/**
 * Build all Angular example apps and assemble them into the Vercel deploy directory.
 *
 * Output: deploy/examples/{product}/{topic}/ with index.html, main.js, styles.css
 *
 * Usage:
 *   npx tsx scripts/assemble-examples.ts
 *   npx tsx scripts/assemble-examples.ts --skip-build
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy/examples');
const skipBuild = process.argv.includes('--skip-build');

const capabilities = [
  { product: 'langgraph', topic: 'streaming' },
  { product: 'langgraph', topic: 'persistence' },
  { product: 'langgraph', topic: 'interrupts' },
  { product: 'langgraph', topic: 'memory' },
  { product: 'langgraph', topic: 'durable-execution' },
  { product: 'langgraph', topic: 'subgraphs' },
  { product: 'langgraph', topic: 'time-travel' },
  { product: 'langgraph', topic: 'deployment-runtime' },
  { product: 'deep-agents', topic: 'planning' },
  { product: 'deep-agents', topic: 'filesystem' },
  { product: 'deep-agents', topic: 'subagents' },
  { product: 'deep-agents', topic: 'memory' },
  { product: 'deep-agents', topic: 'skills' },
  { product: 'deep-agents', topic: 'sandboxes' },
  { product: 'render', topic: 'spec-rendering' },
  { product: 'render', topic: 'element-rendering' },
  { product: 'render', topic: 'state-management' },
  { product: 'render', topic: 'registry' },
  { product: 'render', topic: 'repeat-loops' },
  { product: 'render', topic: 'computed-functions' },
  { product: 'chat', topic: 'messages' },
  { product: 'chat', topic: 'input' },
  { product: 'chat', topic: 'interrupts' },
  { product: 'chat', topic: 'tool-calls' },
  { product: 'chat', topic: 'subagents' },
  { product: 'chat', topic: 'threads' },
  { product: 'chat', topic: 'timeline' },
  { product: 'chat', topic: 'generative-ui' },
  { product: 'chat', topic: 'debug' },
  { product: 'chat', topic: 'theming' },
  { product: 'chat', topic: 'a2ui' },
  { product: 'ag-ui', topic: 'interrupts' },
  { product: 'ag-ui', topic: 'streaming' },
];

if (!skipBuild) {
  console.log(`Building all ${capabilities.length} Angular apps...`);
  execSync("npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache", {
    cwd: root,
    stdio: 'inherit',
  });
}

if (existsSync(deployDir)) rmSync(deployDir, { recursive: true });

for (const cap of capabilities) {
  const src = resolve(root, `dist/cockpit/${cap.product}/${cap.topic}/angular`);
  const dest = resolve(deployDir, `${cap.product}/${cap.topic}`);

  if (!existsSync(src)) {
    console.error(`❌ Missing build output: ${src}`);
    process.exit(1);
  }

  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });

  // Fix <base href="/"> to point to the correct subpath so assets resolve correctly.
  // Without this, main.js/styles.css/chunks load from the root (/) instead of
  // /{product}/{topic}/ and return 404 in production.
  const indexPath = resolve(dest, 'index.html');
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    const fixed = html.replace(
      '<base href="/">',
      `<base href="/${cap.product}/${cap.topic}/">`,
    );
    writeFileSync(indexPath, fixed);
  }

  console.log(`✅ ${cap.product}/${cap.topic}`);
}

// Create Vercel Build Output API structure for the serverless proxy
// This bypasses Vercel's auto-routing which doesn't handle multi-segment catch-alls correctly
const outputDir = resolve(deployDir, '.vercel/output');
const staticDir = resolve(outputDir, 'static');
const funcDir = resolve(outputDir, 'functions/api/[[...path]].func');
// NOTE: deliberately NOT under functions/api/ — that would re-trigger the
// langgraph proxy rule on the rewrite (check: true causes re-evaluation,
// and ^/api/(.*) would catch /api/ag-ui-proxy/* and shadow the function).
const agUiFuncDir = resolve(outputDir, 'functions/ag-ui-proxy/[[...path]].func');

// Copy static files to the output directory
mkdirSync(staticDir, { recursive: true });
for (const cap of capabilities) {
  const src = resolve(deployDir, `${cap.product}/${cap.topic}`);
  const dest = resolve(staticDir, `${cap.product}/${cap.topic}`);
  cpSync(src, dest, { recursive: true });
}

// Build the langgraph proxy serverless function (existing)
mkdirSync(funcDir, { recursive: true });
execSync(`npx esbuild scripts/examples-middleware.ts --bundle --format=cjs --platform=node --outfile=${funcDir}/index.js`, {
  cwd: root,
  stdio: 'inherit',
});
writeFileSync(resolve(funcDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
}, null, 2));

// Build the ag-ui proxy serverless function (forwards /ag-ui/<topic>/agent
// requests to the Railway-hosted FastAPI runtime with origin allowlist +
// Upstash rate limit + X-Internal-Token injection).
mkdirSync(agUiFuncDir, { recursive: true });
execSync(`npx esbuild scripts/ag-ui-proxy.ts --bundle --format=cjs --platform=node --outfile=${agUiFuncDir}/index.js`, {
  cwd: root,
  stdio: 'inherit',
});
writeFileSync(resolve(agUiFuncDir, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
}, null, 2));

// Write output config with proper routing
writeFileSync(resolve(outputDir, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    // ag-ui proxy: /ag-ui/<topic>/agent[/rest] → ag-ui-proxy function.
    // Mirrors the langgraph rule exactly: dest names the catch-all function
    // (`[[...path]]`), which invokes it while PRESERVING the original request
    // URL in req.url. The function (scripts/ag-ui-proxy.ts) parses the topic
    // out of `/ag-ui/<topic>/agent`. A function is only reachable when a route
    // dest names it like this — the filesystem handle does NOT auto-serve
    // catch-all functions. Must precede the filesystem handle so static
    // index.html lookups for /ag-ui/<topic>/ still resolve.
    { src: '^/ag-ui/([^/]+)/agent(/.*)?$', dest: '/ag-ui-proxy/[[...path]]', check: true },
    { src: '^/api/(.*)', dest: '/api/[[...path]]', check: true },
    { handle: 'filesystem' },
    { src: '^/(langgraph|deep-agents|render|chat|ag-ui)/([^/]+)/(.+\\..+)$', dest: '/$1/$2/$3' },
    { src: '^/(langgraph|deep-agents|render|chat|ag-ui)/([^/]+)(/.*)?$', dest: '/$1/$2/index.html' },
    { handle: 'error' },
    { status: 404, src: '.*', dest: '/404.html' },
  ],
}, null, 2));

console.log('✅ .vercel/output/ (Build Output API with langgraph + ag-ui proxies)');

console.log(`\nAssembled ${capabilities.length} apps + proxy to ${deployDir}`);
