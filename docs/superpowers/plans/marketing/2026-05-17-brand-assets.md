# Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `@threadplane/marketing-assets` skeleton with a real `renderCard()` that turns typed input into branded PNG social cards via satori + @resvg/resvg-js, shipping two templates (`x-card`, `og-card`) that share one `CardShell` and brand-token source.

**Architecture:** TDD where it pays. Phase 0 wires deps + JSX config + bundled fonts. Phase 1 adds brand/fonts/logo modules. Phase 2 builds the templates. Phase 3 implements `renderCard()`. Phase 4 adds preview + docs. satori turns plain-function JSX into SVG; resvg rasterizes to PNG. Fonts + the plane logo are bundled (no runtime fetch) and copied into `dist/` via the Nx build assets array.

**Tech Stack:** TypeScript 5.x (`.tsx`, `jsx: react-jsx`), satori, @resvg/resvg-js, react (jsx-runtime only), Vitest 4.x, Node 22. The package is internal (`private: true`), never published.

**Spec reference:** `docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md`. Branch: `marketing-brand-assets` (off main). `marketing/assets/brand/plane.png` (160×160) is already committed.

---

## File Structure

**Modified:**
- `marketing/assets/package.json` — add `satori`, `@resvg/resvg-js`, `react` deps + build assets array
- `marketing/assets/project.json` — add `test` target
- `marketing/assets/tsconfig.lib.json` — enable `.tsx` + JSX + dom lib
- `marketing/assets/src/index.ts` — rewrite skeleton → real exports
- root `package.json` — (no change; deps live in the package)

**New:**
- `marketing/assets/vite.config.mts`
- `marketing/assets/fonts/{EBGaramond-Bold.ttf, Inter-Regular.ttf, Inter-SemiBold.ttf}`
- `marketing/assets/src/types.ts`
- `marketing/assets/src/brand.ts`
- `marketing/assets/src/fonts.ts` + `fonts.spec.ts`
- `marketing/assets/src/logo.ts` + `logo.spec.ts`
- `marketing/assets/src/templates/card-shell.tsx`
- `marketing/assets/src/templates/x-card.tsx`
- `marketing/assets/src/templates/og-card.tsx`
- `marketing/assets/src/templates/registry.ts`
- `marketing/assets/src/render.ts` + `render.spec.ts`
- `marketing/assets/scripts/preview.ts`
- `marketing/assets/preview/.gitkeep` + `.gitignore`
- `marketing/assets/README.md`

**Already in place:** `marketing/assets/brand/plane.png`

---

## Task 1: Add deps + JSX config + vitest config

**Files:**
- Modify: `marketing/assets/package.json`
- Modify: `marketing/assets/tsconfig.lib.json`
- Modify: `marketing/assets/project.json`
- Create: `marketing/assets/vite.config.mts`

- [ ] **Step 1: Add runtime deps to package.json**

Edit `marketing/assets/package.json` to add a `dependencies` block (the skeleton has none). Final file:

```json
{
  "name": "@threadplane/marketing-assets",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "marketing/assets"
  },
  "sideEffects": false,
  "private": true,
  "dependencies": {
    "satori": "^0.12.0",
    "@resvg/resvg-js": "^2.6.2",
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install satori@^0.12.0 @resvg/resvg-js@^2.6.2 --workspace marketing/assets --package-lock-only && npm install --no-audit --no-fund`

Expected: satori + @resvg/resvg-js resolve in the lockfile. **Per project memory**, if `@next/swc-*` platform bindings change in the lockfile diff, revert with `git checkout package-lock.json` and retry with `--package-lock-only` only.

Verify the native binary loaded:
```bash
node -e "const {Resvg}=require('@resvg/resvg-js'); console.log(typeof Resvg)"
node -e "console.log(typeof require('satori').default)"
```
Expected: `function` then `function`.

- [ ] **Step 3: Enable JSX + dom lib in tsconfig.lib.json**

Replace `marketing/assets/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true,
    "jsx": "react-jsx",
    "lib": ["es2022", "dom"],
    "types": ["node", "react"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.spec.tsx"]
}
```

- [ ] **Step 4: Create vite.config.mts**

```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
```

- [ ] **Step 5: Add test target + build assets array to project.json**

Replace `marketing/assets/project.json`:

```json
{
  "name": "marketing-assets",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "marketing/assets/src",
  "projectType": "library",
  "tags": ["scope:marketing", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/marketing/assets"],
      "options": {
        "outputPath": "dist/marketing/assets",
        "main": "marketing/assets/src/index.ts",
        "tsConfig": "marketing/assets/tsconfig.lib.json",
        "assets": [
          { "input": "marketing/assets/fonts", "glob": "**/*", "output": "fonts" },
          { "input": "marketing/assets/brand", "glob": "**/*", "output": "brand" }
        ]
      }
    },
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "configFile": "marketing/assets/vite.config.mts"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 6: Verify Nx sees the test target**

```bash
npx nx show project marketing-assets --json | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(Object.keys(JSON.parse(s).targets)))"
```
Expected: includes `build`, `test`, `lint`.

- [ ] **Step 7: Commit**

```bash
git add marketing/assets/package.json marketing/assets/tsconfig.lib.json marketing/assets/project.json marketing/assets/vite.config.mts package.json package-lock.json
git commit -m "chore(marketing/assets): add satori + resvg deps, JSX config, vitest target"
```

---

## Task 2: Bundle fonts

**Files:**
- Create: `marketing/assets/fonts/EBGaramond-Bold.ttf` (copy)
- Create: `marketing/assets/fonts/Inter-Regular.ttf`
- Create: `marketing/assets/fonts/Inter-SemiBold.ttf`

- [ ] **Step 1: Copy the Garamond TTF from the website**

```bash
mkdir -p marketing/assets/fonts
cp apps/website/src/app/EBGaramond-Bold.ttf marketing/assets/fonts/EBGaramond-Bold.ttf
```

Verify:
```bash
file marketing/assets/fonts/EBGaramond-Bold.ttf
```
Expected: `TrueType Font data` (or similar).

- [ ] **Step 2: Fetch Inter Regular + SemiBold static TTFs**

satori needs static-weight TTFs (not variable, not woff2). Download Inter 400 + 600 static TTFs from the official rsms/inter release:

```bash
curl -fsSL -o /tmp/inter.zip https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip
mkdir -p /tmp/inter-extract
unzip -o /tmp/inter.zip -d /tmp/inter-extract >/dev/null
find /tmp/inter-extract -name 'Inter-Regular.ttf' -path '*static*' | head -1
find /tmp/inter-extract -name 'Inter-SemiBold.ttf' -path '*static*' | head -1
```

Copy the two located static TTFs into `marketing/assets/fonts/`:

```bash
cp "$(find /tmp/inter-extract -name 'Inter-Regular.ttf' -path '*static*' | head -1)" marketing/assets/fonts/Inter-Regular.ttf
cp "$(find /tmp/inter-extract -name 'Inter-SemiBold.ttf' -path '*static*' | head -1)" marketing/assets/fonts/Inter-SemiBold.ttf
```

Verify both are TrueType and non-empty:
```bash
file marketing/assets/fonts/Inter-Regular.ttf marketing/assets/fonts/Inter-SemiBold.ttf
ls -la marketing/assets/fonts/
```
Expected: both `TrueType Font data`, sizes > 100KB.

**Fallback if the rsms/inter release URL 404s** (version moved): download from Google Fonts' GitHub mirror instead —
```bash
curl -fsSL -o marketing/assets/fonts/Inter-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"
```
— but that is a *variable* font satori can't parse. If the static rsms release is unavailable, STOP and ask the controller for static Inter TTFs rather than committing a variable font.

- [ ] **Step 3: Commit**

```bash
git add marketing/assets/fonts/
git commit -m "feat(marketing/assets): bundle Garamond + Inter static TTFs"
```

---

## Task 3: `types.ts` + `brand.ts`

**Files:**
- Create: `marketing/assets/src/types.ts`
- Create: `marketing/assets/src/brand.ts`

- [ ] **Step 1: Create types.ts**

```ts
// SPDX-License-Identifier: MIT
export type TemplateId = 'x-card' | 'og-card';

export interface CardInput {
  template: TemplateId;
  /** Headline. Required. Garamond serif, large. */
  title: string;
  /** Supporting line under the headline. Optional. */
  subtitle?: string;
  /** Kicker above the headline. Optional. Defaults to brand.defaultEyebrow. */
  eyebrow?: string;
  /** Bottom-left attribution. When present, replaces the trust pills. */
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}
```

- [ ] **Step 2: Create brand.ts**

```ts
// SPDX-License-Identifier: MIT
//
// Palette + wordmark lifted verbatim from apps/website/src/app/opengraph-image.tsx
// so marketing cards and the site share one visual language. The plane logo is
// NOT here — it's the bundled brand/plane.png, loaded via logo.ts.
export const brand = {
  gradient: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
  ink: '#1a1a2e',
  inkSoft: '#555770',
  accent: '#004090',
  angular: '#DD0031',
  wordmark: 'cacheplane.ai',
  serif: 'EB Garamond, Georgia, serif',
  sans: 'Inter, sans-serif',
  defaultEyebrow: 'Agent UI for Angular · MIT',
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add marketing/assets/src/types.ts marketing/assets/src/brand.ts
git commit -m "feat(marketing/assets): add types + brand tokens"
```

---

## Task 4: `fonts.ts` + tests (TDD)

**Files:**
- Create: `marketing/assets/src/fonts.ts`
- Create: `marketing/assets/src/fonts.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/assets/src/fonts.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadFonts } from './fonts';

describe('loadFonts', () => {
  it('returns three font entries with expected names + weights', async () => {
    const fonts = await loadFonts();
    expect(fonts).toHaveLength(3);
    const byName = fonts.map((f) => `${f.name}:${f.weight}`);
    expect(byName).toContain('EB Garamond:700');
    expect(byName).toContain('Inter:400');
    expect(byName).toContain('Inter:600');
    for (const f of fonts) {
      expect(f.data.byteLength).toBeGreaterThan(1000);
      expect(f.style).toBe('normal');
    }
  });

  it('memoizes — second call returns the same array reference', async () => {
    const a = await loadFonts();
    const b = await loadFonts();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run — fail (module not found)**

```bash
npx nx run marketing-assets:test
```

- [ ] **Step 3: Implement fonts.ts**

```ts
// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

let cached: SatoriFont[] | null = null;

export async function loadFonts(): Promise<SatoriFont[]> {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const fontsDir = join(here, '..', 'fonts');
  const [garamond, interReg, interSemi] = await Promise.all([
    readFile(join(fontsDir, 'EBGaramond-Bold.ttf')),
    readFile(join(fontsDir, 'Inter-Regular.ttf')),
    readFile(join(fontsDir, 'Inter-SemiBold.ttf')),
  ]);
  cached = [
    { name: 'EB Garamond', data: garamond, weight: 700, style: 'normal' },
    { name: 'Inter', data: interReg, weight: 400, style: 'normal' },
    { name: 'Inter', data: interSemi, weight: 600, style: 'normal' },
  ];
  return cached;
}
```

- [ ] **Step 4: Run — pass**

```bash
npx nx run marketing-assets:test
```
Expected: 2 tests pass. (Tests run against `src/`, so `../fonts` resolves to `marketing/assets/fonts/` — the committed source TTFs. Works pre-build.)

- [ ] **Step 5: Commit**

```bash
git add marketing/assets/src/fonts.ts marketing/assets/src/fonts.spec.ts
git commit -m "feat(marketing/assets): memoized font loader"
```

---

## Task 5: `logo.ts` + tests (TDD)

**Files:**
- Create: `marketing/assets/src/logo.ts`
- Create: `marketing/assets/src/logo.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/assets/src/logo.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadPlaneDataUri } from './logo';

describe('loadPlaneDataUri', () => {
  it('returns a base64 png data URI', async () => {
    const uri = await loadPlaneDataUri();
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const b64 = uri.slice('data:image/png;base64,'.length);
    const bytes = Buffer.from(b64, 'base64');
    // PNG magic number
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('memoizes — second call returns the same string reference', async () => {
    const a = await loadPlaneDataUri();
    const b = await loadPlaneDataUri();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
npx nx run marketing-assets:test
```

- [ ] **Step 3: Implement logo.ts**

```ts
// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let cached: string | null = null;

export async function loadPlaneDataUri(): Promise<string> {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const png = await readFile(join(here, '..', 'brand', 'plane.png'));
  cached = `data:image/png;base64,${png.toString('base64')}`;
  return cached;
}
```

- [ ] **Step 4: Run — pass**

```bash
npx nx run marketing-assets:test
```
Expected: 4 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add marketing/assets/src/logo.ts marketing/assets/src/logo.spec.ts
git commit -m "feat(marketing/assets): memoized plane logo data-URI loader"
```

---

## Task 6: `templates/card-shell.tsx`

**Files:**
- Create: `marketing/assets/src/templates/card-shell.tsx`

- [ ] **Step 1: Implement CardShell + PillBadge**

```tsx
// SPDX-License-Identifier: MIT
import { brand } from '../brand';
import type { CardInput } from '../types';

interface CardShellProps {
  input: CardInput;
  planeDataUri: string;
  headlineSize: number;
  padding: string;
}

interface PillProps {
  tone: 'accent' | 'neutral' | 'angular';
  children: string;
}

function PillBadge({ tone, children }: PillProps) {
  const styles = {
    accent: { bg: 'rgba(0, 64, 144, 0.08)', border: 'rgba(0, 64, 144, 0.18)', color: brand.accent },
    neutral: { bg: '#ffffff', border: '#e6e8ee', color: brand.inkSoft },
    angular: { bg: 'rgba(221, 0, 49, 0.06)', border: 'rgba(221, 0, 49, 0.18)', color: brand.angular },
  }[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 999,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontFamily: brand.sans,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

export function CardShell({ input, planeDataUri, headlineSize, padding }: CardShellProps) {
  const eyebrow = input.eyebrow ?? brand.defaultEyebrow;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: brand.gradient,
        display: 'flex',
        flexDirection: 'column',
        padding,
        color: brand.ink,
        fontFamily: brand.sans,
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontFamily: brand.sans,
          fontSize: 18,
          letterSpacing: '0.12em',
          color: brand.accent,
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: 28,
        }}
      >
        {eyebrow}
      </div>

      {/* Headline */}
      <div
        style={{
          fontFamily: brand.serif,
          fontSize: headlineSize,
          lineHeight: 1.05,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: brand.ink,
          marginBottom: 24,
          maxWidth: 980,
        }}
      >
        {input.title}
      </div>

      {/* Subtitle */}
      {input.subtitle ? (
        <div
          style={{
            fontSize: 26,
            lineHeight: 1.45,
            color: brand.inkSoft,
            maxWidth: 920,
            marginBottom: 'auto',
          }}
        >
          {input.subtitle}
        </div>
      ) : (
        <div style={{ marginBottom: 'auto' }} />
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 36,
        }}
      >
        {input.author ? (
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 22 }}>
            <span style={{ fontWeight: 600, color: brand.ink }}>{input.author.name}</span>
            {input.author.role ? (
              <span style={{ color: brand.inkSoft }}>{` · ${input.author.role}`}</span>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <PillBadge tone="accent">MIT</PillBadge>
            <PillBadge tone="neutral">LangGraph + AG-UI</PillBadge>
            <PillBadge tone="angular">Angular 20+</PillBadge>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: brand.serif,
            fontSize: 22,
            fontWeight: 700,
            color: brand.ink,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={planeDataUri} width={28} height={28} alt="" />
          <span>{brand.wordmark}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p marketing/assets/tsconfig.lib.json
```
Expected: clean. (If `react/jsx-runtime` types error, confirm `@types/react` resolves — it's a root devDep.)

- [ ] **Step 3: Commit**

```bash
git add marketing/assets/src/templates/card-shell.tsx
git commit -m "feat(marketing/assets): CardShell layout + pill badges"
```

---

## Task 7: `x-card.tsx` + `og-card.tsx` + `registry.ts`

**Files:**
- Create: `marketing/assets/src/templates/x-card.tsx`
- Create: `marketing/assets/src/templates/og-card.tsx`
- Create: `marketing/assets/src/templates/registry.ts`

- [ ] **Step 1: Create x-card.tsx**

```tsx
// SPDX-License-Identifier: MIT
import { CardShell } from './card-shell';
import type { CardInput } from '../types';

export function XCard(input: CardInput, assets: { planeDataUri: string }) {
  return (
    <CardShell
      input={input}
      planeDataUri={assets.planeDataUri}
      headlineSize={76}
      padding="76px 84px"
    />
  );
}
```

- [ ] **Step 2: Create og-card.tsx**

```tsx
// SPDX-License-Identifier: MIT
import { CardShell } from './card-shell';
import type { CardInput } from '../types';

export function OgCard(input: CardInput, assets: { planeDataUri: string }) {
  return (
    <CardShell
      input={input}
      planeDataUri={assets.planeDataUri}
      headlineSize={72}
      padding="72px 80px"
    />
  );
}
```

- [ ] **Step 3: Create registry.ts**

```ts
// SPDX-License-Identifier: MIT
import type { ReactElement } from 'react';
import type { CardInput, TemplateId } from '../types';
import { XCard } from './x-card';
import { OgCard } from './og-card';

interface TemplateEntry {
  component: (input: CardInput, assets: { planeDataUri: string }) => ReactElement;
  width: number;
  height: number;
}

export const TEMPLATES: Record<TemplateId, TemplateEntry> = {
  'x-card': { component: XCard, width: 1200, height: 675 },
  'og-card': { component: OgCard, width: 1200, height: 630 },
};
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p marketing/assets/tsconfig.lib.json
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add marketing/assets/src/templates/x-card.tsx marketing/assets/src/templates/og-card.tsx marketing/assets/src/templates/registry.ts
git commit -m "feat(marketing/assets): x-card + og-card templates + registry"
```

---

## Task 8: `render.ts` + tests (TDD)

**Files:**
- Create: `marketing/assets/src/render.ts`
- Create: `marketing/assets/src/render.spec.ts`

- [ ] **Step 1: Write failing tests**

`marketing/assets/src/render.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderCard } from './render';

function readPngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG IHDR: width = bytes 16-19 big-endian, height = 20-23.
  expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('renderCard', () => {
  it('renders an x-card at 1200x675', async () => {
    const card = await renderCard({ template: 'x-card', title: 'Hello world' });
    expect(card.contentType).toBe('image/png');
    expect(card.png.byteLength).toBeGreaterThan(1000);
    expect(readPngDimensions(card.png)).toEqual({ width: 1200, height: 675 });
    expect(card.width).toBe(1200);
    expect(card.height).toBe(675);
  });

  it('renders an og-card at 1200x630', async () => {
    const card = await renderCard({ template: 'og-card', title: 'Hello world' });
    expect(readPngDimensions(card.png)).toEqual({ width: 1200, height: 630 });
  });

  it('renders with a subtitle', async () => {
    const card = await renderCard({
      template: 'x-card',
      title: 'Streaming chat in Angular',
      subtitle: 'A signal-native tutorial with LangGraph.',
    });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('renders with an author (replaces trust pills)', async () => {
    const card = await renderCard({
      template: 'og-card',
      title: 'Build agent UI',
      author: { name: 'Brian Love', role: 'Founder' },
    });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('renders title-only (default eyebrow + trust pills path)', async () => {
    const card = await renderCard({ template: 'og-card', title: 'Just a title' });
    expect(card.png.byteLength).toBeGreaterThan(1000);
  });

  it('throws on unknown template id', async () => {
    await expect(
      // @ts-expect-error testing runtime guard with an invalid id
      renderCard({ template: 'nope', title: 'x' }),
    ).rejects.toThrow(/Unknown template "nope"/);
  });
});
```

- [ ] **Step 2: Run — fail (module not found)**

```bash
npx nx run marketing-assets:test
```

- [ ] **Step 3: Implement render.ts**

```ts
// SPDX-License-Identifier: MIT
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts';
import { loadPlaneDataUri } from './logo';
import { TEMPLATES } from './templates/registry';
import type { CardInput, RenderedCard } from './types';

export async function renderCard(input: CardInput): Promise<RenderedCard> {
  const entry = TEMPLATES[input.template];
  if (!entry) {
    throw new Error(
      `Unknown template "${input.template}". Known: ${Object.keys(TEMPLATES).join(', ')}.`,
    );
  }
  const [fonts, planeDataUri] = await Promise.all([loadFonts(), loadPlaneDataUri()]);
  const svg = await satori(entry.component(input, { planeDataUri }), {
    width: entry.width,
    height: entry.height,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: entry.width } });
  const png = resvg.render().asPng();
  return {
    png: Buffer.from(png),
    width: entry.width,
    height: entry.height,
    contentType: 'image/png',
  };
}
```

- [ ] **Step 4: Run — pass**

```bash
npx nx run marketing-assets:test
```
Expected: all render tests pass (+ fonts + logo = 12 tests total). If satori throws on an unsupported style property, note which property and simplify the CardShell style (satori flexbox subset) — but the styles here mirror the website card which already renders under the same engine.

- [ ] **Step 5: Commit**

```bash
git add marketing/assets/src/render.ts marketing/assets/src/render.spec.ts
git commit -m "feat(marketing/assets): renderCard() satori + resvg pipeline"
```

---

## Task 9: Rewrite `index.ts`

**Files:**
- Modify: `marketing/assets/src/index.ts`

- [ ] **Step 1: Replace skeleton with real exports**

```ts
// SPDX-License-Identifier: MIT
//
// @threadplane/marketing-assets — branded social-card rendering.
// See docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md
export { renderCard } from './render';
export type { CardInput, RenderedCard, TemplateId } from './types';
```

- [ ] **Step 2: Build (validates fonts + brand copied into dist)**

```bash
npx nx run marketing-assets:build
ls dist/marketing/assets/fonts/ dist/marketing/assets/brand/
```
Expected: build green; `dist/marketing/assets/fonts/` has 3 TTFs, `dist/marketing/assets/brand/` has `plane.png`.

- [ ] **Step 3: Smoke the built artifact resolves assets**

```bash
node -e "import('./dist/marketing/assets/src/index.js').then(async m => { const c = await m.renderCard({ template: 'og-card', title: 'Built OK' }); console.log('png bytes:', c.png.byteLength, c.width + 'x' + c.height); })"
```
Expected: prints a positive byte count and `1200x630`. (Confirms `../fonts` + `../brand` resolve correctly from the compiled `dist/marketing/assets/src/` location.)

- [ ] **Step 4: Commit**

```bash
git add marketing/assets/src/index.ts
git commit -m "feat(marketing/assets): public API surface"
```

---

## Task 10: Preview script + docs

**Files:**
- Create: `marketing/assets/scripts/preview.ts`
- Create: `marketing/assets/preview/.gitkeep`
- Create: `marketing/assets/preview/.gitignore`
- Create: `marketing/assets/README.md`

- [ ] **Step 1: Create preview.ts**

```ts
// Renders sample cards to marketing/assets/preview/ for manual eyeballing.
// Run: npx tsx marketing/assets/scripts/preview.ts
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderCard, type CardInput } from '../src';

const samples: { name: string; input: CardInput }[] = [
  {
    name: 'x-card-basic',
    input: { template: 'x-card', title: 'Build a streaming chat UI in Angular with LangGraph' },
  },
  {
    name: 'x-card-subtitle',
    input: {
      template: 'x-card',
      title: 'Build a streaming chat UI in Angular',
      subtitle: 'Signal-native streaming, wired to a LangGraph backend.',
    },
  },
  {
    name: 'og-card-basic',
    input: { template: 'og-card', title: 'Agent UI for Angular' },
  },
  {
    name: 'og-card-author',
    input: {
      template: 'og-card',
      title: 'Notes from Cacheplane',
      subtitle: 'Production patterns for agent UI.',
      author: { name: 'Brian Love', role: 'Founder, Cacheplane' },
    },
  },
];

async function main(): Promise<void> {
  const outDir = join(process.cwd(), 'marketing', 'assets', 'preview');
  await mkdir(outDir, { recursive: true });
  for (const s of samples) {
    const card = await renderCard(s.input);
    const file = join(outDir, `${s.name}.png`);
    await writeFile(file, card.png);
    console.log(`wrote ${file} (${card.width}x${card.height}, ${card.png.byteLength} bytes)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Create preview dir guards**

```bash
mkdir -p marketing/assets/preview
touch marketing/assets/preview/.gitkeep
```

`marketing/assets/preview/.gitignore`:
```
*.png
!.gitkeep
```

- [ ] **Step 3: Create README.md**

```markdown
# @threadplane/marketing-assets

Branded social-card rendering for the marketing pipeline. `renderCard()` turns typed input into a PNG via satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG). No Next.js dependency — runs anywhere Node does.

## Usage

```ts
import { renderCard } from '@threadplane/marketing-assets';

const card = await renderCard({
  template: 'x-card',
  title: 'Build a streaming chat UI in Angular with LangGraph',
  subtitle: 'Signal-native streaming, wired to a LangGraph backend.',
});
// card.png is a Buffer; card.width / card.height / card.contentType describe it.
```

The X channel adapter embeds `card.png` directly in `Draft.media`.

## Templates

| id | size | use |
|----|------|-----|
| `x-card` | 1200×675 | X in-stream image (16:9) |
| `og-card` | 1200×630 | standard OpenGraph / Dev.to cover |

Both share `CardShell`: eyebrow, Garamond headline, optional subtitle, footer with trust pills (or author byline) + the plane logo wordmark.

## Input

- `title` (required) — headline
- `subtitle` — supporting line
- `eyebrow` — kicker; defaults to "Agent UI for Angular · MIT"
- `author` — `{ name, role? }`; when set, replaces the trust pills

## Assets

- Fonts: bundled static TTFs in `fonts/` (Garamond 700, Inter 400/600). No runtime fetch.
- Logo: `brand/plane.png`, rendered as an `<img>` data-URI (satori can't render the emoji glyph).
- Both dirs are copied into `dist/` by the Nx build assets array.

## Adding a template

1. Add a TSX wrapper in `src/templates/` calling `CardShell` with size params.
2. Register it in `src/templates/registry.ts` with width/height.
3. Add its id to `TemplateId` in `src/types.ts`.
4. Add a sample to `scripts/preview.ts`.

## Preview

```bash
npx tsx marketing/assets/scripts/preview.ts
```

Writes sample PNGs to `marketing/assets/preview/` (gitignored). Open them to eyeball layout/fonts/logo.

## See also

- Spec: `docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md`
- Meta: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
```

- [ ] **Step 4: Run the preview to confirm it works**

```bash
npx tsx marketing/assets/scripts/preview.ts
ls -la marketing/assets/preview/
```
Expected: 4 PNGs written, each > 1000 bytes, dimensions as configured.

- [ ] **Step 5: Commit**

```bash
git add marketing/assets/scripts/preview.ts marketing/assets/preview/.gitkeep marketing/assets/preview/.gitignore marketing/assets/README.md
git commit -m "docs(marketing/assets): preview script + README"
```

---

## Task 11: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
npx nx run marketing-assets:build
```
Expected: green; `dist/marketing/assets/fonts/` (3 TTFs) + `dist/marketing/assets/brand/plane.png` present.

- [ ] **Step 2: Tests**

```bash
npx nx run marketing-assets:test
```
Expected: green, 12 tests (2 fonts + 2 logo + 6 render... = 10; plus any extras). At minimum all listed tests pass.

- [ ] **Step 3: Preview eyeball**

```bash
npx tsx marketing/assets/scripts/preview.ts
```
Open `marketing/assets/preview/*.png`. Confirm: gradient background, Garamond headline, eyebrow, footer with plane logo + `cacheplane.ai`, trust pills (basic) vs author byline (author sample). **This is the human visual gate — the plane logo must render cleanly at 28×28.**

- [ ] **Step 4: Confirm nothing else broke**

```bash
npx nx run website:build
```
Expected: green (this package is independent, but verify the workspace install didn't disturb anything).

- [ ] **Step 5: No commit** — verification only.

---

## Task 12: Push + PR

**Files:** none

- [ ] **Step 1: Push**

```bash
git push -u origin marketing-brand-assets
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(marketing/assets): renderCard() + branded card templates" --body "$(cat <<'EOF'
## Summary

Sub-spec 1 of the marketing umbrella. Replaces the @threadplane/marketing-assets skeleton with real card rendering.

- `renderCard(input)` → PNG via **satori** (JSX→SVG) + **@resvg/resvg-js** (SVG→PNG). No Next.js dependency.
- Two templates sharing one `CardShell`: `x-card` (1200×675), `og-card` (1200×630).
- Brand tokens lifted from the website OG card; bundled static fonts (Garamond + Inter), no runtime fetch.
- Plane logo (`brand/plane.png`) rendered as an `<img>` data-URI (satori can't render the 🛩️ glyph).
- Fonts + logo copied into `dist/` via the Nx build assets array.
- `scripts/preview.ts` writes sample PNGs for eyeballing.

Immediate consumer: the X channel adapter (embeds `card.png` in `Draft.media`). Website OG-route migration deferred per the spec.

Spec: \`docs/superpowers/specs/marketing/2026-05-17-brand-assets-design.md\`
Plan: \`docs/superpowers/plans/marketing/2026-05-17-brand-assets.md\`

## Test plan
- [x] \`npx nx run marketing-assets:build\` green; fonts + plane.png in dist
- [x] \`npx nx run marketing-assets:test\` green (12 tests)
- [x] \`npx tsx marketing/assets/scripts/preview.ts\` → 4 sample PNGs render
- [ ] Brian eyeballs preview/*.png (logo + fonts + layout)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Pause for visual review**

The controller pauses here and asks Brian to eyeball `marketing/assets/preview/*.png` — the plane logo + fonts are the visual gate. After Brian confirms, enable auto-merge.

- [ ] **Step 4: Enable auto-merge (after Brian confirms visuals)**

```bash
gh pr merge --auto --squash
```

---

## Self-review

**Spec coverage** (against §12 deliverables):
- ✅ package.json deps + assets array — Task 1
- ✅ project.json test target — Task 1
- ✅ vite.config.mts — Task 1
- ✅ bundled fonts — Task 2
- ✅ brand/plane.png — already committed (Task 1 assets array wires it; build verified Task 9/11)
- ✅ types.ts — Task 3
- ✅ brand.ts — Task 3
- ✅ fonts.ts + spec — Task 4
- ✅ logo.ts + spec — Task 5
- ✅ render.ts + spec — Task 8
- ✅ templates (card-shell, x-card, og-card, registry) — Tasks 6, 7
- ✅ index.ts rewrite — Task 9
- ✅ preview.ts + preview guards — Task 10
- ✅ README.md — Task 10
- ✅ build green + fonts in dist — Tasks 9, 11
- ✅ test green — Task 11
- ✅ manual preview — Tasks 10, 11

**Placeholder scan:** No TBDs. All code blocks complete. The Inter-font download has an explicit fallback + stop-and-ask if the static release is unavailable (not a silent placeholder).

**Type consistency:**
- `CardInput`/`RenderedCard`/`TemplateId` defined Task 3, consumed in Tasks 6, 7, 8, 10.
- `SatoriFont` (fonts.ts) maps cleanly into satori's expected font shape in render.ts Task 8.
- Component signature `(input: CardInput, assets: { planeDataUri: string }) => ReactElement` consistent between registry (Task 7), x-card/og-card (Task 7), and the `entry.component(input, { planeDataUri })` call (Task 8).
- `loadFonts()` / `loadPlaneDataUri()` signatures consistent between definition (Tasks 4, 5) and render.ts consumer (Task 8).
- Package name `@threadplane/marketing-assets` used consistently (Task 1, 9, README).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/marketing/2026-05-17-brand-assets.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Execute tasks in this session with batch checkpoints.

Which approach?
