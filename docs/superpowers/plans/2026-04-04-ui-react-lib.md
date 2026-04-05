# React UI Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `libs/ui-react` — a shared React component library implementing the glass design system, used by both the website and cockpit.

**Architecture:** Extract the existing MDX components (Callout, Steps, Card, CodeGroup, Tabs) from the website into the shared lib, plus add new primitives (GlassPanel, GlassButton). All components use inline styles with `@cacheplane/design-tokens` — no Tailwind dependency in the lib. The website then imports from `@cacheplane/ui-react` instead of its local `docs/mdx/` directory.

**Tech Stack:** React 19, TypeScript, `@cacheplane/design-tokens`, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `libs/ui-react/project.json` | Nx project config |
| Create | `libs/ui-react/package.json` | Package metadata |
| Create | `libs/ui-react/tsconfig.json` | TS config |
| Create | `libs/ui-react/tsconfig.lib.json` | Build config |
| Create | `libs/ui-react/vite.config.mts` | Test config |
| Create | `libs/ui-react/src/index.ts` | Barrel export |
| Create | `libs/ui-react/src/lib/glass-panel.tsx` | Frosted glass container |
| Create | `libs/ui-react/src/lib/glass-button.tsx` | Button with glow hover |
| Create | `libs/ui-react/src/lib/callout.tsx` | Tip/Note/Warning boxes |
| Create | `libs/ui-react/src/lib/steps.tsx` | Numbered step indicators |
| Create | `libs/ui-react/src/lib/tabs.tsx` | Tab switcher |
| Create | `libs/ui-react/src/lib/card.tsx` | Glass card + CardGroup |
| Create | `libs/ui-react/src/lib/code-group.tsx` | Tabbed code blocks |
| Create | `libs/ui-react/src/lib/nav-link.tsx` | Navigation link with active state |
| Create | `libs/ui-react/src/lib/components.spec.tsx` | Tests |
| Modify | `tsconfig.base.json` | Add `@cacheplane/ui-react` path |

---

### Task 1: Scaffold the Nx library

**Files:**
- Create: `libs/ui-react/project.json`, `package.json`, `tsconfig.json`, `tsconfig.lib.json`, `vite.config.mts`
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Create project.json**

```json
{
  "name": "ui-react",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui-react/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/ui-react"],
      "options": {
        "outputPath": "dist/libs/ui-react",
        "main": "libs/ui-react/src/index.ts",
        "tsConfig": "libs/ui-react/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "configFile": "libs/ui-react/vite.config.mts"
      }
    }
  }
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@cacheplane/ui-react",
  "version": "0.0.1",
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false,
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json and tsconfig.lib.json**

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.lib.json" }
  ]
}
```

`tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
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
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
```

- [ ] **Step 5: Add path alias to tsconfig.base.json**

Add: `"@cacheplane/ui-react": ["libs/ui-react/src/index.ts"]`

- [ ] **Step 6: Create src/lib/ directory**

```bash
mkdir -p libs/ui-react/src/lib
```

- [ ] **Step 7: Commit**

```bash
git add libs/ui-react/ tsconfig.base.json
git commit -m "chore: scaffold ui-react Nx library"
```

---

### Task 2: Implement GlassPanel and GlassButton

**Files:**
- Create: `libs/ui-react/src/lib/glass-panel.tsx`
- Create: `libs/ui-react/src/lib/glass-button.tsx`

- [ ] **Step 1: Create GlassPanel**

```tsx
// libs/ui-react/src/lib/glass-panel.tsx
import React from 'react';
import { glass } from '@cacheplane/design-tokens';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ hover = false, as: Tag = 'div', style, children, ...props }, ref) => (
    <Tag
      ref={ref}
      style={{
        background: hover ? glass.bgHover : glass.bg,
        backdropFilter: `blur(${glass.blur})`,
        WebkitBackdropFilter: `blur(${glass.blur})`,
        border: `1px solid ${glass.border}`,
        boxShadow: glass.shadow,
        borderRadius: 10,
        ...style,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </Tag>
  )
);
GlassPanel.displayName = 'GlassPanel';
```

- [ ] **Step 2: Create GlassButton**

```tsx
// libs/ui-react/src/lib/glass-button.tsx
import React from 'react';
import { colors, glow } from '@cacheplane/design-tokens';

type Variant = 'primary' | 'outline' | 'ghost';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: colors.accent,
    color: '#fff',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: colors.accent,
    border: `1px solid ${colors.accentBorder}`,
  },
  ghost: {
    background: 'transparent',
    color: colors.textSecondary,
    border: 'none',
  },
};

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant = 'primary', style, children, ...props }, ref) => (
    <button
      ref={ref}
      style={{
        padding: '8px 16px',
        borderRadius: 6,
        fontFamily: 'inherit',
        fontSize: '0.85rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, background 0.2s',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
);
GlassButton.displayName = 'GlassButton';
```

- [ ] **Step 3: Commit**

```bash
git add libs/ui-react/src/lib/glass-panel.tsx libs/ui-react/src/lib/glass-button.tsx
git commit -m "feat(ui-react): add GlassPanel and GlassButton components"
```

---

### Task 3: Extract Callout, Steps, Tabs, Card, CodeGroup from website

**Files:**
- Create: `libs/ui-react/src/lib/callout.tsx`
- Create: `libs/ui-react/src/lib/steps.tsx`
- Create: `libs/ui-react/src/lib/tabs.tsx`
- Create: `libs/ui-react/src/lib/card.tsx`
- Create: `libs/ui-react/src/lib/code-group.tsx`
- Create: `libs/ui-react/src/lib/nav-link.tsx`

- [ ] **Step 1: Copy and adapt components from website MDX directory**

Copy each component from `apps/website/src/components/docs/mdx/` to `libs/ui-react/src/lib/`, making these adjustments:
- Remove any Next.js-specific imports (`next/link`) — use `<a>` tags or accept an `as` prop for the link component
- All imports use `@cacheplane/design-tokens`
- Add `displayName` to all components
- Export types for props

For `card.tsx`, the `Card` component currently uses `next/link`. Change it to accept an `href` prop and render `<a>`:

```tsx
// libs/ui-react/src/lib/card.tsx
import React from 'react';
import { tokens } from '@cacheplane/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 12,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export function Card({ title, href, icon, children }: { title: string; href: string; icon?: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
      }}>
        {icon && <div style={{ fontSize: '1.25rem', marginBottom: 6 }}>{icon}</div>}
        <div style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: '1rem',
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </a>
  );
}
```

For `callout.tsx`, `steps.tsx`, `tabs.tsx`, `code-group.tsx` — copy directly from the website versions (they don't use Next.js imports).

For `nav-link.tsx`:

```tsx
// libs/ui-react/src/lib/nav-link.tsx
import React from 'react';
import { colors } from '@cacheplane/design-tokens';

interface NavLinkProps {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function NavLink({ href, active = false, children, style }: NavLinkProps) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: '0.85rem',
        color: active ? colors.accent : colors.textSecondary,
        background: active ? colors.accentSurface : 'transparent',
        textDecoration: 'none',
        transition: 'color 0.15s, background 0.15s',
        ...style,
      }}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/ui-react/src/lib/
git commit -m "feat(ui-react): add Callout, Steps, Tabs, Card, CodeGroup, NavLink components"
```

---

### Task 4: Create barrel export and tests

**Files:**
- Create: `libs/ui-react/src/index.ts`
- Create: `libs/ui-react/src/lib/components.spec.tsx`

- [ ] **Step 1: Create barrel export**

```ts
// libs/ui-react/src/index.ts
export { GlassPanel } from './lib/glass-panel';
export { GlassButton } from './lib/glass-button';
export { Callout } from './lib/callout';
export { Steps, Step } from './lib/steps';
export { Tabs, Tab } from './lib/tabs';
export { Card, CardGroup } from './lib/card';
export { CodeGroup } from './lib/code-group';
export { NavLink } from './lib/nav-link';
```

- [ ] **Step 2: Write tests**

```tsx
// libs/ui-react/src/lib/components.spec.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlassPanel, GlassButton, Callout, Steps, Step, NavLink, Card, CardGroup } from '../index';

describe('GlassPanel', () => {
  it('renders with glass styles', () => {
    const html = renderToStaticMarkup(<GlassPanel>Content</GlassPanel>);
    expect(html).toContain('Content');
    expect(html).toContain('rgba(255');
    expect(html).toContain('blur');
  });
});

describe('GlassButton', () => {
  it('renders primary variant with accent color', () => {
    const html = renderToStaticMarkup(<GlassButton>Click</GlassButton>);
    expect(html).toContain('Click');
    expect(html).toContain('#004090');
  });

  it('renders outline variant', () => {
    const html = renderToStaticMarkup(<GlassButton variant="outline">Click</GlassButton>);
    expect(html).toContain('transparent');
  });
});

describe('Callout', () => {
  it('renders with type styling', () => {
    const html = renderToStaticMarkup(<Callout type="warning" title="Watch out">Be careful</Callout>);
    expect(html).toContain('Watch out');
    expect(html).toContain('Be careful');
    expect(html).toContain('#f59e0b');
  });
});

describe('Steps', () => {
  it('renders numbered steps', () => {
    const html = renderToStaticMarkup(
      <Steps>
        <Step title="First">Do this</Step>
        <Step title="Second">Then this</Step>
      </Steps>
    );
    expect(html).toContain('First');
    expect(html).toContain('Second');
    expect(html).toContain('1');
    expect(html).toContain('2');
  });
});

describe('NavLink', () => {
  it('renders active state with accent color', () => {
    const html = renderToStaticMarkup(<NavLink href="/test" active>Test</NavLink>);
    expect(html).toContain('#004090');
    expect(html).toContain('/test');
  });
});

describe('Card', () => {
  it('renders with glass treatment', () => {
    const html = renderToStaticMarkup(
      <CardGroup>
        <Card title="Test" href="/test">Description</Card>
      </CardGroup>
    );
    expect(html).toContain('Test');
    expect(html).toContain('Description');
    expect(html).toContain('rgba(255');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx nx test ui-react -- --run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add libs/ui-react/src/
git commit -m "feat(ui-react): add barrel export and component tests"
```

---

### Task 5: Build, verify, and push

- [ ] **Step 1: Build the library**

Run: `npx nx build ui-react`
Expected: SUCCESS

- [ ] **Step 2: Push**

```bash
git push
```
