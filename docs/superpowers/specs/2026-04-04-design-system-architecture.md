# Design System Architecture — Shared Libraries + Cockpit Light Theme Migration

## Problem

The website was redesigned with a light glassmorphism theme (warm→cool gradients, frosted glass panels, EB Garamond/Inter/JetBrains Mono typography). The cockpit still uses a dark navy theme with shadcn components. Design tokens are duplicated and divergent. There's no shared component layer between the website, cockpit, or Angular examples. The Angular streaming example uses inline styles instead of a reusable chat component.

## Goal

Create a shared design system architecture with four Nx libraries:
1. **design-tokens** — Framework-agnostic design constants
2. **ui-react** — React component library for website + cockpit
3. **ui-angular** — Angular component library for examples
4. **chat** — Published Angular chat UI library for all cockpit examples

Migrate the cockpit from dark theme to the website's light glassmorphism theme using shared tokens and components.

## Library Architecture

```
libs/
├── design-tokens/              # Pure TS — zero framework deps
│   ├── src/
│   │   ├── index.ts            # Barrel export
│   │   ├── colors.ts           # Color palette
│   │   ├── glass.ts            # Glassmorphism tokens
│   │   ├── gradients.ts        # Gradient definitions
│   │   ├── glow.ts             # Glow/shadow tokens
│   │   └── typography.ts       # Font families, sizes
│   ├── package.json            # @cacheplane/design-tokens
│   └── project.json
│
├── ui-react/                   # React components
│   ├── src/
│   │   ├── index.ts
│   │   ├── glass-panel.tsx     # Frosted glass container
│   │   ├── glass-button.tsx    # Button with glow hover
│   │   ├── glass-card.tsx      # Card with glass treatment
│   │   ├── code-block.tsx      # Shiki code with glass frame
│   │   ├── callout.tsx         # Tip/Note/Warning boxes
│   │   ├── steps.tsx           # Numbered step indicators
│   │   └── nav-link.tsx        # Navigation link with active state
│   ├── package.json            # @cacheplane/ui-react
│   └── project.json
│
├── ui-angular/                 # Angular directives + components
│   ├── src/
│   │   ├── index.ts
│   │   ├── glass-panel.directive.ts
│   │   ├── glass-button.component.ts
│   │   └── tokens.service.ts   # Injectable design tokens
│   ├── package.json            # @cacheplane/ui-angular
│   └── project.json
│
└── chat/               # Published chat UI component
    ├── src/
    │   ├── index.ts
    │   ├── chat.component.ts       # Headful chat with input + messages
    │   ├── chat-message.component.ts
    │   ├── chat-input.component.ts
    │   └── chat.types.ts
    ├── package.json            # @cacheplane/chat
    └── project.json
```

## Library Dependency Graph

```
design-tokens (zero deps)
    ↑
    ├── ui-react (React, design-tokens)
    │       ↑
    │       ├── apps/website
    │       └── apps/cockpit
    │
    ├── ui-angular (Angular, design-tokens)
    │       ↑
    │       └── chat (Angular, ui-angular, design-tokens)
    │               ↑
    │               └── cockpit/*/angular/ (example apps)
    │
    └── (direct import by any app for raw token values)
```

## Library Details

### 1. `libs/design-tokens` — `@cacheplane/design-tokens`

Pure TypeScript constants. No React, no Angular, no CSS framework. Importable by any project.

```typescript
// colors.ts
export const colors = {
  bg: '#f8f9fc',
  accent: '#004090',
  accentLight: '#64C3FD',
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  accentSurface: 'rgba(0, 64, 144, 0.06)',
  textPrimary: '#1a1a2e',
  textSecondary: '#555770',
  textMuted: '#8b8fa3',
  angularRed: '#DD0031',
} as const;

// glass.ts
export const glass = {
  bg: 'rgba(255, 255, 255, 0.45)',
  bgHover: 'rgba(255, 255, 255, 0.55)',
  blur: '16px',
  border: 'rgba(255, 255, 255, 0.6)',
  shadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
} as const;

// gradients.ts
export const gradients = {
  warm: 'radial-gradient(circle, rgba(221,0,49,0.18), transparent 70%)',
  cool: 'radial-gradient(circle, rgba(0,64,144,0.18), transparent 70%)',
  coolLight: 'radial-gradient(circle, rgba(100,195,253,0.15), transparent 70%)',
  bgFlow: 'linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)',
} as const;

// glow.ts
export const glow = {
  hero: '0 0 60px rgba(0, 64, 144, 0.15)',
  demo: '0 0 30px rgba(0, 64, 144, 0.1)',
  card: '0 0 24px rgba(0, 64, 144, 0.1)',
  border: '0 0 12px rgba(0, 64, 144, 0.08)',
  button: '0 0 16px rgba(0, 64, 144, 0.15)',
} as const;

// typography.ts
export const typography = {
  fontSerif: '"EB Garamond", Georgia, serif',
  fontSans: 'Inter, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", monospace',
} as const;
```

### 2. `libs/ui-react` — `@cacheplane/ui-react`

React components that implement the glass design system. Used by both the website and cockpit.

**Key components:**

- `GlassPanel` — Container with frosted glass background, blur, border, shadow. Props: `hover` (enable hover state), `className`.
- `GlassButton` — Button with accent background, white text, glow on hover. Variants: `primary`, `outline`, `ghost`.
- `GlassCard` — Card with glass treatment and optional hover glow. Props: `href` (makes it a link).
- `CodeBlock` — Shiki-highlighted code in a glass-framed container with filename header and copy button.
- `Callout` — Tip/Note/Warning box with colored border and tinted background.
- `Steps` / `Step` — Numbered step indicators with vertical connector.
- `NavLink` — Navigation link with active state (accent color + surface background).

All components use inline styles referencing `@cacheplane/design-tokens` — no Tailwind dependency in the lib itself. Apps can extend with Tailwind classes via `className`.

### 3. `libs/ui-angular` — `@cacheplane/ui-angular`

Angular equivalents of the React components, for use in example apps.

- `GlassPanelDirective` — Applies glass styles to any host element
- `GlassButtonComponent` — Standalone button with variants
- `TokensService` — Injectable that provides design token values for Angular templates

### 4. `libs/chat` — `@cacheplane/chat`

A published, headful Angular chat component library. Used by all cockpit Angular example apps.

```typescript
// Usage in an example app:
import { ChatComponent } from '@cacheplane/chat';

@Component({
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="stream.submit({ messages: [{ role: 'human', content: $event }] })"
    />
  `,
})
export class StreamingComponent { ... }
```

The component renders:
- Message list with user/AI message styling (glass treatment)
- Input bar with send button
- Loading state (streaming indicator)
- Error display

This means the streaming example's 150-line inline component reduces to ~20 lines.

## Cockpit Migration Plan

After the libraries are built, the cockpit migration happens in phases:

### Phase 1: CSS Foundation
- Replace `cockpit.css` dark tokens with light tokens from `@cacheplane/design-tokens`
- Update `@theme` block with website palette
- Remove `color-scheme: dark`
- Add gradient background and glass variables

### Phase 2: Shell + Navigation
- Replace sidebar glass treatment (dark → light)
- Update header with serif typography
- Update mode switcher styling
- Replace shadcn Button/Tabs with `@cacheplane/ui-react` components

### Phase 3: Content Surfaces
- RunMode: Glass-framed iframe with glow shadow
- CodeMode: Glass tab bar, dark code blocks (tokyo-night on light bg)
- DocsMode: Callout/Steps/CodeBlock from ui-react, light prose styling
- ApiMode: Glass cards for API reference

### Phase 4: Cleanup
- Remove shadcn dependencies (@radix-ui/react-dialog, @radix-ui/react-slot, class-variance-authority)
- Remove `apps/cockpit/src/components/ui/` directory
- Update all Tailwind classes for light theme

## Website Migration

The website also migrates to use the shared libraries:
- Replace inline `tokens` object imports with `@cacheplane/design-tokens`
- Replace custom glass panel divs with `GlassPanel` from `@cacheplane/ui-react`
- Replace inline button styles with `GlassButton`

## Angular Example Migration

The streaming example migrates to use the shared libraries:
- Replace inline chat UI with `<cp-chat>` from `@cacheplane/chat`
- Replace inline styles with `GlassPanelDirective` from `@cacheplane/ui-angular`
- Future examples start with these libs instead of building from scratch

## Implementation Order

1. **`libs/design-tokens`** — Foundation, no deps, quick to build
2. **`libs/ui-react`** — React components using tokens
3. **Cockpit migration** — Phases 1-4 using tokens + ui-react
4. **Website migration** — Replace inline tokens with shared lib
5. **`libs/ui-angular`** — Angular components using tokens
6. **`libs/chat`** — Chat component using ui-angular
7. **Example app migration** — Replace inline chat with chat

Steps 1-3 are the critical path for the cockpit redesign. Steps 4-7 can follow independently.

## Out of Scope

- Dark theme support (light only for now)
- Animation library (Framer Motion stays website-only)
- Server components in ui-react (all client components)
- Publishing ui-react to npm (internal only)
- Publishing ui-angular to npm (only chat is published)
