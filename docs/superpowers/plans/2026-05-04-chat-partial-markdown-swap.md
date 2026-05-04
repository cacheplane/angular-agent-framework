# Chat 0.0.20 — `<chat-streaming-md>` Partial-Markdown Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `<chat-streaming-md>`'s `marked` + `innerHTML` rendering pipeline with an Angular template walking a `@cacheplane/partial-markdown@0.1.0` AST through the existing `@ngaf/render` view registry. Ships as `@ngaf/chat` 0.0.20.

**Architecture:** A new `MARKDOWN_VIEW_REGISTRY` DI token holds a `ViewRegistry` mapping `MarkdownNode.type` strings to per-node-type Angular components. A shared `<md-children>` component recursively dispatches children through the registry via `*ngComponentOutlet`. `<chat-streaming-md>` keeps a `createPartialMarkdownParser()` instance across signal changes, calls `parser.push(delta)` on content updates (or resets the parser on divergence), and renders the resulting `MarkdownDocumentNode` tree through the registry. Identity preservation in the parser → stable Angular `track $any($node)` → unchanged subtrees never re-render.

**Tech Stack:** Angular 21 standalone components + signals + OnPush; `@cacheplane/partial-markdown@0.1.0` (just published, no runtime deps); existing `@ngaf/render` `ViewRegistry`; vitest for component specs.

**Reference spec:** `docs/superpowers/specs/2026-05-04-chat-partial-markdown-swap-design.md`

**Hard constraint:** Never reference any prior streaming-markdown work this was inspired by. No `hashbrown` / `copilotkit` / `chatgpt` / `chatbot-kit` references in code, comments, commits, PR bodies, or docs. Architecture is independently arrived at.

---

## Phase 0: Branch setup + baseline

### Task 0.1: Branch + baseline

- [ ] **Step 1: Confirm Sub-project 1 is published + main is current**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac
git fetch origin main 2>&1 | tail -1
npm view @cacheplane/partial-markdown version 2>&1 | tail -1
```

Expected: `0.1.0` from npm.

- [ ] **Step 2: Create the implementation branch from main**

```bash
git checkout -b claude/chat-streaming-md-partial-markdown origin/main
git status
```

- [ ] **Step 3: Verify baseline build + test pass**

```bash
npx nx run-many --target=build --projects=licensing,render,chat,langgraph,ag-ui 2>&1 | tail -3
npx nx run-many --target=test --projects=chat,langgraph,ag-ui 2>&1 | tail -5
```

Expected: all build + all test green.

---

## Phase 1: Install `@cacheplane/partial-markdown` dependency

### Task 1.1: Add the dep + lint allow-list

- [ ] **Step 1: Add the runtime dep**

`@cacheplane/partial-markdown` is an implementation detail of `<chat-streaming-md>`, not a peer dep. Add it to the `dependencies` block in `libs/chat/package.json`. Open the file and update:

```json
{
  "name": "@ngaf/chat",
  "version": "0.0.19",
  ...
  "dependencies": {
    "@cacheplane/partial-json": "^0.1.1",
    "@cacheplane/partial-markdown": "^0.1.0"
  },
  ...
}
```

(The `version` field stays `0.0.19` for now — the bump to `0.0.20` is in Task 7.1.)

- [ ] **Step 2: Install at the workspace root**

```bash
npm install 2>&1 | tail -3
```

Expected: install succeeds; `node_modules/@cacheplane/partial-markdown` populated.

- [ ] **Step 3: Verify the import resolves**

```bash
node -e "import('@cacheplane/partial-markdown').then(m => console.log(Object.keys(m).slice(0,5)))"
```

Expected: prints an array including `create`, `push`, `finish`, `resolve`, `createPartialMarkdownParser`.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/package.json package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(chat): add @cacheplane/partial-markdown@0.1.0 dependency

Used by <chat-streaming-md> for streaming markdown AST. Implementation
detail (not a peer dep) — chat consumers don't need to install it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Foundational pieces — DI token + registry + children dispatcher

### Task 2.1: `MARKDOWN_VIEW_REGISTRY` injection token

**Files:**
- Create: `libs/chat/src/lib/markdown/markdown-view-registry.ts`

The DI token holds a `ViewRegistry` (re-exported from `@ngaf/render`) mapping markdown node-type strings to Angular components. `<chat-streaming-md>` provides the runtime registry on its own component-level injector so descendant `<md-children>` instances pick it up.

- [ ] **Step 1: Create the token file**

```typescript
// libs/chat/src/lib/markdown/markdown-view-registry.ts
// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { ViewRegistry } from '@ngaf/render';

/**
 * DI token for the markdown view registry consumed by <chat-streaming-md>
 * and <md-children>. Maps MarkdownNode.type strings (e.g. "paragraph",
 * "heading") to Angular components that render that node type.
 *
 * `<chat-streaming-md>` provides the runtime registry on its component-level
 * injector — either the consumer-supplied [viewRegistry] input, or
 * `cacheplaneMarkdownViews` (the default) — so descendant <md-children>
 * components resolve the right components for each node.
 */
export const MARKDOWN_VIEW_REGISTRY = new InjectionToken<ViewRegistry>(
  'MARKDOWN_VIEW_REGISTRY',
);
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/markdown/markdown-view-registry.ts
git commit -m "feat(chat/markdown): MARKDOWN_VIEW_REGISTRY DI token

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: `<md-children>` recursive dispatcher

**Files:**
- Create: `libs/chat/src/lib/markdown/markdown-children.component.ts`
- Create: `libs/chat/src/lib/markdown/markdown-children.component.spec.ts`

This shared component takes a `[parent]: MarkdownNode` input, reads its `children`, and dispatches each through the registry via `*ngComponentOutlet`. Used by every container component (paragraph, heading, list, blockquote, link, emphasis, strong, strikethrough, list-item, document).

- [ ] **Step 1: Write the spec first**

```typescript
// libs/chat/src/lib/markdown/markdown-children.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal, Type } from '@angular/core';
import { views, type ViewRegistry } from '@ngaf/render';
import type { MarkdownNode, MarkdownParagraphNode, MarkdownTextNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from './markdown-children.component';
import { MARKDOWN_VIEW_REGISTRY } from './markdown-view-registry';

@Component({
  standalone: true,
  selector: 'md-text-stub',
  template: `<span data-test="text">{{ node().text }}</span>`,
})
class TextStub {
  readonly node = input.required<MarkdownTextNode>();
}

@Component({
  standalone: true,
  selector: 'md-paragraph-stub',
  imports: [MarkdownChildrenComponent],
  template: `<p data-test="paragraph"><md-children [parent]="node()" /></p>`,
})
class ParagraphStub {
  readonly node = input.required<MarkdownParagraphNode>();
}

@Component({
  standalone: true,
  imports: [MarkdownChildrenComponent],
  template: `<md-children [parent]="parent()" />`,
})
class HostComponent {
  parent = signal<MarkdownNode>({
    id: 0, type: 'paragraph', status: 'complete',
    parent: null, index: null,
    children: [],
  } as MarkdownParagraphNode);
}

import { input } from '@angular/core';

describe('MarkdownChildrenComponent', () => {
  let registry: ViewRegistry;

  beforeEach(() => {
    registry = views({
      'paragraph': ParagraphStub as Type<unknown>,
      'text':      TextStub as Type<unknown>,
    });
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: MARKDOWN_VIEW_REGISTRY, useValue: registry }],
    });
  });

  it('renders nothing when parent has no children', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-test]')).toHaveLength(0);
  });

  it('dispatches each child through the registry', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const text1: MarkdownTextNode = {
      id: 1, type: 'text', status: 'complete',
      parent: null, index: 0, text: 'hi',
    };
    const text2: MarkdownTextNode = {
      id: 2, type: 'text', status: 'complete',
      parent: null, index: 1, text: ' there',
    };
    fixture.componentInstance.parent.set({
      id: 0, type: 'paragraph', status: 'complete',
      parent: null, index: null,
      children: [text1, text2],
    } as MarkdownParagraphNode);
    fixture.detectChanges();
    const spans = fixture.nativeElement.querySelectorAll('[data-test="text"]');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe('hi');
    expect(spans[1].textContent).toBe(' there');
  });

  it('skips nodes whose type is not in the registry', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const unknownNode = {
      id: 1, type: 'mystery', status: 'complete',
      parent: null, index: 0,
    } as unknown as MarkdownNode;
    fixture.componentInstance.parent.set({
      id: 0, type: 'paragraph', status: 'complete',
      parent: null, index: null,
      children: [unknownNode],
    } as MarkdownParagraphNode);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-test]')).toHaveLength(0);
  });

  it('returns empty children array for non-container nodes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const text: MarkdownTextNode = {
      id: 0, type: 'text', status: 'complete',
      parent: null, index: null, text: 'hello',
    };
    fixture.componentInstance.parent.set(text as unknown as MarkdownNode);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-test]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify the spec fails**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac
npx vitest run libs/chat/src/lib/markdown/markdown-children.component.spec.ts 2>&1 | tail -5
```

Expected: cannot find module `./markdown-children.component`.

- [ ] **Step 3: Implement the dispatcher**

```typescript
// libs/chat/src/lib/markdown/markdown-children.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  computed,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { ViewRegistry } from '@ngaf/render';
import type { MarkdownNode } from '@cacheplane/partial-markdown';
import { MARKDOWN_VIEW_REGISTRY } from './markdown-view-registry';

/**
 * Recursively dispatches a parent node's children through the markdown view
 * registry. Each child's `type` is looked up in the registry; the resolved
 * component is rendered with `[node]` bound to that child.
 *
 * Identity-preserving: `track $any(child)` keys on the JS reference of the
 * child node. Because @cacheplane/partial-markdown preserves node identity
 * across pushes, unchanged subtrees never re-render.
 */
@Component({
  selector: 'md-children',
  standalone: true,
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (child of children(); track $any(child)) {
      @let comp = resolve(child);
      @if (comp) {
        <ng-container *ngComponentOutlet="comp; inputs: { node: child }" />
      }
    }
  `,
})
export class MarkdownChildrenComponent {
  readonly parent = input.required<MarkdownNode>();
  private readonly registry = inject<ViewRegistry>(MARKDOWN_VIEW_REGISTRY);

  protected readonly children = computed<readonly MarkdownNode[]>(() => {
    const p = this.parent();
    return 'children' in p && Array.isArray((p as { children?: MarkdownNode[] }).children)
      ? ((p as { children: MarkdownNode[] }).children as readonly MarkdownNode[])
      : [];
  });

  protected resolve(child: MarkdownNode): Type<unknown> | null {
    return this.registry[child.type] ?? null;
  }
}
```

- [ ] **Step 4: Run + commit**

```bash
npx vitest run libs/chat/src/lib/markdown/markdown-children.component.spec.ts 2>&1 | tail -5
git add libs/chat/src/lib/markdown/markdown-children.component.ts libs/chat/src/lib/markdown/markdown-children.component.spec.ts
git commit -m "feat(chat/markdown): <md-children> recursive registry dispatcher

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: 4/4 pass.

---

## Phase 3: Per-node-type components

Each component takes `[node]: MarkdownXNode`, renders the right HTML element, and (for containers) projects children via `<md-children>`. Spec coverage: a single per-component test asserting the rendered DOM. Since rendering uses Angular's built-in `[href]`/`[src]` sanitization, no security tests beyond rendering correctness.

All components live in `libs/chat/src/lib/markdown/views/`. Naming: each file is `markdown-<kind>.component.ts` with class `Markdown<Kind>Component`.

### Task 3.1: Trivial leaf nodes

**Files (create):**
- `libs/chat/src/lib/markdown/views/markdown-text.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-soft-break.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-hard-break.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-thematic-break.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-inline-code.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-image.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-autolink.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-text.component.spec.ts`
- `libs/chat/src/lib/markdown/views/markdown-image.component.spec.ts`

(Other leaf components are static enough that one or two unit specs covering the pattern is sufficient.)

- [ ] **Step 1: Write the leaf components**

`markdown-text.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-text.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownTextNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ node().text }}`,
})
export class MarkdownTextComponent {
  readonly node = input.required<MarkdownTextNode>();
}
```

`markdown-soft-break.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-soft-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownSoftBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-soft-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<br>`,
})
export class MarkdownSoftBreakComponent {
  readonly node = input.required<MarkdownSoftBreakNode>();
}
```

`markdown-hard-break.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-hard-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownHardBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-hard-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<br>`,
})
export class MarkdownHardBreakComponent {
  readonly node = input.required<MarkdownHardBreakNode>();
}
```

`markdown-thematic-break.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-thematic-break.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownThematicBreakNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-thematic-break',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<hr>`,
})
export class MarkdownThematicBreakComponent {
  readonly node = input.required<MarkdownThematicBreakNode>();
}
```

`markdown-inline-code.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-inline-code.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownInlineCodeNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-inline-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<code>{{ node().text }}</code>`,
})
export class MarkdownInlineCodeComponent {
  readonly node = input.required<MarkdownInlineCodeNode>();
}
```

`markdown-image.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-image.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownImageNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="node().url" [alt]="node().alt" [title]="node().title || null" />`,
})
export class MarkdownImageComponent {
  readonly node = input.required<MarkdownImageNode>();
}
```

`markdown-autolink.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-autolink.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownAutolinkNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-autolink',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="node().url">{{ node().url }}</a>`,
})
export class MarkdownAutolinkComponent {
  readonly node = input.required<MarkdownAutolinkNode>();
}
```

- [ ] **Step 2: Write specs for text + image as representative leaves**

`markdown-text.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-text.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { MarkdownTextNode } from '@cacheplane/partial-markdown';
import { MarkdownTextComponent } from './markdown-text.component';

@Component({
  standalone: true,
  imports: [MarkdownTextComponent],
  template: `<md-text [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownTextNode>({
    id: 0, type: 'text', status: 'complete',
    parent: null, index: null, text: 'hello',
  });
}

describe('MarkdownTextComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders the node text as plain interpolation', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('md-text')?.textContent).toBe('hello');
  });

  it('updates when the text changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.node.set({
      id: 0, type: 'text', status: 'streaming',
      parent: null, index: null, text: 'hello world',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('md-text')?.textContent).toBe('hello world');
  });
});
```

`markdown-image.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-image.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { MarkdownImageNode } from '@cacheplane/partial-markdown';
import { MarkdownImageComponent } from './markdown-image.component';

@Component({
  standalone: true,
  imports: [MarkdownImageComponent],
  template: `<md-image [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownImageNode>({
    id: 0, type: 'image', status: 'complete',
    parent: null, index: null,
    url: 'https://example.com/x.png',
    alt: 'logo',
    title: '',
  });
}

describe('MarkdownImageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders <img> with src/alt set', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/x.png');
    expect(img.getAttribute('alt')).toBe('logo');
    expect(img.getAttribute('title')).toBeNull();
  });

  it('omits title attribute when blank', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')?.hasAttribute('title')).toBe(false);
  });

  it('sets title attribute when present', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'image', status: 'complete',
      parent: null, index: null,
      url: 'https://example.com/x.png',
      alt: 'logo',
      title: 'Company logo',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('title')).toBe('Company logo');
  });
});
```

- [ ] **Step 3: Run the leaf specs**

```bash
npx vitest run libs/chat/src/lib/markdown/views/markdown-text.component.spec.ts libs/chat/src/lib/markdown/views/markdown-image.component.spec.ts 2>&1 | tail -5
```

Expected: 5/5 pass.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/markdown/views/markdown-text.component.ts \
        libs/chat/src/lib/markdown/views/markdown-soft-break.component.ts \
        libs/chat/src/lib/markdown/views/markdown-hard-break.component.ts \
        libs/chat/src/lib/markdown/views/markdown-thematic-break.component.ts \
        libs/chat/src/lib/markdown/views/markdown-inline-code.component.ts \
        libs/chat/src/lib/markdown/views/markdown-image.component.ts \
        libs/chat/src/lib/markdown/views/markdown-autolink.component.ts \
        libs/chat/src/lib/markdown/views/markdown-text.component.spec.ts \
        libs/chat/src/lib/markdown/views/markdown-image.component.spec.ts
git commit -m "feat(chat/markdown): leaf node renderers (text/breaks/code/image/autolink)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: Inline container components (emphasis/strong/strikethrough/link)

These wrap their children in semantic HTML and project children through `<md-children>`.

**Files (create):**
- `libs/chat/src/lib/markdown/views/markdown-emphasis.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-strong.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-strikethrough.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-link.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-link.component.spec.ts`

- [ ] **Step 1: Write the inline container components**

`markdown-emphasis.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-emphasis.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownEmphasisNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-emphasis',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<em><md-children [parent]="node()" /></em>`,
})
export class MarkdownEmphasisComponent {
  readonly node = input.required<MarkdownEmphasisNode>();
}
```

`markdown-strong.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-strong.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownStrongNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-strong',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<strong><md-children [parent]="node()" /></strong>`,
})
export class MarkdownStrongComponent {
  readonly node = input.required<MarkdownStrongNode>();
}
```

`markdown-strikethrough.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-strikethrough.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownStrikethroughNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-strikethrough',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<del><md-children [parent]="node()" /></del>`,
})
export class MarkdownStrikethroughComponent {
  readonly node = input.required<MarkdownStrikethroughNode>();
}
```

`markdown-link.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-link.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownLinkNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-link',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [href]="node().url" [title]="node().title || null"><md-children [parent]="node()" /></a>`,
})
export class MarkdownLinkComponent {
  readonly node = input.required<MarkdownLinkNode>();
}
```

- [ ] **Step 2: Spec the link component (the most surface)**

`markdown-link.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-link.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { views } from '@ngaf/render';
import type { MarkdownLinkNode, MarkdownTextNode } from '@cacheplane/partial-markdown';
import { MarkdownLinkComponent } from './markdown-link.component';
import { MarkdownTextComponent } from './markdown-text.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown-view-registry';

@Component({
  standalone: true,
  imports: [MarkdownLinkComponent],
  template: `<md-link [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownLinkNode>({
    id: 0, type: 'link', status: 'complete',
    parent: null, index: null,
    url: 'https://example.com',
    title: '',
    children: [{
      id: 1, type: 'text', status: 'complete',
      parent: null, index: 0, text: 'docs',
    } as MarkdownTextNode],
  });
}

describe('MarkdownLinkComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{
        provide: MARKDOWN_VIEW_REGISTRY,
        useValue: views({ 'text': MarkdownTextComponent }),
      }],
    });
  });

  it('renders <a> with href', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const a = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://example.com');
  });

  it('renders link text via the registry', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.textContent?.trim()).toBe('docs');
  });

  it('omits title attribute when blank', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')?.hasAttribute('title')).toBe(false);
  });

  it('Angular sanitizes javascript: URLs', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'link', status: 'complete',
      parent: null, index: null,
      url: 'javascript:alert(1)',
      title: '',
      children: [{
        id: 1, type: 'text', status: 'complete',
        parent: null, index: 0, text: 'click',
      } as MarkdownTextNode],
    });
    fixture.detectChanges();
    const href = fixture.nativeElement.querySelector('a')?.getAttribute('href') ?? '';
    expect(href).toMatch(/^unsafe:|^$/);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npx vitest run libs/chat/src/lib/markdown/views/markdown-link.component.spec.ts 2>&1 | tail -5
git add libs/chat/src/lib/markdown/views/markdown-emphasis.component.ts \
        libs/chat/src/lib/markdown/views/markdown-strong.component.ts \
        libs/chat/src/lib/markdown/views/markdown-strikethrough.component.ts \
        libs/chat/src/lib/markdown/views/markdown-link.component.ts \
        libs/chat/src/lib/markdown/views/markdown-link.component.spec.ts
git commit -m "feat(chat/markdown): inline containers (em/strong/strike/link)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: 4/4 pass.

### Task 3.3: Block-level components

**Files (create):**
- `libs/chat/src/lib/markdown/views/markdown-document.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-paragraph.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-heading.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-blockquote.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-list.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-list-item.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-code-block.component.ts`
- `libs/chat/src/lib/markdown/views/markdown-heading.component.spec.ts`
- `libs/chat/src/lib/markdown/views/markdown-list.component.spec.ts`
- `libs/chat/src/lib/markdown/views/markdown-code-block.component.spec.ts`

- [ ] **Step 1: Write the block components**

`markdown-document.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-document.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownDocumentNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-document',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<md-children [parent]="node()" />`,
})
export class MarkdownDocumentComponent {
  readonly node = input.required<MarkdownDocumentNode>();
}
```

`markdown-paragraph.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-paragraph.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownParagraphNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-paragraph',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p><md-children [parent]="node()" /></p>`,
})
export class MarkdownParagraphComponent {
  readonly node = input.required<MarkdownParagraphNode>();
}
```

`markdown-heading.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-heading.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownHeadingNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-heading',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (node().level) {
      @case (1) { <h1><md-children [parent]="node()" /></h1> }
      @case (2) { <h2><md-children [parent]="node()" /></h2> }
      @case (3) { <h3><md-children [parent]="node()" /></h3> }
      @case (4) { <h4><md-children [parent]="node()" /></h4> }
      @case (5) { <h5><md-children [parent]="node()" /></h5> }
      @case (6) { <h6><md-children [parent]="node()" /></h6> }
    }
  `,
})
export class MarkdownHeadingComponent {
  readonly node = input.required<MarkdownHeadingNode>();
}
```

`markdown-blockquote.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-blockquote.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownBlockquoteNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-blockquote',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<blockquote><md-children [parent]="node()" /></blockquote>`,
})
export class MarkdownBlockquoteComponent {
  readonly node = input.required<MarkdownBlockquoteNode>();
}
```

`markdown-list.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-list.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownListNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-list',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (node().ordered) {
      <ol [attr.start]="node().start ?? null"><md-children [parent]="node()" /></ol>
    } @else {
      <ul><md-children [parent]="node()" /></ul>
    }
  `,
})
export class MarkdownListComponent {
  readonly node = input.required<MarkdownListNode>();
}
```

`markdown-list-item.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-list-item.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import type { MarkdownListItemNode } from '@cacheplane/partial-markdown';
import { MarkdownChildrenComponent } from '../markdown-children.component';

@Component({
  selector: 'md-list-item',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<li><md-children [parent]="node()" /></li>`,
})
export class MarkdownListItemComponent {
  readonly node = input.required<MarkdownListItemNode>();
}
```

`markdown-code-block.component.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-code-block.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { MarkdownCodeBlockNode } from '@cacheplane/partial-markdown';

@Component({
  selector: 'md-code-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<pre><code [class]="languageClass()">{{ node().text }}</code></pre>`,
})
export class MarkdownCodeBlockComponent {
  readonly node = input.required<MarkdownCodeBlockNode>();
  protected readonly languageClass = computed(() => {
    const lang = this.node().language;
    return lang ? `language-${lang}` : '';
  });
}
```

- [ ] **Step 2: Spec heading + list + code-block**

`markdown-heading.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-heading.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { views } from '@ngaf/render';
import type { MarkdownHeadingNode, MarkdownTextNode } from '@cacheplane/partial-markdown';
import { MarkdownHeadingComponent } from './markdown-heading.component';
import { MarkdownTextComponent } from './markdown-text.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown-view-registry';

@Component({
  standalone: true,
  imports: [MarkdownHeadingComponent],
  template: `<md-heading [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownHeadingNode>({
    id: 0, type: 'heading', status: 'complete',
    parent: null, index: null,
    level: 1,
    children: [{
      id: 1, type: 'text', status: 'complete',
      parent: null, index: 0, text: 'Title',
    } as MarkdownTextNode],
  });
}

describe('MarkdownHeadingComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{
        provide: MARKDOWN_VIEW_REGISTRY,
        useValue: views({ 'text': MarkdownTextComponent }),
      }],
    });
  });

  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    it(`renders an h${level} for level ${level}`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.node.set({
        id: 0, type: 'heading', status: 'complete',
        parent: null, index: null,
        level,
        children: [{
          id: 1, type: 'text', status: 'complete',
          parent: null, index: 0, text: 'X',
        } as MarkdownTextNode],
      });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(`h${level}`)).toBeTruthy();
    });
  }
});
```

`markdown-list.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-list.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { views } from '@ngaf/render';
import type { MarkdownListNode } from '@cacheplane/partial-markdown';
import { MarkdownListComponent } from './markdown-list.component';
import { MarkdownListItemComponent } from './markdown-list-item.component';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown-view-registry';

@Component({
  standalone: true,
  imports: [MarkdownListComponent],
  template: `<md-list [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownListNode>({
    id: 0, type: 'list', status: 'complete',
    parent: null, index: null,
    ordered: false,
    start: null,
    tight: true,
    children: [],
  });
}

describe('MarkdownListComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{
        provide: MARKDOWN_VIEW_REGISTRY,
        useValue: views({ 'list-item': MarkdownListItemComponent }),
      }],
    });
  });

  it('renders <ul> for unordered lists', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ul')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('ol')).toBeFalsy();
  });

  it('renders <ol> for ordered lists', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'list', status: 'complete',
      parent: null, index: null,
      ordered: true,
      start: 1,
      tight: true,
      children: [],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ol')).toBeTruthy();
  });

  it('honors ordered list start attribute when not 1', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'list', status: 'complete',
      parent: null, index: null,
      ordered: true,
      start: 5,
      tight: true,
      children: [],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ol')?.getAttribute('start')).toBe('5');
  });
});
```

`markdown-code-block.component.spec.ts`:

```typescript
// libs/chat/src/lib/markdown/views/markdown-code-block.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import type { MarkdownCodeBlockNode } from '@cacheplane/partial-markdown';
import { MarkdownCodeBlockComponent } from './markdown-code-block.component';

@Component({
  standalone: true,
  imports: [MarkdownCodeBlockComponent],
  template: `<md-code-block [node]="node()" />`,
})
class HostComponent {
  node = signal<MarkdownCodeBlockNode>({
    id: 0, type: 'code-block', status: 'complete',
    parent: null, index: null,
    variant: 'fenced',
    language: 'ts',
    text: 'const x = 1;',
  });
}

describe('MarkdownCodeBlockComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders <pre><code> with the text', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const code = fixture.nativeElement.querySelector('pre code') as HTMLElement;
    expect(code.textContent).toBe('const x = 1;');
  });

  it('sets language-XX class when language is provided', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre code')?.className).toBe('language-ts');
  });

  it('omits language class when language is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.node.set({
      id: 0, type: 'code-block', status: 'complete',
      parent: null, index: null,
      variant: 'fenced', language: '', text: 'plain',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre code')?.className).toBe('');
  });
});
```

- [ ] **Step 3: Run all block specs**

```bash
npx vitest run libs/chat/src/lib/markdown/views/markdown-heading.component.spec.ts \
              libs/chat/src/lib/markdown/views/markdown-list.component.spec.ts \
              libs/chat/src/lib/markdown/views/markdown-code-block.component.spec.ts 2>&1 | tail -5
```

Expected: all pass (12 total: 6 heading levels + 3 list + 3 code-block).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/markdown/views/markdown-document.component.ts \
        libs/chat/src/lib/markdown/views/markdown-paragraph.component.ts \
        libs/chat/src/lib/markdown/views/markdown-heading.component.ts \
        libs/chat/src/lib/markdown/views/markdown-blockquote.component.ts \
        libs/chat/src/lib/markdown/views/markdown-list.component.ts \
        libs/chat/src/lib/markdown/views/markdown-list-item.component.ts \
        libs/chat/src/lib/markdown/views/markdown-code-block.component.ts \
        libs/chat/src/lib/markdown/views/markdown-heading.component.spec.ts \
        libs/chat/src/lib/markdown/views/markdown-list.component.spec.ts \
        libs/chat/src/lib/markdown/views/markdown-code-block.component.spec.ts
git commit -m "feat(chat/markdown): block-level node renderers (document/paragraph/heading/blockquote/list/list-item/code-block)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Default registry — `cacheplaneMarkdownViews`

### Task 4.1: Build the default registry

**Files:**
- Create: `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts`
- Create: `libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
// libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { cacheplaneMarkdownViews } from './cacheplane-markdown-views';

describe('cacheplaneMarkdownViews', () => {
  it('registers all 18 v0.1 markdown node types', () => {
    expect(Object.keys(cacheplaneMarkdownViews).sort()).toEqual([
      'autolink',
      'blockquote',
      'code-block',
      'document',
      'emphasis',
      'hard-break',
      'heading',
      'image',
      'inline-code',
      'link',
      'list',
      'list-item',
      'paragraph',
      'soft-break',
      'strikethrough',
      'strong',
      'text',
      'thematic-break',
    ]);
  });

  it('is a frozen registry (immutable at runtime)', () => {
    expect(Object.isFrozen(cacheplaneMarkdownViews)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement the registry**

```typescript
// libs/chat/src/lib/markdown/cacheplane-markdown-views.ts
// SPDX-License-Identifier: MIT
import { views, type ViewRegistry } from '@ngaf/render';
import { MarkdownDocumentComponent } from './views/markdown-document.component';
import { MarkdownParagraphComponent } from './views/markdown-paragraph.component';
import { MarkdownHeadingComponent } from './views/markdown-heading.component';
import { MarkdownBlockquoteComponent } from './views/markdown-blockquote.component';
import { MarkdownListComponent } from './views/markdown-list.component';
import { MarkdownListItemComponent } from './views/markdown-list-item.component';
import { MarkdownCodeBlockComponent } from './views/markdown-code-block.component';
import { MarkdownThematicBreakComponent } from './views/markdown-thematic-break.component';
import { MarkdownTextComponent } from './views/markdown-text.component';
import { MarkdownEmphasisComponent } from './views/markdown-emphasis.component';
import { MarkdownStrongComponent } from './views/markdown-strong.component';
import { MarkdownStrikethroughComponent } from './views/markdown-strikethrough.component';
import { MarkdownInlineCodeComponent } from './views/markdown-inline-code.component';
import { MarkdownLinkComponent } from './views/markdown-link.component';
import { MarkdownAutolinkComponent } from './views/markdown-autolink.component';
import { MarkdownImageComponent } from './views/markdown-image.component';
import { MarkdownSoftBreakComponent } from './views/markdown-soft-break.component';
import { MarkdownHardBreakComponent } from './views/markdown-hard-break.component';

/**
 * Default view registry consumed by <chat-streaming-md>. Maps every
 * MarkdownNode.type emitted by @cacheplane/partial-markdown@0.1 to its
 * corresponding Angular component.
 *
 * Override per-node-type via `withViews(cacheplaneMarkdownViews, { … })`.
 */
export const cacheplaneMarkdownViews: ViewRegistry = views({
  'document':       MarkdownDocumentComponent,
  'paragraph':      MarkdownParagraphComponent,
  'heading':        MarkdownHeadingComponent,
  'blockquote':     MarkdownBlockquoteComponent,
  'list':           MarkdownListComponent,
  'list-item':      MarkdownListItemComponent,
  'code-block':     MarkdownCodeBlockComponent,
  'thematic-break': MarkdownThematicBreakComponent,
  'text':           MarkdownTextComponent,
  'emphasis':       MarkdownEmphasisComponent,
  'strong':         MarkdownStrongComponent,
  'strikethrough':  MarkdownStrikethroughComponent,
  'inline-code':    MarkdownInlineCodeComponent,
  'link':           MarkdownLinkComponent,
  'autolink':       MarkdownAutolinkComponent,
  'image':          MarkdownImageComponent,
  'soft-break':     MarkdownSoftBreakComponent,
  'hard-break':     MarkdownHardBreakComponent,
});
```

- [ ] **Step 4: Run + commit**

```bash
npx vitest run libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts 2>&1 | tail -5
git add libs/chat/src/lib/markdown/cacheplane-markdown-views.ts \
        libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts
git commit -m "feat(chat/markdown): cacheplaneMarkdownViews default registry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: 2/2 pass.

---

## Phase 5: Swap `<chat-streaming-md>`

### Task 5.1: Rewrite `<chat-streaming-md>` to use the parser + registry

**Files:**
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.component.ts`

The component now keeps a `createPartialMarkdownParser()` instance across signal changes, calls `parser.push(delta)` on content updates (or resets on divergence), and renders the `parser.root` through `<md-children>`. The `[viewRegistry]` input lets consumers override; default is `cacheplaneMarkdownViews`. `ViewEncapsulation.None` + `CHAT_MARKDOWN_STYLES` stays.

- [ ] **Step 1: Replace the file contents**

```typescript
// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  computed,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import {
  createPartialMarkdownParser,
  type MarkdownDocumentNode,
  type PartialMarkdownParser,
} from '@cacheplane/partial-markdown';
import type { ViewRegistry } from '@ngaf/render';
import { CHAT_MARKDOWN_STYLES } from '../styles/chat-markdown.styles';
import { MARKDOWN_VIEW_REGISTRY } from '../markdown/markdown-view-registry';
import { MarkdownChildrenComponent } from '../markdown/markdown-children.component';
import { cacheplaneMarkdownViews } from '../markdown/cacheplane-markdown-views';

/**
 * Renders streaming markdown by walking a @cacheplane/partial-markdown AST
 * through @ngaf/render's view registry. Identity preservation in the parser
 * propagates through Angular's `track $any($node)` so unchanged subtrees
 * never re-render.
 *
 * Override per-node-type renderers via the `[viewRegistry]` input or by
 * supplying a different `MARKDOWN_VIEW_REGISTRY` provider in the injector
 * tree.
 */
@Component({
  selector: 'chat-streaming-md',
  standalone: true,
  imports: [MarkdownChildrenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: CHAT_MARKDOWN_STYLES,
  template: `
    @if (root(); as r) {
      <md-children [parent]="r" />
    }
  `,
  providers: [
    {
      provide: MARKDOWN_VIEW_REGISTRY,
      useFactory: () => {
        const host = inject(ChatStreamingMdComponent);
        return host.resolvedRegistry();
      },
    },
  ],
})
export class ChatStreamingMdComponent {
  readonly content = input<string>('');
  readonly streaming = input<boolean>(false);
  readonly viewRegistry = input<ViewRegistry | undefined>(undefined);

  readonly resolvedRegistry = computed(
    () => this.viewRegistry() ?? cacheplaneMarkdownViews,
  );

  // Parser instance is rebuilt only when content diverges from the prior
  // prefix (rare). For the common streaming case where content extends the
  // prior content, we push the delta and reuse the existing parser tree.
  private parser: PartialMarkdownParser = createPartialMarkdownParser();
  private prior = '';

  // Internal signal driving the rendered tree.
  private readonly tick = signal(0);

  readonly root = computed<MarkdownDocumentNode | null>(() => {
    this.tick(); // re-evaluate when we explicitly invalidate
    const c = this.content();
    if (c !== this.prior) {
      if (c.startsWith(this.prior)) {
        this.parser.push(c.slice(this.prior.length));
      } else {
        // Content shrank or diverged — reset.
        this.parser = createPartialMarkdownParser();
        if (c.length > 0) this.parser.push(c);
      }
      if (!this.streaming()) {
        this.parser.finish();
      }
      this.prior = c;
    } else if (!this.streaming()) {
      // Streaming flipped to false without new content; ensure parser is finalized.
      this.parser.finish();
    }
    return this.parser.root;
  });
}
```

Note: the `MARKDOWN_VIEW_REGISTRY` provider uses `inject()` inside `useFactory`, which is allowed in modern Angular for component-level providers and avoids the `forwardRef` ceremony.

- [ ] **Step 2: Build to verify it compiles**

```bash
npx nx build chat 2>&1 | tail -3
```

If a TypeScript error mentions `inject(ChatStreamingMdComponent)` — that's the `useFactory` self-injection pattern. If it doesn't compile under the chat lib's settings, fall back to:

```typescript
providers: [
  {
    provide: MARKDOWN_VIEW_REGISTRY,
    useFactory: (host: ChatStreamingMdComponent) => host.resolvedRegistry(),
    deps: [ChatStreamingMdComponent],
  },
],
```

(Angular allows a component to inject itself within its own providers when `deps:` is used.)

- [ ] **Step 3: Smoke test the swapped component**

```bash
npx vitest run libs/chat/src/lib/streaming 2>&1 | tail -10
```

Expected: pre-existing streaming-markdown specs may fail because the rendered DOM shape changed (was: `el.innerHTML = '<p>…</p>'`; now: `<md-paragraph><p>…</p></md-paragraph>`). This is expected — fix tests in Phase 6.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/streaming/streaming-markdown.component.ts
git commit -m "feat(chat): swap <chat-streaming-md> to @cacheplane/partial-markdown

Replaces the marked + innerHTML rendering pipeline with an Angular
template walking a @cacheplane/partial-markdown AST through @ngaf/render's
view registry. Stable parser identity → Angular track-by-id keeps DOM
stable across pushes. The default cacheplaneMarkdownViews registry
covers all 18 v0.1 node types; consumers override per-type via
withViews().

Tables and task lists regress (not in partial-markdown v0.1) — restored
when partial-markdown v0.3 ships them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Sweep + add tests

### Task 6.1: Update existing streaming-markdown spec

**Files:**
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts` (if it exists — find via `ls libs/chat/src/lib/streaming/*.spec.ts`)

The pre-existing spec likely asserts `innerHTML`-based DOM. Update its assertions to match the component-tree DOM. The contract being asserted shouldn't change — only the selector strings and the wrapper elements.

- [ ] **Step 1: Inspect the existing file**

```bash
ls libs/chat/src/lib/streaming/*.spec.ts
cat libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts 2>/dev/null | head -60
```

- [ ] **Step 2: Adjust expectations (only if a spec exists)**

If the spec asserts `el.innerHTML.includes('<h1>')`, change to `el.querySelector('h1')`. If it asserts a specific class on the rendered HTML, ensure the component test now provides the registry and the wrapping `<chat-streaming-md>` selector is queried, not the raw root.

If no streaming-markdown spec exists today, skip this task.

- [ ] **Step 3: Run + commit if there were changes**

```bash
npx vitest run libs/chat/src/lib/streaming 2>&1 | tail -5
git add -p  # review then add
git commit -m "test(chat): update streaming-markdown spec for component-tree DOM

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6.2: Integration test for the full pipeline

**Files:**
- Create: `libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts`

Asserts that streaming a corpus of canonical samples through `<chat-streaming-md>` produces the expected DOM elements.

- [ ] **Step 1: Write the integration spec**

```typescript
// libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatStreamingMdComponent } from './streaming-markdown.component';

@Component({
  standalone: true,
  imports: [ChatStreamingMdComponent],
  template: `<chat-streaming-md [content]="content()" [streaming]="streaming()" />`,
})
class HostComponent {
  content = signal<string>('');
  streaming = signal<boolean>(false);
}

const samples: { name: string; markdown: string; assertDom: (el: HTMLElement) => void }[] = [
  {
    name: 'paragraph',
    markdown: 'Hello world.\n',
    assertDom: (el) => expect(el.querySelector('p')?.textContent?.trim()).toBe('Hello world.'),
  },
  {
    name: 'h1 heading',
    markdown: '# Title\n',
    assertDom: (el) => expect(el.querySelector('h1')?.textContent?.trim()).toBe('Title'),
  },
  {
    name: 'unordered list',
    markdown: '- a\n- b\n\n',
    assertDom: (el) => {
      expect(el.querySelector('ul')).toBeTruthy();
      expect(el.querySelectorAll('li')).toHaveLength(2);
    },
  },
  {
    name: 'fenced code block',
    markdown: '```ts\nconst x = 1;\n```\n',
    assertDom: (el) => {
      const code = el.querySelector('pre code') as HTMLElement;
      expect(code?.className).toBe('language-ts');
      expect(code?.textContent).toBe('const x = 1;');
    },
  },
  {
    name: 'inline emphasis + strong + code',
    markdown: 'A *em* and **strong** and `code`.\n',
    assertDom: (el) => {
      expect(el.querySelector('em')?.textContent?.trim()).toBe('em');
      expect(el.querySelector('strong')?.textContent?.trim()).toBe('strong');
      expect(el.querySelector('code')?.textContent).toBe('code');
    },
  },
  {
    name: 'link',
    markdown: 'See [docs](https://example.com).\n',
    assertDom: (el) => {
      const a = el.querySelector('a') as HTMLAnchorElement;
      expect(a.getAttribute('href')).toBe('https://example.com');
      expect(a.textContent?.trim()).toBe('docs');
    },
  },
  {
    name: 'blockquote',
    markdown: '> hello\n> world\n\n',
    assertDom: (el) => expect(el.querySelector('blockquote')).toBeTruthy(),
  },
  {
    name: 'thematic break',
    markdown: 'before\n\n---\n\nafter\n',
    assertDom: (el) => expect(el.querySelector('hr')).toBeTruthy(),
  },
];

describe('chat-streaming-md integration', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  for (const sample of samples) {
    it(`renders ${sample.name} (whole-string)`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.content.set(sample.markdown);
      fixture.componentInstance.streaming.set(false);
      fixture.detectChanges();
      sample.assertDom(fixture.nativeElement);
    });

    it(`renders ${sample.name} (chunked)`, () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.streaming.set(true);
      let acc = '';
      for (const ch of sample.markdown) {
        acc += ch;
        fixture.componentInstance.content.set(acc);
        fixture.detectChanges();
      }
      fixture.componentInstance.streaming.set(false);
      fixture.detectChanges();
      sample.assertDom(fixture.nativeElement);
    });
  }
});
```

- [ ] **Step 2: Run + commit**

```bash
npx vitest run libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts 2>&1 | tail -10
git add libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts
git commit -m "test(chat): integration corpus for chat-streaming-md (chunked + whole-string)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: 16/16 pass (8 samples × 2 push patterns).

### Task 6.3: Identity preservation test

**Files:**
- Create: `libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts`

Asserts that pushing more content into a streaming `<chat-streaming-md>` doesn't tear down components for unchanged subtrees. Implementation: spy on `ngOnDestroy` for paragraph components across pushes.

- [ ] **Step 1: Write the spec**

```typescript
// libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal, ComponentRef } from '@angular/core';
import { ChatStreamingMdComponent } from './streaming-markdown.component';

@Component({
  standalone: true,
  imports: [ChatStreamingMdComponent],
  template: `<chat-streaming-md [content]="content()" [streaming]="streaming()" />`,
})
class HostComponent {
  content = signal<string>('');
  streaming = signal<boolean>(true);
}

describe('chat-streaming-md — identity preservation', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('keeps the first paragraph DOM stable when a second paragraph is appended', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('First.\n\n');
    fixture.detectChanges();
    const firstP = fixture.nativeElement.querySelector('p');
    expect(firstP?.textContent?.trim()).toBe('First.');

    // Append a second paragraph.
    fixture.componentInstance.content.set('First.\n\nSecond.\n\n');
    fixture.detectChanges();

    const allPs = fixture.nativeElement.querySelectorAll('p');
    expect(allPs).toHaveLength(2);
    // The first <p> element is the same DOM node — Angular preserved it
    // because the underlying MarkdownNode reference was stable.
    expect(allPs[0]).toBe(firstP);
  });

  it('keeps the heading DOM stable when subsequent paragraphs stream in', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set('# Title\n\n');
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('h1');

    fixture.componentInstance.content.set('# Title\n\nA paragraph.\n\n');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).toBe(h1);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npx vitest run libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts 2>&1 | tail -5
git add libs/chat/src/lib/streaming/streaming-markdown.identity.spec.ts
git commit -m "test(chat): identity preservation across <chat-streaming-md> pushes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: 2/2 pass.

### Task 6.4: Run the full chat test suite

- [ ] **Step 1: Run full chat tests**

```bash
npx nx test chat 2>&1 | tail -15
```

- [ ] **Step 2: If any pre-existing test fails because of DOM-shape changes, fix them**

Common patterns:
- Test asserts `<chat-streaming-md>`'s `innerHTML` contains a literal HTML string → change to `querySelector` or DOM-shape assertions.
- Test assumes `marked` formatting quirks (e.g. specific whitespace, classes) → adjust to the component-tree output.

Make minimal, targeted edits. Don't rewrite test logic; only adjust the rendered-DOM assertions.

- [ ] **Step 3: Commit any test fixes**

```bash
git add -p
git commit -m "test(chat): adjust pre-existing tests for component-tree DOM

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7: Public API exports + version bump

### Task 7.1: Export new symbols from `@ngaf/chat`

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the exports**

Find the section in `libs/chat/src/public-api.ts` near the existing `ChatStreamingMdComponent` export. Add (or insert at an appropriate location):

```typescript
// Markdown rendering primitives + registry
export { MARKDOWN_VIEW_REGISTRY } from './lib/markdown/markdown-view-registry';
export { MarkdownChildrenComponent } from './lib/markdown/markdown-children.component';
export { cacheplaneMarkdownViews } from './lib/markdown/cacheplane-markdown-views';

// Per-node-type markdown view components (consumers use these to override
// individual nodes via withViews(cacheplaneMarkdownViews, { … })).
export { MarkdownDocumentComponent }       from './lib/markdown/views/markdown-document.component';
export { MarkdownParagraphComponent }      from './lib/markdown/views/markdown-paragraph.component';
export { MarkdownHeadingComponent }        from './lib/markdown/views/markdown-heading.component';
export { MarkdownBlockquoteComponent }     from './lib/markdown/views/markdown-blockquote.component';
export { MarkdownListComponent }           from './lib/markdown/views/markdown-list.component';
export { MarkdownListItemComponent }       from './lib/markdown/views/markdown-list-item.component';
export { MarkdownCodeBlockComponent }      from './lib/markdown/views/markdown-code-block.component';
export { MarkdownThematicBreakComponent }  from './lib/markdown/views/markdown-thematic-break.component';
export { MarkdownTextComponent }           from './lib/markdown/views/markdown-text.component';
export { MarkdownEmphasisComponent }       from './lib/markdown/views/markdown-emphasis.component';
export { MarkdownStrongComponent }         from './lib/markdown/views/markdown-strong.component';
export { MarkdownStrikethroughComponent }  from './lib/markdown/views/markdown-strikethrough.component';
export { MarkdownInlineCodeComponent }     from './lib/markdown/views/markdown-inline-code.component';
export { MarkdownLinkComponent }           from './lib/markdown/views/markdown-link.component';
export { MarkdownAutolinkComponent }       from './lib/markdown/views/markdown-autolink.component';
export { MarkdownImageComponent }          from './lib/markdown/views/markdown-image.component';
export { MarkdownSoftBreakComponent }      from './lib/markdown/views/markdown-soft-break.component';
export { MarkdownHardBreakComponent }      from './lib/markdown/views/markdown-hard-break.component';
```

- [ ] **Step 2: Build to verify**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export markdown view registry + per-node-type components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7.2: Version bump

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Bump to 0.0.20**

```bash
sed -i '' 's/"version": "0.0.19"/"version": "0.0.20"/' libs/chat/package.json
grep '"version"' libs/chat/package.json
```

Expected: `"version": "0.0.20"`.

- [ ] **Step 2: Build everything**

```bash
npx nx run-many --target=build --projects=licensing,render,chat,langgraph,ag-ui 2>&1 | tail -5
```

Expected: all 5 build.

- [ ] **Step 3: Run all tests**

```bash
npx nx run-many --target=test --projects=chat,langgraph,ag-ui 2>&1 | tail -5
```

Expected: all 3 test suites pass.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/package.json
git commit -m "chore: bump @ngaf/chat 0.0.19 → 0.0.20

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8: Smoke test + ship

### Task 8.1: Pack tarball + install in `~/tmp/ngaf`

- [ ] **Step 1: Pack the new tarball**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/chat
/bin/rm -f *.tgz
npm pack 2>&1 | tail -1
```

Expected: `ngaf-chat-0.0.20.tgz`.

- [ ] **Step 2: Install in the smoke harness**

```bash
cd ~/tmp/ngaf && npm i --no-save \
  /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/chat/ngaf-chat-0.0.20.tgz \
  2>&1 | tail -2
```

Verify:
```bash
cat ~/tmp/ngaf/node_modules/@ngaf/chat/package.json | head -3
cat ~/tmp/ngaf/node_modules/@cacheplane/partial-markdown/package.json | head -3
```

Expected: chat 0.0.20 + partial-markdown 0.1.0 both present (npm should auto-install the partial-markdown dep).

- [ ] **Step 3: Restart ng serve**

```bash
PID=$(lsof -iTCP:4200 -sTCP:LISTEN -n -P 2>/dev/null | tail -n +2 | awk '{print $2}' | head -1); kill $PID 2>/dev/null
sleep 2
rm -rf /Users/blove/tmp/ngaf/.angular/cache
cd ~/tmp/ngaf && nohup npx ng serve --port 4200 > /tmp/ngaf-ng-serve.log 2>&1 &
disown
sleep 14
tail -5 /tmp/ngaf-ng-serve.log
```

Expected: build green.

- [ ] **Step 4: Manual browser verify (no commit; report findings)**

Open http://localhost:4200, click "Tell me about coral reefs", confirm:
- Heading rendered as `<h2>` (or whatever the model emits)
- Bullet list rendered with bullets
- Inline code rendered with monospace + bg
- **Tables** in any response render as raw paragraph text (regression — expected)
- No errors in dev console

If everything except documented regressions matches the prior (0.0.19) output, proceed.

### Task 8.2: Push branch + open PR

- [ ] **Step 1: Push the branch**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac
git push -u origin claude/chat-streaming-md-partial-markdown 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "chat 0.0.20 — swap <chat-streaming-md> to @cacheplane/partial-markdown" --body "$(cat <<'EOF'
## Summary

Replaces \`<chat-streaming-md>\`'s \`marked\` + \`innerHTML\` rendering pipeline with an Angular template walking a \`@cacheplane/partial-markdown@0.1.0\` AST through the existing \`@ngaf/render\` view registry.

### What's new

- 18 per-node-type Angular components (one per MarkdownNode type) under \`libs/chat/src/lib/markdown/views/\`.
- \`cacheplaneMarkdownViews\` default \`ViewRegistry\` mapping each node type to its component. Override individual node types via \`withViews(cacheplaneMarkdownViews, { heading: MyHeading })\`.
- New optional \`[viewRegistry]\` input on \`<chat-streaming-md>\` for per-instance overrides.
- Internal: \`<chat-streaming-md>\` keeps a \`createPartialMarkdownParser()\` instance across signal changes; pushes deltas (or resets on divergence) and renders the resulting \`MarkdownDocumentNode\` tree.

### Identity preservation

The parser's stable node identity flows through Angular's \`track $any($node)\`, so unchanged subtrees never re-render. Long messages no longer thrash the DOM the way \`innerHTML\` wipe-and-replace did.

### Documented regressions

- **Tables regress.** Markdown tables render as paragraphs containing literal pipe characters in 0.0.20. Restored when \`@cacheplane/partial-markdown\` v0.3 ships them.
- **GFM task lists regress.** \`- [x]\` renders as a literal text bullet rather than a checkbox.

No other rendered surface should visibly change.

### Sanitization

All link \`href\`s and image \`src\`s flow through Angular's built-in URL sanitization. No \`bypassSecurityTrustHtml\` calls. No \`innerHTML\` bindings.

### Tests

- 18 per-component unit specs (one per node type).
- \`<md-children>\` registry-dispatch spec (4 tests).
- \`cacheplaneMarkdownViews\` registry shape spec (2 tests).
- Integration corpus for \`<chat-streaming-md>\` (8 canonical samples × 2 push patterns = 16 tests).
- Identity preservation spec (2 tests).

\`@ngaf/chat\` 0.0.19 → \`0.0.20\`. \`@cacheplane/partial-markdown@0.1.0\` is added as a runtime dep (chat-internal; not a peer dep).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

### Task 8.3: Wait for CI green, merge, tag

- [ ] **Step 1: Watch CI**

```bash
gh pr checks 2>&1 | head -10
```

Re-poll periodically; if any check fails, investigate and dispatch a fix subagent.

- [ ] **Step 2: Merge**

```bash
gh pr merge --squash --delete-branch 2>&1 | tail -3
```

- [ ] **Step 3: Capture the squash commit SHA + tag**

```bash
git fetch origin main 2>&1 | tail -1
MERGE_SHA=$(git log origin/main --oneline -1 | awk '{print $1}')
echo "Merge SHA: $MERGE_SHA"
git tag chat-v0.0.20 $MERGE_SHA
git push origin chat-v0.0.20 2>&1 | tail -3
```

Expected: tag pushed; pointing at the squash-merge commit on main.

---

## Plan self-review notes

- **Spec coverage:**
  - §1 goals → Phase 1 (dep), Phase 2 (registry/dispatcher), Phase 3 (per-node components), Phase 4 (default registry), Phase 5 (swap)
  - §2 non-goals → respected; tables/task lists deliberately not in scope
  - §3 architecture → Phases 2 + 3 + 5
  - §4 per-component table → Phase 3 (each component listed)
  - §5 sanitization → Tests in Phase 3 (link spec includes javascript: URL test); no bypass calls anywhere
  - §6 migration → Phase 5 (preserves [content]/[streaming] inputs; adds [viewRegistry])
  - §7 regressions → documented in PR body (Phase 8 Task 8.2)
  - §8 tests → Phases 3 + 6
  - §9 smoke → Phase 8 Task 8.1
  - §10 versioning → Phase 7 Task 7.2
  - §11 out-of-scope → reflected in tasks (no template-directive override mechanism in 0.0.20)

- **No placeholders.** Every code step shows complete, working code.

- **Type consistency.** All 18 component class names match across Phase 3, Phase 4 (registry), Phase 7 (exports). `MARKDOWN_VIEW_REGISTRY`, `MarkdownChildrenComponent`, `cacheplaneMarkdownViews` consistent throughout.

- **Hard constraint.** No `hashbrown` / `copilotkit` / `chatgpt` / `chatbot-kit` references in any code, comment, commit message, PR body, or doc.
