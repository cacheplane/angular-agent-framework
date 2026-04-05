# Cockpit shadcn/ui Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the cockpit app from hand-written CSS to Tailwind v4 + shadcn/ui component primitives, matching the website's established patterns.

**Architecture:** Add Tailwind v4 and shadcn/ui infrastructure to the cockpit app (postcss config, `cn()` utility, CSS variables, `@/` path alias). Create cockpit-specific shadcn UI primitives (Button, Tabs, Sheet). Refactor each cockpit component to use Tailwind utilities and shadcn primitives instead of BEM-style CSS classes. Preserve the cockpit's distinct dark color palette while using shadcn's semantic variable naming.

**Tech Stack:** Tailwind CSS v4, shadcn/ui (default style), class-variance-authority, @radix-ui/react-slot, @radix-ui/react-tabs, @radix-ui/react-dialog, clsx, tailwind-merge

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/cockpit/postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| Create | `apps/cockpit/components.json` | shadcn CLI config |
| Create | `apps/cockpit/src/lib/utils.ts` | `cn()` utility (same as website) |
| Create | `apps/cockpit/src/components/ui/button.tsx` | shadcn Button with cockpit variants |
| Create | `apps/cockpit/src/components/ui/tabs.tsx` | shadcn Tabs (Radix) for mode/file switching |
| Create | `apps/cockpit/src/components/ui/sheet.tsx` | shadcn Sheet (Radix Dialog) for prompt drawer |
| Modify | `apps/cockpit/tsconfig.json` | Add `baseUrl` and `@/*` path alias |
| Modify | `apps/cockpit/package.json` | Add shadcn dependencies |
| Modify | `apps/cockpit/src/app/cockpit.css` | Replace BEM styles with Tailwind + shadcn CSS vars |
| Modify | `apps/cockpit/src/app/layout.tsx` | Update body className to use Tailwind |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Use Button, Tailwind layout classes |
| Modify | `apps/cockpit/src/components/modes/mode-switcher.tsx` | Use Tabs primitive |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Use Tabs for file switching |
| Modify | `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx` | Use Sheet + Tabs |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.tsx` | Tailwind utilities |
| Modify | `apps/cockpit/src/components/docs-mode/docs-mode.tsx` | Tailwind utilities |
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Tailwind utilities |
| Modify | `apps/cockpit/src/components/sidebar/language-picker.tsx` | Tailwind utilities |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Tailwind utilities |
| Modify | All `*.spec.tsx` files | Update assertions for changed markup |

---

### Task 1: Tailwind + shadcn infrastructure

**Files:**
- Modify: `apps/cockpit/tsconfig.json`
- Modify: `apps/cockpit/package.json`
- Create: `apps/cockpit/postcss.config.mjs`
- Create: `apps/cockpit/components.json`
- Create: `apps/cockpit/src/lib/utils.ts`

- [ ] **Step 1: Add `@/` path alias to tsconfig.json**

Replace `apps/cockpit/tsconfig.json` with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": false,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Add shadcn dependencies to cockpit package.json**

```json
{
  "name": "cockpit",
  "version": "0.0.1",
  "private": true,
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "next": "~16.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.0"
  }
}
```

- [ ] **Step 3: Create postcss.config.mjs**

```js
// apps/cockpit/postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 4: Create components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/cockpit.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5: Create `src/lib/utils.ts`**

```ts
// apps/cockpit/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Run `npm install` from the monorepo root**

Run: `npm install`
Expected: Installs new dependencies successfully

- [ ] **Step 7: Run existing tests to verify nothing broke**

Run: `npx nx test cockpit -- --run`
Expected: 30 tests pass (infrastructure changes don't affect runtime)

- [ ] **Step 8: Commit**

```bash
git add apps/cockpit/tsconfig.json apps/cockpit/package.json apps/cockpit/postcss.config.mjs apps/cockpit/components.json apps/cockpit/src/lib/utils.ts package-lock.json
git commit -m "chore(cockpit): add Tailwind v4 and shadcn/ui infrastructure"
```

---

### Task 2: Migrate cockpit.css to Tailwind + shadcn CSS variables

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`
- Modify: `apps/cockpit/src/app/layout.tsx`

- [ ] **Step 1: Replace cockpit.css with Tailwind import + shadcn variables + preserved layout styles**

Replace `apps/cockpit/src/app/cockpit.css` entirely with:

```css
@import "tailwindcss";

@theme {
  --color-cockpit-bg: #08111f;
  --color-cockpit-panel: #0f1b2d;
  --color-cockpit-accent: #7dd3fc;
  --color-cockpit-accent-strong: #38bdf8;
  --color-cockpit-shadow: 0 24px 80px rgba(3, 9, 18, 0.45);

  --font-serif: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  --font-mono: 'SFMono-Regular', ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

:root {
  color-scheme: dark;

  /* shadcn semantic vars — cockpit palette */
  --background: #08111f;
  --foreground: #edf3ff;
  --primary: #7dd3fc;
  --primary-foreground: #08111f;
  --card: #0f1b2d;
  --card-foreground: #edf3ff;
  --muted: #14243d;
  --muted-foreground: #96a8c7;
  --border: rgba(138, 170, 214, 0.18);
  --input: rgba(138, 170, 214, 0.18);
  --ring: #7dd3fc;
}

/* Shiki code blocks — preserve background from theme */
pre.shiki {
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.6;
}
```

- [ ] **Step 2: Update layout.tsx to use Tailwind classes on body**

```tsx
// apps/cockpit/src/app/layout.tsx
import type { ReactNode } from 'react';
import './cockpit.css';

export const metadata = {
  title: 'Cockpit',
  description: 'Integrated cockpit for manifest-driven developer reference demos.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run`
Expected: Tests may fail due to CSS class changes — note failures but don't fix yet (component refactors in later tasks will address them)

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css apps/cockpit/src/app/layout.tsx
git commit -m "feat(cockpit): migrate CSS to Tailwind v4 with shadcn design tokens"
```

---

### Task 3: Create shadcn Button component

**Files:**
- Create: `apps/cockpit/src/components/ui/button.tsx`

- [ ] **Step 1: Create Button component matching website pattern**

```tsx
// apps/cockpit/src/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-mono text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-border bg-card text-foreground hover:border-primary/35 hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.28),rgba(56,189,248,0.14))]',
        accent:
          'bg-[linear-gradient(180deg,rgba(56,189,248,0.28),rgba(56,189,248,0.14))] border border-primary/35 text-foreground',
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      },
      size: {
        default: 'px-4 py-3',
        sm: 'px-3 py-1.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/ui/button.tsx
git commit -m "feat(cockpit): add shadcn Button component"
```

---

### Task 4: Create shadcn Tabs component

**Files:**
- Create: `apps/cockpit/src/components/ui/tabs.tsx`

- [ ] **Step 1: Create Tabs component using Radix Tabs primitive**

```tsx
// apps/cockpit/src/components/ui/tabs.tsx
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-3 flex-wrap',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-3 font-mono text-sm text-foreground transition-all',
      'hover:border-primary/35',
      'data-[state=active]:bg-[linear-gradient(180deg,rgba(56,189,248,0.28),rgba(56,189,248,0.14))] data-[state=active]:border-primary/35',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/ui/tabs.tsx
git commit -m "feat(cockpit): add shadcn Tabs component"
```

---

### Task 5: Create shadcn Sheet component

**Files:**
- Create: `apps/cockpit/src/components/ui/sheet.tsx`

- [ ] **Step 1: Create Sheet component using Radix Dialog primitive**

```tsx
// apps/cockpit/src/components/ui/sheet.tsx
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-10 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed top-4 right-4 bottom-4 z-20 w-[min(28rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-border bg-card/88 p-5 backdrop-blur-[14px] shadow-[0_24px_80px_rgba(3,9,18,0.45)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        'focus-visible:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-2', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-serif font-semibold tracking-tight text-foreground', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/ui/sheet.tsx
git commit -m "feat(cockpit): add shadcn Sheet component"
```

---

### Task 6: Refactor CockpitShell to use Tailwind + Button

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Update CockpitShell to use Tailwind classes, Button component, and Sheet for prompt drawer**

Replace all BEM CSS classes with Tailwind utilities. Use `Button` for action buttons. Use `Sheet` for the prompt drawer wrapper. The shell passes `activeMode` + `onModeChange` to a `Tabs`-based `ModeSwitcher` (refactored in Task 7).

Key changes:
- `className="cockpit-shell"` → `className="grid grid-cols-[18rem_minmax(0,1fr)] min-h-screen"`
- `className="cockpit-shell__workspace"` → `className="grid gap-6 p-7 bg-card/88 backdrop-blur-[14px]"`
- `className="cockpit-shell__header"` → `className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"`
- `className="cockpit-shell__actions"` → `className="flex items-center gap-3"`
- `className="cockpit-eyebrow"` → `className="text-muted-foreground font-mono text-[0.8rem]"`
- Action buttons use `<Button>` and `<Button variant="accent">`
- Prompt drawer wraps in `<Sheet open={isPromptDrawerOpen} onOpenChange={setIsPromptDrawerOpen}>`
- Heading uses `className="font-serif font-semibold tracking-tight"`

Full implementation should preserve the existing component interface (`CockpitShellProps` with `contentBundle`) and only change the JSX markup and className values.

- [ ] **Step 2: Run tests to identify failures**

Run: `npx nx test cockpit -- --run`
Note which tests fail — they'll need updated selectors/assertions.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "refactor(cockpit): migrate CockpitShell to Tailwind + shadcn Button"
```

---

### Task 7: Refactor ModeSwitcher to use Tabs

**Files:**
- Modify: `apps/cockpit/src/components/modes/mode-switcher.tsx`
- Modify: `apps/cockpit/src/components/modes/mode-switcher.spec.tsx`

- [ ] **Step 1: Replace ModeSwitcher with Radix Tabs**

```tsx
// apps/cockpit/src/components/modes/mode-switcher.tsx
'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ModeSwitcherProps<T extends string> {
  modes: readonly T[];
  activeMode: T;
  onChange: (mode: T) => void;
}

export function ModeSwitcher<T extends string>({
  modes,
  activeMode,
  onChange,
}: ModeSwitcherProps<T>) {
  return (
    <Tabs value={activeMode} onValueChange={(v) => onChange(v as T)}>
      <TabsList className={cn(
        'inline-flex gap-3 w-fit p-2 rounded-full border border-border bg-card/72 shadow-[0_24px_80px_rgba(3,9,18,0.45)]'
      )}>
        {modes.map((mode) => (
          <TabsTrigger key={mode} value={mode}>
            {mode}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

- [ ] **Step 2: Update ModeSwitcher spec**

The test needs to query for Radix `[data-state="active"]` instead of `[aria-pressed="true"]`. Radix Tabs uses `role="tab"` and `data-state="active"` / `data-state="inactive"`.

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=mode-switcher`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/modes/
git commit -m "refactor(cockpit): migrate ModeSwitcher to shadcn Tabs"
```

---

### Task 8: Refactor CodeMode to use Tabs + Tailwind

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

- [ ] **Step 1: Replace CodeMode with Tabs for file switching + Tailwind layout**

Replace `role="tablist"` / `role="tab"` / `aria-selected` with `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`. Replace BEM classes with Tailwind utilities:

- `cockpit-code-mode` → `grid gap-4`
- `cockpit-code-mode__header` → `grid gap-2`
- `cockpit-code-mode__tabs` → removed (use `TabsList`)
- `cockpit-code-mode__editor` → `border-t border-border pt-4`
- `cockpit-code-path` → `text-muted-foreground font-mono text-[0.8rem]`

Use `activePath` as the Tabs `value`. Each file path is a `TabsTrigger` with `value={path}`. The `dangerouslySetInnerHTML` content renders in a `TabsContent`.

- [ ] **Step 2: Update CodeMode spec for Radix Tabs**

Radix Tabs uses `role="tab"` with `data-state="active"` instead of `aria-selected="true"`. Update tab query and assertions.

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=code-mode`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/code-mode/
git commit -m "refactor(cockpit): migrate CodeMode to shadcn Tabs + Tailwind"
```

---

### Task 9: Refactor PromptDrawer to use Sheet + Tabs

**Files:**
- Modify: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx`
- Modify: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`

- [ ] **Step 1: Replace PromptDrawer with Sheet + Tabs**

The PromptDrawer becomes a `Sheet` with `SheetContent` for the overlay panel. File tabs become `Tabs` / `TabsList` / `TabsTrigger`. The parent (`CockpitShell`) controls open state via `<Sheet open={isOpen} onOpenChange={onClose}>`.

Key PromptDrawer changes:
- Remove `isOpen` conditional rendering (Sheet handles visibility)
- Wrap content in `<SheetContent>` with `<SheetHeader>`, `<SheetTitle>`, `<SheetDescription>`
- File tabs use `Tabs` / `TabsList` / `TabsTrigger`
- Content area uses `<pre className="font-mono text-sm whitespace-pre-wrap">`
- Close button becomes `<SheetClose>`

Props change: Remove `isOpen` and `onClose` — Sheet manages these via its `open` and `onOpenChange` props passed from the parent.

- [ ] **Step 2: Update prompt-drawer spec for Sheet + Tabs**

The test renders `CockpitShell` and clicks "Open prompt assets". With Sheet, the drawer content is rendered in a portal. Update assertions to query the document body for `[role="dialog"]` content (Radix Dialog renders in a portal).

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=prompt-drawer`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/prompt-drawer/ apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "refactor(cockpit): migrate PromptDrawer to shadcn Sheet + Tabs"
```

---

### Task 10: Refactor RunMode, DocsMode, and Sidebar to Tailwind

**Files:**
- Modify: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Modify: `apps/cockpit/src/components/docs-mode/docs-mode.tsx`
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- Modify: `apps/cockpit/src/components/sidebar/language-picker.tsx`
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`

- [ ] **Step 1: Refactor RunMode**

Replace BEM classes with Tailwind:
- `cockpit-run-mode` → `grid grid-cols-[minmax(0,1.8fr)_minmax(16rem,0.95fr)] items-start gap-4`
- `cockpit-run-mode__surface` → `grid gap-4 p-5 min-h-full border border-border bg-card/72 shadow-[var(--cockpit-shadow)]`
- `cockpit-run-mode__viewport` → `grid place-items-center min-h-[22rem] border border-dashed border-primary/24 bg-gradient-to-b from-muted/50 to-background/30`
- `cockpit-run-mode__context` → `grid gap-4 p-5 min-h-full border border-border bg-card/72 shadow-[var(--cockpit-shadow)]`
- `cockpit-run-mode__iframe` → `w-full h-full min-h-[22rem] border-0`
- `cockpit-eyebrow` → `text-muted-foreground font-mono text-[0.8rem]`
- Headings get `font-serif font-semibold tracking-tight`

- [ ] **Step 2: Refactor DocsMode**

Replace BEM classes with Tailwind:
- `cockpit-eyebrow` → `text-muted-foreground font-mono text-[0.8rem]`
- Section dividers: `border-t border-border pt-4`
- Code blocks: `font-mono text-sm`

- [ ] **Step 3: Refactor CockpitSidebar**

- `cockpit-sidebar` → `grid gap-6 p-7 px-5 border-r border-border bg-card/88 backdrop-blur-[14px]`
- `cockpit-sidebar__header` → `grid gap-2`
- `cockpit-eyebrow` → `text-muted-foreground font-mono text-[0.8rem]`
- Heading: `font-serif font-semibold tracking-tight`

- [ ] **Step 4: Refactor LanguagePicker**

Use `Button` component for the trigger. Replace BEM/ARIA-selector styles with Tailwind:
- Menu trigger: `<Button variant="default" size="sm">`
- Dropdown: `grid gap-2 mt-3 p-3 border border-border bg-card rounded-xl shadow-[var(--cockpit-shadow)]`
- Menu items: `block px-3 py-1.5 rounded text-sm hover:bg-muted/50`
- Active item: `text-primary`

- [ ] **Step 5: Refactor NavigationGroups**

- Nav container: `grid gap-5`
- Section headings: `mb-2 font-semibold text-sm` (h2) / `mb-2 font-medium text-xs text-muted-foreground` (h3)
- List: `grid gap-1.5 list-none m-0 p-0`
- Active link: `text-primary`

- [ ] **Step 6: Run full test suite**

Run: `npx nx test cockpit -- --run`
Expected: Note failures — fix in Task 11

- [ ] **Step 7: Commit**

```bash
git add apps/cockpit/src/components/run-mode/ apps/cockpit/src/components/docs-mode/ apps/cockpit/src/components/sidebar/
git commit -m "refactor(cockpit): migrate RunMode, DocsMode, and Sidebar to Tailwind"
```

---

### Task 11: Fix all broken tests

**Files:**
- Modify: All `*.spec.tsx` files as needed

- [ ] **Step 1: Run full test suite and catalog failures**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Collect all failures.

- [ ] **Step 2: Fix test assertions**

Common fixes needed:
- `aria-pressed` → `data-state="active"` for Tabs-based mode switcher
- `aria-selected` → `data-state="active"` for Tabs-based file selectors
- `querySelector('[aria-label="Prompt drawer"]')` → `querySelector('[role="dialog"]')` for Sheet
- Any `textContent` assertions that relied on BEM class styling producing specific layout (these should still work since text content is unchanged)
- Tests that render `CockpitShell` need to provide the `contentBundle` prop (already done in previous tasks)
- `pane-rendering.spec.tsx` may need updates for changed class names

- [ ] **Step 3: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for shadcn/ui component migration"
```

---

### Task 12: Visual verification and cleanup

**Files:**
- Possibly modify: any component with visual issues

- [ ] **Step 1: Start the dev server**

Run: `npx nx serve cockpit -- --port 4201`

- [ ] **Step 2: Verify all surfaces visually**

Check each mode:
- **Run mode:** Iframe viewport renders, empty state shows when no runtime URL
- **Code mode:** Shiki-highlighted code renders, tab switching works
- **Docs mode:** Sections render with proper typography
- **Prompt drawer:** Opens as Sheet overlay from right, tabs switch, content renders
- **Sidebar:** Navigation tree, language picker dropdown
- **Mode switcher:** Run/Code/Docs toggle with active state highlight

- [ ] **Step 3: Fix any visual regressions**

Adjust Tailwind classes as needed to match the original design.

- [ ] **Step 4: Remove old cockpit.css BEM classes if any remain**

Verify no component still references `.cockpit-*` classes. Remove any orphaned CSS.

- [ ] **Step 5: Run final test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/src
git commit -m "fix(cockpit): visual polish and cleanup after shadcn migration"
```
