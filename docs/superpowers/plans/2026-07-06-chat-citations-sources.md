# Chat Citations & Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@threadplane/chat` a prod-ready, cohesive, extensible visual + interaction treatment for inline citation markers, an on-demand provenance preview card, and a redesigned collapsible Sources panel.

**Architecture:** Six small units — pure display helpers (`citation-display.ts`), a new presentational `ChatCitationPreviewComponent`, a rewritten inline-marker component that pill-styles + portals the preview via the existing `chatConnectedOverlay` primitive, an updated detail-card and collapsible panel, plus new `--tplane-chat-citation-*` tokens and a `chat-citations.styles.ts` style module. Everything is token-driven (light/dark for free), browser-safe (no third-party favicon fetches), and accessible.

**Tech Stack:** Angular (standalone, signals, OnPush), Vitest + `@angular/core/testing` TestBed, Nx (`npx nx test chat`), the lib's `*.styles.ts` string-constant styling pattern and `chatConnectedOverlay` body-portal primitive.

**Design spec:** [docs/superpowers/specs/2026-07-06-chat-citations-sources-design.md](../specs/2026-07-06-chat-citations-sources-design.md)

---

## File Structure

**Create:**
- `libs/chat/src/lib/agent/citation-display.ts` — pure, DOM-free display helpers over `Citation`.
- `libs/chat/src/lib/agent/citation-display.spec.ts` — helper unit tests.
- `libs/chat/src/lib/styles/chat-citations.styles.ts` — marker + preview + panel CSS string consts.
- `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts` — presentational preview card.
- `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.spec.ts` — preview tests.

**Modify:**
- `libs/chat/src/lib/agent/citation.ts` — add 3 optional fields.
- `libs/chat/src/lib/styles/chat-tokens.ts` — add `--tplane-chat-citation-*` tokens (light/dark) + radius.
- `libs/chat/src/lib/styles/chat-tokens.spec.ts` — assert new tokens present.
- `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts` — pill + overlay preview + states + a11y.
- `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts` — update state assertions.
- `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts` — detail-card layout.
- `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts` — collapsible header + favicon stack.
- `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts` — collapse test.
- `libs/chat/src/public-api.ts` — export `ChatCitationPreviewComponent`.

**Note on test command:** `npx nx test chat` runs the whole lib suite (fast). To narrow while iterating, append `-- -t "<describe or it name>"`.

---

## Task 1: Extend the `Citation` type

**Files:**
- Modify: `libs/chat/src/lib/agent/citation.ts`

- [ ] **Step 1: Add three optional fields to the interface**

Open `libs/chat/src/lib/agent/citation.ts` and replace the interface body's closing so it reads:

```ts
export interface Citation {
  /** Stable id used to match `[^id]` markers in Pandoc-formatted content. */
  id: string;
  /** 1-based display order. Stable per-message. */
  index: number;
  title?: string;
  url?: string;
  snippet?: string;
  /** Provider-specific extras (retrieval score, source type, etc.). */
  extra?: Record<string, unknown>;

  /**
   * Source classification driving the type badge. Free-form and extensible:
   * 'web' (default-inferred from an http(s) url) | 'file' | 'app' | 'memory'
   * | any custom string. Optional — display derives 'web' from the url when absent.
   */
  sourceType?: string;
  /**
   * Provider-supplied favicon/logo (absolute URL or `data:` URI). NEVER
   * auto-fetched by the library — supply this from your own resolver if you
   * want real favicons; otherwise a monogram is rendered.
   */
  iconUrl?: string;
  /** Freshness signal shown in the preview-card footer. */
  publishedAt?: string | number | Date;
}
```

- [ ] **Step 2: Verify the lib still type-checks**

Run: `npx tsc --project libs/chat/tsconfig.type-tests.json --noEmit`
Expected: exits 0 (all new fields are optional → no existing consumer breaks).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/agent/citation.ts
git commit -m "feat(chat): add optional sourceType/iconUrl/publishedAt to Citation"
```

---

## Task 2: Pure display helpers

**Files:**
- Create: `libs/chat/src/lib/agent/citation-display.ts`
- Test: `libs/chat/src/lib/agent/citation-display.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/agent/citation-display.spec.ts`:

```ts
// libs/chat/src/lib/agent/citation-display.spec.ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  deriveDomain, deriveSourceType, deriveMonogram, monogramHue, formatPublished,
} from './citation-display';
import type { Citation } from './citation';

const c = (over: Partial<Citation>): Citation => ({ id: 'x', index: 1, ...over });

describe('deriveDomain', () => {
  it('strips protocol and leading www.', () => {
    expect(deriveDomain('https://www.rxjs.dev/guide')).toBe('rxjs.dev');
  });
  it('returns null for missing or malformed url', () => {
    expect(deriveDomain(undefined)).toBeNull();
    expect(deriveDomain('not a url')).toBeNull();
  });
});

describe('deriveSourceType', () => {
  it('prefers an explicit sourceType', () => {
    expect(deriveSourceType(c({ sourceType: 'file', url: 'https://a.com' }))).toBe('file');
  });
  it('infers web from an http(s) url', () => {
    expect(deriveSourceType(c({ url: 'https://a.com' }))).toBe('web');
  });
  it('is unknown when neither is present', () => {
    expect(deriveSourceType(c({}))).toBe('unknown');
  });
});

describe('deriveMonogram', () => {
  it('uses the first letter of the domain, uppercased', () => {
    expect(deriveMonogram(c({ url: 'https://angular.dev' }))).toBe('A');
  });
  it('falls back to the title when there is no url', () => {
    expect(deriveMonogram(c({ title: 'zone.js' }))).toBe('Z');
  });
  it('falls back to "?" when nothing usable exists', () => {
    expect(deriveMonogram(c({}))).toBe('?');
  });
});

describe('monogramHue', () => {
  it('is deterministic and within [0,360)', () => {
    const h = monogramHue('rxjs.dev');
    expect(h).toBe(monogramHue('rxjs.dev'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
  it('differs for different seeds', () => {
    expect(monogramHue('angular.dev')).not.toBe(monogramHue('rxjs.dev'));
  });
});

describe('formatPublished', () => {
  it('formats a parseable date to "Mon YYYY"', () => {
    expect(formatPublished('2024-04-10')).toMatch(/2024/);
  });
  it('returns null for missing or unparseable values', () => {
    expect(formatPublished(undefined)).toBeNull();
    expect(formatPublished('banana')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "deriveDomain"`
Expected: FAIL — cannot resolve `./citation-display`.

- [ ] **Step 3: Write the implementation**

Create `libs/chat/src/lib/agent/citation-display.ts`:

```ts
// libs/chat/src/lib/agent/citation-display.ts
// SPDX-License-Identifier: MIT
// Pure, DOM-free display helpers over Citation. Shared by the inline marker,
// the preview card, and the sources panel so provenance rendering stays DRY.
import type { Citation } from './citation';

/** Hostname of `url` with a leading `www.` removed; null if absent/malformed. */
export function deriveDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Explicit `sourceType`, else 'web' inferred from a url, else 'unknown'. */
export function deriveSourceType(c: Citation): string {
  if (c.sourceType) return c.sourceType;
  return c.url ? 'web' : 'unknown';
}

/** Uppercased first letter of the domain (or title) for the monogram chip. */
export function deriveMonogram(c: Citation): string {
  const seed = deriveDomain(c.url) ?? c.title ?? '';
  const ch = seed.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

/** Deterministic hue in [0,360) from a seed string (stable monogram color). */
export function monogramHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

/** Short freshness label (e.g. "Apr 2024"); null when absent or unparseable. */
export function formatPublished(value?: string | number | Date): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "deriveDomain"` then `npx nx test chat -- -t "monogramHue"`
Expected: PASS for all helper describes.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/agent/citation-display.ts libs/chat/src/lib/agent/citation-display.spec.ts
git commit -m "feat(chat): pure citation display helpers (domain/type/monogram/date)"
```

---

## Task 3: Add `--tplane-chat-citation-*` design tokens

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts` (LIGHT_TOKENS, DARK_TOKENS, GEOMETRY_TOKENS)
- Test: `libs/chat/src/lib/styles/chat-tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/chat/src/lib/styles/chat-tokens.spec.ts` (before the final closing — add a new `describe` block):

```ts
describe('ROOT_TOKEN_STYLES — citation tokens', () => {
  it.each([
    '--tplane-chat-citation-accent:',
    '--tplane-chat-citation-accent-soft:',
    '--tplane-chat-citation-accent-border:',
    '--tplane-chat-citation-marker-bg:',
    '--tplane-chat-citation-marker-border:',
    '--tplane-chat-citation-marker-fg:',
    '--tplane-chat-citation-radius:',
  ])('defines %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "citation tokens"`
Expected: FAIL — tokens not found in `ROOT_TOKEN_STYLES`.

- [ ] **Step 3: Add the tokens**

In `libs/chat/src/lib/styles/chat-tokens.ts`, add to the **end of `LIGHT_TOKENS`** (just before its closing backtick):

```css
  /* --tplane-chat-citation-* — inline markers, preview card, sources panel */
  --tplane-chat-citation-accent: #2f6fe0;
  --tplane-chat-citation-accent-soft: #eaf1fd;
  --tplane-chat-citation-accent-border: #c9def8;
  --tplane-chat-citation-marker-bg: #f1f2f4;
  --tplane-chat-citation-marker-border: var(--tplane-chat-separator);
  --tplane-chat-citation-marker-fg: #4b5563;
```

Add to the **end of `DARK_TOKENS`** (just before its closing backtick):

```css
  /* --tplane-chat-citation-* dark variant */
  --tplane-chat-citation-accent: #6ea8ff;
  --tplane-chat-citation-accent-soft: rgba(79, 141, 245, 0.16);
  --tplane-chat-citation-accent-border: rgba(79, 141, 245, 0.38);
  --tplane-chat-citation-marker-bg: rgba(255, 255, 255, 0.08);
  --tplane-chat-citation-marker-border: var(--tplane-chat-separator);
  --tplane-chat-citation-marker-fg: #c9ccd1;
```

Add to the **end of `GEOMETRY_TOKENS`** (theme-invariant; before its closing backtick):

```css
  --tplane-chat-citation-radius: 6px;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "citation tokens"`
Expected: PASS (7 declarations found).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts libs/chat/src/lib/styles/chat-tokens.spec.ts
git commit -m "feat(chat): add --tplane-chat-citation-* tokens (light/dark)"
```

---

## Task 4: Citation styles module

**Files:**
- Create: `libs/chat/src/lib/styles/chat-citations.styles.ts`

This file has no standalone test — its consts are validated when the components that import them render (Tasks 5–8) and in live verification (Task 10). The full CSS is provided so no judgment is required.

- [ ] **Step 1: Create the styles module**

Create `libs/chat/src/lib/styles/chat-citations.styles.ts`:

```ts
// libs/chat/src/lib/styles/chat-citations.styles.ts
// SPDX-License-Identifier: MIT

/** Inline pill marker (chat-md-citation-reference). */
export const CHAT_CITATION_MARKER_STYLES = `
  :host { display: inline; }
  .chat-citation-marker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 17px;
    height: 17px;
    padding: 0 5px;
    margin: 0 1px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: var(--tplane-chat-citation-marker-fg);
    background: var(--tplane-chat-citation-marker-bg);
    border: 1px solid var(--tplane-chat-citation-marker-border);
    border-radius: var(--tplane-chat-citation-radius);
    translate: 0 -1px;
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .chat-citation-marker:hover,
  .chat-citation-marker:focus-visible {
    background: var(--tplane-chat-citation-accent-soft);
    border-color: var(--tplane-chat-citation-accent-border);
    color: var(--tplane-chat-citation-accent);
    outline: none;
  }
  .chat-citation-marker:focus-visible {
    box-shadow: 0 0 0 2px var(--tplane-chat-citation-accent-border);
  }
  .chat-citation-marker--unresolved {
    color: var(--tplane-chat-text-muted);
    background: transparent;
    border-style: dashed;
    cursor: default;
  }
  .chat-citation-marker--unresolved:hover {
    background: transparent;
    border-color: var(--tplane-chat-citation-marker-border);
    color: var(--tplane-chat-text-muted);
  }
`;

/** Provenance preview card (chat-citation-preview), portaled into the overlay pane. */
export const CHAT_CITATION_PREVIEW_STYLES = `
  :host { display: block; }
  .chat-citation-preview {
    width: 320px;
    max-width: calc(100vw - 24px);
    box-sizing: border-box;
    background: var(--tplane-chat-surface);
    border: 1px solid var(--tplane-chat-separator);
    border-radius: var(--tplane-chat-radius-card);
    box-shadow: var(--tplane-chat-shadow-md);
    padding: 12px 13px;
    text-align: left;
    color: var(--tplane-chat-text);
  }
  .chat-citation-preview__head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 7px;
  }
  .chat-citation-preview__fav {
    width: 16px; height: 16px;
    border-radius: 4px;
    flex: 0 0 auto;
    object-fit: cover;
  }
  .chat-citation-preview__fav--mono {
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 10px; font-weight: 700;
  }
  .chat-citation-preview__domain {
    font-size: 12px;
    color: var(--tplane-chat-text-muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-citation-preview__type {
    margin-left: auto;
    font-size: 11px;
    color: var(--tplane-chat-text-muted);
    flex: 0 0 auto;
  }
  .chat-citation-preview__title {
    font-size: 14px; font-weight: 600; line-height: 1.35;
    margin: 0 0 5px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .chat-citation-preview__snippet {
    font-size: 12.5px; color: var(--tplane-chat-text-muted); line-height: 1.5;
    margin: 0;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .chat-citation-preview__foot {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 10px; padding-top: 9px;
    border-top: 1px solid var(--tplane-chat-separator);
  }
  .chat-citation-preview__open {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 600;
    color: var(--tplane-chat-citation-accent);
    text-decoration: none;
  }
  .chat-citation-preview__open:hover { text-decoration: underline; }
  .chat-citation-preview__meta { font-size: 11px; color: var(--tplane-chat-muted); }
`;

/** Sources panel (chat-citations) + detail card (chat-citations-card). */
export const CHAT_CITATIONS_PANEL_STYLES = `
  :host { display: block; }
  .chat-citations {
    margin-top: var(--tplane-chat-space-5);
    padding-top: var(--tplane-chat-space-4);
    border-top: 1px solid var(--tplane-chat-separator);
  }
  .chat-citations__header {
    display: flex; align-items: center; gap: 9px;
    width: 100%;
    padding: 0 0 11px;
    background: none; border: 0;
    font: inherit; color: inherit;
    cursor: pointer; text-align: left;
  }
  .chat-citations__heading { font-size: 13px; font-weight: 600; }
  .chat-citations__count {
    font-size: 11px; font-weight: 600;
    color: var(--tplane-chat-text-muted);
    background: var(--tplane-chat-surface-alt);
    border: 1px solid var(--tplane-chat-separator);
    border-radius: 20px;
    padding: 1px 7px;
  }
  .chat-citations__favstack { display: flex; margin-left: 2px; }
  .chat-citations__fav {
    width: 16px; height: 16px;
    border-radius: 4px;
    margin-left: -5px;
    border: 1.5px solid var(--tplane-chat-surface);
    object-fit: cover;
  }
  .chat-citations__fav:first-child { margin-left: 0; }
  .chat-citations__fav--mono {
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 9px; font-weight: 700;
  }
  .chat-citations__chevron {
    margin-left: auto;
    color: var(--tplane-chat-text-muted);
    transition: transform 120ms ease;
  }
  .chat-citations__chevron.is-open { transform: rotate(180deg); }
  .chat-citations__list {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .chat-citations__item { margin: 0; }

  .chat-citations-card {
    display: flex; gap: 10px;
    padding: 10px 11px;
    background: var(--tplane-chat-surface);
    border: 1px solid var(--tplane-chat-separator);
    border-radius: var(--tplane-chat-radius-card);
    text-decoration: none; color: inherit;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .chat-citations-card:hover,
  .chat-citations-card:focus-visible {
    border-color: var(--tplane-chat-citation-accent-border);
    outline: none;
  }
  .chat-citations-card__index {
    flex: 0 0 auto;
    width: 18px; height: 18px;
    border-radius: 5px;
    background: var(--tplane-chat-surface-alt);
    border: 1px solid var(--tplane-chat-separator);
    color: var(--tplane-chat-text-muted);
    font-size: 11px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    margin-top: 1px;
  }
  .chat-citations-card__body { min-width: 0; flex: 1; }
  .chat-citations-card__top {
    display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
  }
  .chat-citations-card__fav {
    width: 14px; height: 14px; border-radius: 3px; flex: 0 0 auto; object-fit: cover;
  }
  .chat-citations-card__fav--mono {
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 8px; font-weight: 700;
  }
  .chat-citations-card__domain { font-size: 11.5px; color: var(--tplane-chat-text-muted); }
  .chat-citations-card__type { margin-left: auto; font-size: 10.5px; color: var(--tplane-chat-muted); }
  .chat-citations-card__title {
    font-size: 13.5px; font-weight: 600; line-height: 1.35;
    margin: 0 0 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-citations-card:hover .chat-citations-card__title { color: var(--tplane-chat-citation-accent); }
  .chat-citations-card__snippet {
    font-size: 12px; color: var(--tplane-chat-text-muted); line-height: 1.45;
    margin: 0;
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
  }
`;
```

- [ ] **Step 2: Verify it compiles (imported next tasks)**

Run: `npx tsc --project libs/chat/tsconfig.type-tests.json --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-citations.styles.ts
git commit -m "feat(chat): citation marker/preview/panel style module"
```

---

## Task 5: `ChatCitationPreviewComponent` (preview card)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.spec.ts`:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatCitationPreviewComponent } from './chat-citation-preview.component';
import type { Citation } from '../../agent/citation';

@Component({
  standalone: true,
  imports: [ChatCitationPreviewComponent],
  template: `<chat-citation-preview [citation]="citation()" />`,
})
class HostComponent {
  citation = signal<Citation>({ id: 'a', index: 1 });
}

function render(c: Citation) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.citation.set(c);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ChatCitationPreviewComponent', () => {
  it('shows domain, title, snippet and an Open source link when url present', () => {
    const el = render({
      id: 'a', index: 1, title: 'RxJS intro', snippet: 'Reactive streams',
      url: 'https://www.rxjs.dev/guide',
    });
    expect(el.querySelector('.chat-citation-preview__domain')?.textContent).toContain('rxjs.dev');
    expect(el.querySelector('.chat-citation-preview__title')?.textContent).toContain('RxJS intro');
    expect(el.querySelector('.chat-citation-preview__snippet')?.textContent).toContain('Reactive streams');
    const open = el.querySelector('a.chat-citation-preview__open') as HTMLAnchorElement;
    expect(open).toBeTruthy();
    expect(open.getAttribute('href')).toBe('https://www.rxjs.dev/guide');
  });

  it('omits the Open source footer when there is no url', () => {
    const el = render({ id: 'a', index: 1, title: 'Local note', snippet: 'from a file' });
    expect(el.querySelector('.chat-citation-preview__open')).toBeNull();
  });

  it('renders a monogram when no iconUrl is supplied', () => {
    const el = render({ id: 'a', index: 1, url: 'https://angular.dev' });
    const mono = el.querySelector('.chat-citation-preview__fav--mono');
    expect(mono?.textContent?.trim()).toBe('A');
  });

  it('renders an <img> favicon when iconUrl is supplied', () => {
    const el = render({ id: 'a', index: 1, url: 'https://angular.dev', iconUrl: 'data:image/png;base64,AAA' });
    expect(el.querySelector('img.chat-citation-preview__fav')).toBeTruthy();
    expect(el.querySelector('.chat-citation-preview__fav--mono')).toBeNull();
  });

  it('shows a freshness label from publishedAt', () => {
    const el = render({ id: 'a', index: 1, url: 'https://angular.dev', publishedAt: '2024-04-10' });
    expect(el.querySelector('.chat-citation-preview__meta')?.textContent).toMatch(/2024/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "ChatCitationPreviewComponent"`
Expected: FAIL — cannot resolve `./chat-citation-preview.component`.

- [ ] **Step 3: Write the implementation**

Create `libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts`:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Citation } from '../../agent/citation';
import {
  deriveDomain, deriveMonogram, deriveSourceType, formatPublished, monogramHue,
} from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATION_PREVIEW_STYLES } from '../../styles/chat-citations.styles';

/**
 * Presentational provenance card for a single Citation. Rendered inside the
 * inline marker's connected-overlay pane (hover/tap preview) — self-contained
 * so its encapsulated styles apply even when portaled to the body-level pane.
 */
@Component({
  selector: 'chat-citation-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CITATION_PREVIEW_STYLES],
  template: `
    <div class="chat-citation-preview" role="group" [attr.aria-label]="'Source ' + citation().index">
      <div class="chat-citation-preview__head">
        @if (citation().iconUrl; as icon) {
          <img class="chat-citation-preview__fav" [src]="icon" alt="" width="16" height="16" />
        } @else {
          <span class="chat-citation-preview__fav chat-citation-preview__fav--mono"
                [style.background]="monoColor()">{{ monogram() }}</span>
        }
        @if (domain(); as d) { <span class="chat-citation-preview__domain">{{ d }}</span> }
        @if (typeLabel(); as t) { <span class="chat-citation-preview__type">{{ t }}</span> }
      </div>
      @if (citation().title; as title) {
        <p class="chat-citation-preview__title">{{ title }}</p>
      }
      @if (citation().snippet; as s) {
        <p class="chat-citation-preview__snippet">{{ s }}</p>
      }
      @if (citation().url; as url) {
        <div class="chat-citation-preview__foot">
          <a class="chat-citation-preview__open" [href]="url" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12">
              <path d="M7 17L17 7M17 7H8M17 7v9" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            Open source
          </a>
          @if (published(); as p) { <span class="chat-citation-preview__meta">{{ p }}</span> }
        </div>
      }
    </div>
  `,
})
export class ChatCitationPreviewComponent {
  readonly citation = input.required<Citation>();

  protected readonly domain = computed(() => deriveDomain(this.citation().url));
  protected readonly monogram = computed(() => deriveMonogram(this.citation()));
  protected readonly monoColor = computed(() => {
    const seed = this.domain() ?? this.citation().title ?? '?';
    return `hsl(${monogramHue(seed)} 60% 45%)`;
  });
  protected readonly typeLabel = computed(() => {
    const t = deriveSourceType(this.citation());
    if (t === 'unknown') return null;
    return t === 'web' ? 'Web' : t.charAt(0).toUpperCase() + t.slice(1);
  });
  protected readonly published = computed(() => formatPublished(this.citation().publishedAt));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "ChatCitationPreviewComponent"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts \
        libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.spec.ts
git commit -m "feat(chat): ChatCitationPreviewComponent provenance card"
```

---

## Task 6: Rewrite inline marker — pill + overlay preview + states + a11y

**Files:**
- Modify: `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts`
- Modify: `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts`

Behavior: resolved+URL → `<a>` pill (click navigates on desktop; taps preview on touch). Resolved no-URL → `<a role="button">` pill (no href; toggles preview). Unresolved → non-interactive muted dashed `<span>`. Preview opens on hover (120ms) / focus / tap, closes on leave (200ms) / blur / Escape / outside / Tab, and stays open while the pointer is over the portaled card.

- [ ] **Step 1: Replace the marker spec to assert the new state markup**

Replace `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts` entirely:

```ts
// libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CitationsResolverService } from '../citations-resolver.service';
import { MarkdownCitationReferenceComponent } from './markdown-citation-reference.component';
import type { MarkdownCitationReferenceNode } from '@cacheplane/partial-markdown';

function makeNode(refId: string, index: number, resolved: boolean): MarkdownCitationReferenceNode {
  return {
    id: 1, type: 'citation-reference', status: 'complete',
    parent: null, index, refId, resolved,
  } as MarkdownCitationReferenceNode;
}

@Component({
  standalone: true,
  imports: [MarkdownCitationReferenceComponent],
  providers: [CitationsResolverService],
  template: `<chat-md-citation-reference [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownCitationReferenceNode>(makeNode('src1', 1, false));
}

describe('MarkdownCitationReferenceComponent', () => {
  it('renders a non-interactive unresolved pill when no citation is found', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span.chat-citation-marker');
    expect(span).toBeTruthy();
    expect(span.classList.contains('chat-citation-marker--unresolved')).toBe(true);
    expect(fixture.nativeElement.querySelector('a.chat-citation-marker')).toBeNull();
    expect(span.textContent).toContain('1');
  });

  it('renders an <a> pill with href when the citation has a url', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const svc = fixture.debugElement.injector.get(CitationsResolverService);
    svc.message.set({
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'Source', url: 'https://example.com' }],
    });
    fixture.componentInstance.node.set(makeNode('src1', 1, true));
    fixture.detectChanges();
    const a = fixture.nativeElement.querySelector('a.chat-citation-marker');
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.getAttribute('aria-label')).toContain('opens in new tab');
    expect(a.classList.contains('chat-citation-marker--no-url')).toBe(false);
    expect(a.textContent).toContain('1');
  });

  it('renders a button-role pill without href when the citation has no url', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const svc = fixture.debugElement.injector.get(CitationsResolverService);
    svc.message.set({
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'Title only, no URL' }],
    });
    fixture.componentInstance.node.set(makeNode('src1', 1, true));
    fixture.detectChanges();
    const a = fixture.nativeElement.querySelector('a.chat-citation-marker--no-url');
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBeNull();
    expect(a.getAttribute('role')).toBe('button');
    expect(a.getAttribute('tabindex')).toBe('0');
    expect(a.textContent).toContain('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "MarkdownCitationReferenceComponent"`
Expected: FAIL — no-url case still renders old `<span>`, and aria-label/role assertions fail.

- [ ] **Step 3: Rewrite the component**

Replace `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts` entirely:

```ts
// libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, computed, inject, input, signal,
} from '@angular/core';
import type { MarkdownCitationReferenceNode } from '@cacheplane/partial-markdown';
import { CitationsResolverService } from '../citations-resolver.service';
import {
  ChatConnectedOverlayDirective, ChatOverlayOriginDirective,
} from '../../primitives/overlay/connected-overlay.directive';
import type { ConnectedPosition } from '../../primitives/overlay/connected-position';
import { ChatCitationPreviewComponent } from '../../primitives/chat-citations/chat-citation-preview.component';
import { deriveDomain } from '../../agent/citation-display';
import type { Citation } from '../../agent/citation';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATION_MARKER_STYLES } from '../../styles/chat-citations.styles';

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

/**
 * Inline citation marker. Renders a numbered pill and reveals a provenance
 * preview card (portaled via the connected-overlay primitive) on hover/focus
 * (desktop) or tap (touch). Click navigates on desktop when a url exists;
 * on touch it previews instead of navigating.
 */
@Component({
  selector: 'chat-md-citation-reference',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatConnectedOverlayDirective, ChatOverlayOriginDirective, ChatCitationPreviewComponent],
  styles: [CHAT_HOST_TOKENS, CHAT_CITATION_MARKER_STYLES],
  template: `
    @if (resolved(); as r) {
      <a
        class="chat-citation-marker"
        [class.chat-citation-marker--no-url]="!r.citation.url"
        chatOverlayOrigin
        #origin="chatOverlayOrigin"
        [attr.href]="r.citation.url ?? null"
        [attr.target]="r.citation.url ? '_blank' : null"
        [attr.rel]="r.citation.url ? 'noopener noreferrer' : null"
        [attr.role]="r.citation.url ? null : 'button'"
        [attr.tabindex]="r.citation.url ? null : '0'"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel(r.citation)"
        (mouseenter)="onEnter()"
        (mouseleave)="onLeave()"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (click)="onClick($event, r.citation)"
        (keydown)="onKeydown($event, r.citation)"
      >{{ node().index }}</a>
      <ng-template
        chatConnectedOverlay
        [chatOverlayOrigin]="origin"
        [chatOverlayOpen]="open()"
        [chatOverlayPositions]="positions"
        [chatOverlayPanelClass]="'chat-citation-preview-pane'"
        (chatOverlayAttached)="onAttached($event)"
        (chatOverlayOutsideClick)="close()"
        (chatOverlayDetach)="close()"
      >
        <chat-citation-preview [citation]="r.citation" />
      </ng-template>
    } @else {
      <span
        class="chat-citation-marker chat-citation-marker--unresolved"
        [attr.title]="'No source available'"
        [attr.aria-label]="'Citation ' + node().index + ': source unavailable'"
      >{{ node().index }}</span>
    }
  `,
})
export class MarkdownCitationReferenceComponent {
  readonly node = input.required<MarkdownCitationReferenceNode>();

  private readonly resolver = inject(CitationsResolverService);
  private readonly document = inject(DOCUMENT);

  protected readonly resolved = computed(() => this.resolver.lookup(this.node().refId)());
  protected readonly open = signal(false);

  // Prefer below-start, flip above when it won't fit. The positioner clamps to view.
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  private readonly hoverCapable =
    this.document.defaultView?.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;

  private openTimer = 0;
  private closeTimer = 0;
  private pane: HTMLElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
  }

  protected ariaLabel(c: Citation): string {
    const domain = deriveDomain(c.url);
    const parts = [`Source ${c.index}`];
    if (c.title) parts.push(c.title);
    if (domain) parts.push(domain);
    const base = parts.join(', ');
    return c.url ? `${base}, opens in new tab` : base;
  }

  protected onEnter(): void {
    if (!this.hoverCapable) return;
    this.cancelClose();
    const win = this.document.defaultView;
    if (win) this.openTimer = win.setTimeout(() => this.open.set(true), OPEN_DELAY_MS);
  }

  protected onLeave(): void {
    if (!this.hoverCapable) return;
    this.cancelOpen();
    this.scheduleClose();
  }

  protected onFocus(): void {
    this.open.set(true);
  }

  protected onBlur(): void {
    const active = this.document.activeElement;
    if (this.pane && active && this.pane.contains(active)) return; // focus moved into card
    this.close();
  }

  protected onClick(e: MouseEvent, c: Citation): void {
    // Desktop + real url: let the native link navigate.
    if (this.hoverCapable && c.url) return;
    // No url, or touch device: preview instead of navigating.
    e.preventDefault();
    this.open.update((v) => !v);
  }

  protected onKeydown(e: KeyboardEvent, c: Citation): void {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    // A no-url marker is a button: Enter/Space toggles the preview.
    if (!c.url && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.open.update((v) => !v);
    }
  }

  protected onAttached(pane: HTMLElement): void {
    this.pane = pane;
    pane.addEventListener('mouseenter', this.onPaneEnter);
    pane.addEventListener('mouseleave', this.onPaneLeave);
  }

  protected close(): void {
    this.clearTimers();
    this.open.set(false);
    this.pane = null; // directive removes the pane element on detach
  }

  private readonly onPaneEnter = () => this.cancelClose();
  private readonly onPaneLeave = () => this.scheduleClose();

  private scheduleClose(): void {
    const win = this.document.defaultView;
    if (win) this.closeTimer = win.setTimeout(() => this.open.set(false), CLOSE_DELAY_MS);
  }

  private cancelOpen(): void {
    const win = this.document.defaultView;
    if (this.openTimer && win) win.clearTimeout(this.openTimer);
    this.openTimer = 0;
  }

  private cancelClose(): void {
    const win = this.document.defaultView;
    if (this.closeTimer && win) win.clearTimeout(this.closeTimer);
    this.closeTimer = 0;
  }

  private clearTimers(): void {
    this.cancelOpen();
    this.cancelClose();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "MarkdownCitationReferenceComponent"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts \
        libs/chat/src/lib/markdown/views/markdown-citation-reference.component.spec.ts
git commit -m "feat(chat): pill citation markers with hover/tap preview card"
```

---

## Task 7: Detail-card layout for `ChatCitationsCardComponent`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.spec.ts`:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatCitationsCardComponent } from './chat-citations-card.component';
import type { Citation } from '../../agent/citation';

@Component({
  standalone: true,
  imports: [ChatCitationsCardComponent],
  template: `<chat-citations-card [citation]="citation()" />`,
})
class HostComponent {
  citation = signal<Citation>({ id: 'a', index: 1 });
}

function render(c: Citation) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.citation.set(c);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ChatCitationsCardComponent', () => {
  it('renders as a link (opens source) with index, domain, title and snippet when url present', () => {
    const el = render({
      id: 'a', index: 2, title: 'RxJS intro', snippet: 'Reactive streams',
      url: 'https://www.rxjs.dev/guide',
    });
    const card = el.querySelector('a.chat-citations-card') as HTMLAnchorElement;
    expect(card).toBeTruthy();
    expect(card.getAttribute('href')).toBe('https://www.rxjs.dev/guide');
    expect(el.querySelector('.chat-citations-card__index')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('.chat-citations-card__domain')?.textContent).toContain('rxjs.dev');
    expect(el.querySelector('.chat-citations-card__title')?.textContent).toContain('RxJS intro');
    expect(el.querySelector('.chat-citations-card__snippet')?.textContent).toContain('Reactive streams');
  });

  it('renders a non-link card (div) when there is no url', () => {
    const el = render({ id: 'a', index: 1, title: 'Local note' });
    expect(el.querySelector('a.chat-citations-card')).toBeNull();
    expect(el.querySelector('div.chat-citations-card')).toBeTruthy();
    expect(el.querySelector('.chat-citations-card__title')?.textContent).toContain('Local note');
  });

  it('renders a monogram when no iconUrl is supplied', () => {
    const el = render({ id: 'a', index: 1, url: 'https://angular.dev' });
    expect(el.querySelector('.chat-citations-card__fav--mono')?.textContent?.trim()).toBe('A');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "ChatCitationsCardComponent"`
Expected: FAIL — old markup has no `__index`/`__domain`/`__fav`, and the card is not an `<a>`.

- [ ] **Step 3: Rewrite the component**

Replace `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts` entirely:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Citation } from '../../agent/citation';
import { deriveDomain, deriveMonogram, deriveSourceType, monogramHue } from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATIONS_PANEL_STYLES } from '../../styles/chat-citations.styles';

/**
 * Sources-panel detail card: index badge, favicon/monogram + domain + type,
 * title, one-line snippet. Renders as an <a> (opens the source) when a url is
 * present, otherwise a non-interactive <div>. Shares the panel style module.
 */
@Component({
  selector: 'chat-citations-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CITATIONS_PANEL_STYLES],
  template: `
    @if (citation().url; as url) {
      <a class="chat-citations-card" [href]="url" target="_blank" rel="noopener noreferrer"
         [attr.aria-label]="'Source ' + citation().index + ': ' + (citation().title ?? url)">
        <ng-container [ngTemplateOutlet]="inner" />
      </a>
    } @else {
      <div class="chat-citations-card">
        <ng-container [ngTemplateOutlet]="inner" />
      </div>
    }

    <ng-template #inner>
      <span class="chat-citations-card__index">{{ citation().index }}</span>
      <span class="chat-citations-card__body">
        <span class="chat-citations-card__top">
          @if (citation().iconUrl; as icon) {
            <img class="chat-citations-card__fav" [src]="icon" alt="" width="14" height="14" />
          } @else {
            <span class="chat-citations-card__fav chat-citations-card__fav--mono"
                  [style.background]="monoColor()">{{ monogram() }}</span>
          }
          @if (domain(); as d) { <span class="chat-citations-card__domain">{{ d }}</span> }
          @if (typeLabel(); as t) { <span class="chat-citations-card__type">{{ t }}</span> }
        </span>
        @if (title(); as t) {
          <span class="chat-citations-card__title">{{ t }}</span>
        }
        @if (citation().snippet; as s) {
          <span class="chat-citations-card__snippet">{{ s }}</span>
        }
      </span>
    </ng-template>
  `,
  imports: [],
})
export class ChatCitationsCardComponent {
  readonly citation = input.required<Citation>();

  protected readonly domain = computed(() => deriveDomain(this.citation().url));
  protected readonly title = computed(() => this.citation().title ?? this.citation().url ?? null);
  protected readonly monogram = computed(() => deriveMonogram(this.citation()));
  protected readonly monoColor = computed(() => {
    const seed = this.domain() ?? this.citation().title ?? '?';
    return `hsl(${monogramHue(seed)} 60% 45%)`;
  });
  protected readonly typeLabel = computed(() => {
    const t = deriveSourceType(this.citation());
    if (t === 'unknown') return null;
    return t === 'web' ? 'Web' : t.charAt(0).toUpperCase() + t.slice(1);
  });
}
```

Note: `ngTemplateOutlet` is a structural directive from `@angular/common`. Update the import line — replace `imports: [],` with:

```ts
  imports: [NgTemplateOutlet],
```

and add at the top with the other imports:

```ts
import { NgTemplateOutlet } from '@angular/common';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "ChatCitationsCardComponent"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts \
        libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.spec.ts
git commit -m "feat(chat): detail-card layout for sources panel cards"
```

---

## Task 8: Collapsible header + favicon stack on `ChatCitationsComponent`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts`

- [ ] **Step 1: Add a collapse test (append to existing spec)**

In `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts`, add these two tests inside the existing `describe('ChatCitationsComponent', () => { ... })` block (before its closing `});`):

```ts
  it('shows a Sources header with the citation count', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([
      { id: 'a', index: 1, title: 'A' },
      { id: 'b', index: 2, title: 'B' },
    ]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-citations__heading')?.textContent).toContain('Sources');
    expect(fixture.nativeElement.querySelector('.chat-citations__count')?.textContent?.trim()).toBe('2');
  });

  it('collapses and expands the list when the header is toggled', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([{ id: 'a', index: 1, title: 'A' }]));
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.chat-citations__header') as HTMLButtonElement;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.chat-citations__list')).toBeTruthy();

    header.click();
    fixture.detectChanges();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.chat-citations__list')).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- -t "collapses and expands"`
Expected: FAIL — no `.chat-citations__header`/`__count` in current markup.

- [ ] **Step 3: Update the component**

Replace `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts` entirely:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy, Component, ContentChild, Directive, TemplateRef,
  computed, inject, input, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Message } from '../../agent/message';
import type { Citation } from '../../agent/citation';
import { ChatCitationsCardComponent } from './chat-citations-card.component';
import { CitationsResolverService, mdDefToCitation } from '../../markdown/citations-resolver.service';
import { deriveDomain, deriveMonogram, monogramHue } from '../../agent/citation-display';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CITATIONS_PANEL_STYLES } from '../../styles/chat-citations.styles';

/**
 * ContentChild template directive for custom citation card rendering.
 * Usage: <ng-template chatCitationCard let-citation>...</ng-template>
 */
@Directive({ selector: 'ng-template[chatCitationCard]', standalone: true })
export class ChatCitationCardTemplateDirective {
  readonly tpl = inject<TemplateRef<{ $implicit: Citation }>>(TemplateRef);
}

interface FavEntry { id: string; iconUrl?: string; mono: string; color: string; }

let nextCitationsId = 0;

@Component({
  selector: 'chat-citations',
  standalone: true,
  imports: [NgTemplateOutlet, ChatCitationsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CITATIONS_PANEL_STYLES],
  template: `
    @if (citations().length > 0) {
      <section class="chat-citations">
        <button
          type="button"
          class="chat-citations__header"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="listId"
          (click)="expanded.set(!expanded())"
        >
          <span class="chat-citations__heading">{{ heading() }}</span>
          <span class="chat-citations__count">{{ citations().length }}</span>
          <span class="chat-citations__favstack" aria-hidden="true">
            @for (f of favstack(); track f.id) {
              @if (f.iconUrl) {
                <img class="chat-citations__fav" [src]="f.iconUrl" alt="" width="16" height="16" />
              } @else {
                <span class="chat-citations__fav chat-citations__fav--mono"
                      [style.background]="f.color">{{ f.mono }}</span>
              }
            }
          </span>
          <svg class="chat-citations__chevron" [class.is-open]="expanded()"
               viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        @if (expanded()) {
          <ul class="chat-citations__list" [id]="listId">
            @for (c of citations(); track c.id) {
              <li class="chat-citations__item">
                @if (cardTpl) {
                  <ng-container *ngTemplateOutlet="cardTpl.tpl; context: { $implicit: c }" />
                } @else {
                  <chat-citations-card [citation]="c" />
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class ChatCitationsComponent {
  readonly message = input.required<Message>();
  readonly heading = input<string>('Sources');

  protected readonly expanded = signal(true);
  protected readonly listId = `chat-citations-list-${nextCitationsId++}`;

  @ContentChild(ChatCitationCardTemplateDirective) cardTpl: ChatCitationCardTemplateDirective | null = null;

  private readonly resolver = inject(CitationsResolverService, { optional: true });

  /**
   * Combined citation list:
   *   1. Message.citations (provider-populated, takes precedence by id)
   *   2. Markdown sidecar defs (Pandoc [^id]: lines), merged for unseen ids.
   * Sorted by index ascending.
   */
  protected readonly citations = computed<Citation[]>(() => {
    const fromMessage = this.message().citations ?? [];
    const seenIds = new Set(fromMessage.map((c) => c.id));
    const fromMarkdown: Citation[] = [];
    const mdDefs = this.resolver?.markdownDefs();
    if (mdDefs) {
      for (const def of mdDefs.values()) {
        if (!seenIds.has(def.id)) fromMarkdown.push(mdDefToCitation(def));
      }
    }
    return [...fromMessage, ...fromMarkdown].sort((a, b) => a.index - b.index);
  });

  /** First 3 sources, mapped to favicon/monogram chips for the header preview. */
  protected readonly favstack = computed<FavEntry[]>(() =>
    this.citations().slice(0, 3).map((c) => {
      const seed = deriveDomain(c.url) ?? c.title ?? '?';
      return { id: c.id, iconUrl: c.iconUrl, mono: deriveMonogram(c), color: `hsl(${monogramHue(seed)} 60% 45%)` };
    }),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- -t "ChatCitationsComponent"`
Expected: PASS — the existing 6 tests plus the 2 new ones (existing tests hold because the list is expanded by default and card titles keep the `.chat-citations-card__title` class).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts \
        libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts
git commit -m "feat(chat): collapsible Sources header with favicon stack"
```

---

## Task 9: Export the preview component, regenerate API docs, build

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Export `ChatCitationPreviewComponent`**

In `libs/chat/src/public-api.ts`, find the existing citations export (search for `chat-citations.component` or `ChatCitationsComponent`) and add, adjacent to it:

```ts
export { ChatCitationPreviewComponent } from './lib/primitives/chat-citations/chat-citation-preview.component';
```

- [ ] **Step 2: Run the full chat test suite**

Run: `npx nx test chat`
Expected: PASS (all suites green).

- [ ] **Step 3: Lint the lib and confirm no new errors**

Run: `npx nx lint chat 2>&1 | grep -cE ' error '`
Expected: `0` (warnings are tolerated; errors are not). If nonzero, read the errors and fix — the overlay aliasing pattern already carries the documented `eslint-disable` header in `connected-overlay.directive.ts`; mirror it only if you added new aliased inputs (you did not).

- [ ] **Step 4: Build the lib**

Run: `npx nx build chat`
Expected: build succeeds.

- [ ] **Step 5: Regenerate API docs (new public export + Citation fields)**

Run: `npm run generate-api-docs`
Expected: updates generated API docs to include `ChatCitationPreviewComponent` and the new `Citation` fields.

- [ ] **Step 6: Commit**

Run `git status` first to see where `generate-api-docs` wrote (path varies by repo config — often a generated api-docs directory). Stage the public-api change plus whatever the regen touched:

```bash
git status                                   # inspect regenerated files
git add libs/chat/src/public-api.ts
git add <regenerated-api-docs-paths>         # from the git status output
git commit -m "feat(chat): export ChatCitationPreviewComponent + regen api docs"
```

---

## Task 10: Live verification in `examples/chat`

The overlay preview (portaling, pointer-type branch, hover keepalive, `:host()` encapsulation) cannot be fully proven under jsdom/aimock replay — it needs a real browser. Verify manually.

- [ ] **Step 1: Serve the chat example with a real key**

Export only `OPENAI_API_KEY` (do NOT source the whole root `.env` — that sets `AG_UI_INTERNAL_TOKEN` and flips server auth on), then serve:

```bash
export OPENAI_API_KEY=sk-...
npx nx serve examples-chat
```

(If the exact serve target name differs, run `npx nx show projects | grep chat` and use the `examples`/`chat` app target.)

- [ ] **Step 2: Drive the sources prompt in the browser**

In the running app, send: **"Show me a markdown table comparing Angular signals, RxJS, and zone.js — three columns: name, mental model, when to use. Keep it concise."** (or any prompt whose agent returns citations).

Verify visually:
- Inline markers render as **numbered pills** (baseline-aligned, accent tint on hover), including inside table cells and when adjacent (grouped).
- **Hover** a pill (desktop) → the preview card appears anchored under it; moving into the card keeps it open; leaving closes it after a beat. **Keyboard focus** (Tab to a pill) also opens it; **Escape** closes.
- **Click** a pill with a url opens the source in a new tab.
- The **Sources panel** shows the collapsible "Sources · N" header with stacked favicons/monograms; toggling collapses/expands; each detail card opens its source.
- Toggle OS dark mode (or `data-theme="dark"`) → tokens flip; markers/cards/preview remain legible with adequate contrast.
- Narrow the viewport to mobile width → **tap** a pill previews (no surprise navigation); the card's "Open source" navigates.

- [ ] **Step 3: Confirm no console errors**

Check the browser console: no Angular errors/warnings from the citation components during render or interaction.

- [ ] **Step 4: Final commit (if the example needed any wiring)**

If `examples/chat` required no changes, there is nothing to commit — the feature lives entirely in the lib. If a demo message/fixture was added to showcase citations, commit it:

```bash
git add examples/
git commit -m "chore(examples): showcase citation sources in chat example"
```

---

## Self-Review Notes (author)

- **Spec coverage:** markers (T6) · preview card (T5) · sources panel (T8) · detail cards (T7) · tokens (T3) · styles (T4) · helpers/derivation (T2) · Citation model extension (T1) · a11y (T5–T8 aria + T6 keyboard) · no-auto-favicon (T2 `iconUrl`-only + monogram) · pointer-adaptive interaction (T6) · api-docs/build/lint gate (T9) · live browser + mobile + dark verification (T10). All spec sections map to a task.
- **No placeholders:** every code/step is complete and copy-pasteable.
- **Type/name consistency:** helper names (`deriveDomain`/`deriveSourceType`/`deriveMonogram`/`monogramHue`/`formatPublished`), class names (`chat-citation-marker`, `chat-citations-card__*`, `chat-citation-preview__*`, `chat-citations__*`), `Citation` fields (`sourceType`/`iconUrl`/`publishedAt`), and the overlay wiring (`chatOverlayOrigin`/`chatOverlayOpen`/`chatOverlayPositions`/`chatOverlayPanelClass` + `chatOverlayAttached`/`chatOverlayOutsideClick`/`chatOverlayDetach`) are used identically across tasks.
