# `@ngaf/chat@0.0.21` — Citations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Render citations inline (numbered markers) and as a sources panel under each assistant message; populate via langgraph + ag-ui adapters.

**Architecture:** `Message.citations?: Citation[]` populated by adapters. `<chat-citations>` primitive renders the panel; `MarkdownCitationReferenceComponent` renders inline markers via the markdown view registry. `CitationsResolverService` merges Message + markdown sidecar with message-first precedence.

**Tech Stack:** Angular 21 standalone components, signals, `*ngComponentOutlet`, `@cacheplane/partial-markdown@^0.2.0`, vitest + @analogjs/vite-plugin-angular.

**Spec:** `docs/superpowers/specs/2026-05-04-chat-citations-design.md`

**Working repo:** `/Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac`
**Implementation branch:** `claude/chat-citations-0.0.21` (already created from `origin/main`)

---

## File Map

**Create:**
- `libs/chat/src/lib/agent/citation.ts` — Citation interface
- `libs/chat/src/lib/markdown/citations-resolver.service.ts` — CitationsResolverService + helpers
- `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts` + `.spec.ts`
- `libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts` + `.spec.ts`
- `libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts`
- `libs/chat/src/lib/primitives/chat-citations/index.ts` (barrel)
- `libs/langgraph/src/lib/internals/extract-citations.ts` + `.spec.ts`
- `libs/ag-ui/src/lib/bridge-citations-state.ts` + `.spec.ts`

**Modify:**
- `libs/chat/src/lib/agent/message.ts` — add `citations?` field
- `libs/chat/src/lib/index.ts` — export Citation, CitationsResolverService, ChatCitationsComponent
- `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts` — register `'citation-reference'` → `MarkdownCitationReferenceComponent`
- `libs/chat/src/lib/streaming/streaming-markdown.component.ts` — feed resolver markdownDefs from `doc.citations`
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts` — render `<chat-citations>` for assistant messages
- `libs/chat/package.json` — `@cacheplane/partial-markdown` peer to `^0.2.0`; version bump
- `libs/langgraph/src/lib/internals/<existing message conversion file>` — call `extractCitations`
- `libs/ag-ui/src/lib/reducer.ts` — call `bridgeCitationsState` after JSON-patch application
- All 16 `libs/*/package.json` — version sync to `0.0.21`

---

## Conventions

- **TDD:** failing test → implement → green → commit, per task.
- **Commit style:** `feat(chat): ...`, `feat(langgraph): ...`, `feat(ag-ui): ...`, `chore(release): ...`.
- **Hard constraint:** no copilotkit / chatgpt / chatbot-kit / etc. references anywhere.
- **Test command:** `npx nx run <lib>:test` (e.g. `npx nx run chat:test`).
- **Lint command:** `npx nx run <lib>:lint`.
- **All chat selectors are prefixed `chat-` or `chat-md-`** to satisfy `@angular-eslint/component-selector` rule.

---

## Phase 1 — Citation type + Message field

### Task 1: Citation interface

**Files:** Create `libs/chat/src/lib/agent/citation.ts`.

- [ ] Step 1: Write file:

```ts
// SPDX-License-Identifier: MIT

/**
 * Provider-agnostic citation entry. Populated by adapters from message
 * metadata (LangGraph additional_kwargs.citations, ag-ui STATE_DELTA at
 * /citations/{messageId}). Pandoc-formatted [^id]: ... defs in message
 * content remain in the markdown AST sidecar and are merged via
 * CitationsResolverService at render time.
 */
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
}
```

- [ ] Step 2: Commit `feat(chat): add Citation interface`.

### Task 2: Add Message.citations field + export

**Files:** Modify `libs/chat/src/lib/agent/message.ts`, `libs/chat/src/index.ts` (or wherever public exports live).

- [ ] Step 1: In `message.ts`, add the import and the optional field:

```ts
import type { Citation } from './citation';
```

In the `Message` interface, after `extra?` add:

```ts
  /** Provider-agnostic citation list. Populated by adapters. */
  citations?: Citation[];
```

- [ ] Step 2: Re-export `Citation` from the chat library's public surface. Find `libs/chat/src/index.ts` (or `libs/chat/src/lib/index.ts`) and add:

```ts
export type { Citation } from './lib/agent/citation';
```

- [ ] Step 3: Run `npx nx run chat:lint && npx nx run chat:test`. Expected: green.
- [ ] Step 4: Commit `feat(chat): add Message.citations field`.

---

## Phase 2 — CitationsResolverService

### Task 3: Create CitationsResolverService + mdDefToCitation + tests

**Files:** Create `libs/chat/src/lib/markdown/citations-resolver.service.ts` + `.spec.ts`.

- [ ] Step 1: Write the spec first (TDD):

```ts
// libs/chat/src/lib/markdown/citations-resolver.service.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { CitationsResolverService } from './citations-resolver.service';
import type { Message } from '../agent/message';
import type { CitationDefinition } from '@cacheplane/partial-markdown';

describe('CitationsResolverService', () => {
  let svc: CitationsResolverService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CitationsResolverService] });
    svc = TestBed.inject(CitationsResolverService);
  });

  it('returns null when no source matches', () => {
    expect(svc.lookup('missing')()).toBeNull();
  });

  it('resolves from Message.citations first', () => {
    const msg: Message = {
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'From message', url: 'https://m.example' }],
    };
    svc.message.set(msg);
    const result = svc.lookup('src1')();
    expect(result?.source).toBe('message');
    expect(result?.citation.title).toBe('From message');
  });

  it('falls back to markdown sidecar', () => {
    const def: CitationDefinition = {
      id: 'src1', index: 1, status: 'complete',
      children: [
        { id: 1, type: 'text', status: 'complete', parent: null, index: 0, text: 'Title ' } as any,
        { id: 2, type: 'autolink', status: 'complete', parent: null, index: 1, url: 'https://md.example', text: 'https://md.example' } as any,
        { id: 3, type: 'text', status: 'complete', parent: null, index: 2, text: ' the rest' } as any,
      ],
    };
    svc.markdownDefs.set(new Map([['src1', def]]));
    const result = svc.lookup('src1')();
    expect(result?.source).toBe('markdown');
    expect(result?.citation.title).toBe('Title');
    expect(result?.citation.url).toBe('https://md.example');
    expect(result?.citation.snippet).toBe('the rest');
  });

  it('Message.citations precedence over markdown sidecar', () => {
    const msg: Message = {
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'From message' }],
    };
    const def: CitationDefinition = {
      id: 'src1', index: 1, status: 'complete',
      children: [{ id: 1, type: 'text', status: 'complete', parent: null, index: 0, text: 'From md' } as any],
    };
    svc.message.set(msg);
    svc.markdownDefs.set(new Map([['src1', def]]));
    expect(svc.lookup('src1')()?.source).toBe('message');
  });

  it('reactive — updates flow through signal', () => {
    const lookup = svc.lookup('src1');
    expect(lookup()).toBeNull();
    svc.message.set({
      id: 'm1', role: 'assistant', content: 'x',
      citations: [{ id: 'src1', index: 1, title: 'A' }],
    });
    expect(lookup()?.citation.title).toBe('A');
  });
});
```

- [ ] Step 2: Run `npx nx run chat:test` — expect FAIL (service doesn't exist).

- [ ] Step 3: Implement the service:

```ts
// libs/chat/src/lib/markdown/citations-resolver.service.ts
// SPDX-License-Identifier: MIT
import { Injectable, computed, signal, type Signal } from '@angular/core';
import type { CitationDefinition } from '@cacheplane/partial-markdown';
import type { Message } from '../agent/message';
import type { Citation } from '../agent/citation';

export interface ResolvedCitation {
  source: 'message' | 'markdown';
  citation: Citation;
}

@Injectable()
export class CitationsResolverService {
  readonly message = signal<Message | null>(null);
  readonly markdownDefs = signal<Map<string, CitationDefinition>>(new Map());

  lookup(refId: string): Signal<ResolvedCitation | null> {
    return computed(() => {
      const fromMessage = this.message()?.citations?.find(c => c.id === refId);
      if (fromMessage) return { source: 'message', citation: fromMessage };
      const fromMd = this.markdownDefs().get(refId);
      if (fromMd) return { source: 'markdown', citation: mdDefToCitation(fromMd) };
      return null;
    });
  }
}

export function mdDefToCitation(def: CitationDefinition): Citation {
  let url: string | undefined;
  const titleParts: string[] = [];
  const snippetParts: string[] = [];
  let phase: 'before' | 'after' = 'before';
  for (const child of def.children) {
    if ((child.type === 'link' || child.type === 'autolink') && url === undefined) {
      url = (child as { url?: string }).url;
      phase = 'after';
      continue;
    }
    const t = inlineToText(child);
    (phase === 'before' ? titleParts : snippetParts).push(t);
  }
  const title = titleParts.join('').trim() || undefined;
  const snippet = snippetParts.join('').trim() || undefined;
  return { id: def.id, index: def.index, title, url, snippet };
}

function inlineToText(node: unknown): string {
  const n = node as { type: string; text?: string; children?: unknown[]; url?: string };
  if (typeof n.text === 'string') return n.text;
  if (n.type === 'autolink' && typeof n.url === 'string') return n.url;
  if (Array.isArray(n.children)) return n.children.map(inlineToText).join('');
  return '';
}
```

- [ ] Step 4: Run `npx nx run chat:test` — expect PASS.
- [ ] Step 5: Export `CitationsResolverService` and `ResolvedCitation` from chat's public surface.
- [ ] Step 6: Commit `feat(chat): add CitationsResolverService`.

---

## Phase 3 — MarkdownCitationReferenceComponent

### Task 4: Inline marker component + register in view registry

**Files:** Create `libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts` + `.spec.ts`. Modify `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts`.

- [ ] Step 1: Write the spec:

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
  it('renders unresolved marker when no citation found', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const span = fixture.nativeElement.querySelector('span.chat-citation-marker');
    expect(span).toBeTruthy();
    expect(span.classList.contains('chat-citation-marker--unresolved')).toBe(true);
    expect(span.textContent).toContain('1');
  });

  it('renders linked marker when citation found via Message', () => {
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
    expect(a.textContent).toContain('1');
  });
});
```

- [ ] Step 2: Run test — expect FAIL.

- [ ] Step 3: Implement:

```ts
// libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { MarkdownCitationReferenceNode } from '@cacheplane/partial-markdown';
import { CitationsResolverService } from '../citations-resolver.service';

@Component({
  selector: 'chat-md-citation-reference',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resolved(); as r) {
      <a class="chat-citation-marker"
         [href]="r.citation.url ?? null"
         [attr.title]="r.citation.snippet ?? r.citation.url ?? null"
         target="_blank" rel="noopener noreferrer">
        <sup>[{{ node().index }}]</sup>
      </a>
    } @else {
      <span class="chat-citation-marker chat-citation-marker--unresolved"
            [attr.title]="'No source available'">
        <sup>[{{ node().index }}]</sup>
      </span>
    }
  `,
})
export class MarkdownCitationReferenceComponent {
  readonly node = input.required<MarkdownCitationReferenceNode>();
  private readonly resolver = inject(CitationsResolverService);
  protected readonly resolved = computed(() => {
    const lookup = this.resolver.lookup(this.node().refId);
    return lookup();
  });
}
```

- [ ] Step 4: Register in `cacheplane-markdown-views.ts`:

```ts
import { MarkdownCitationReferenceComponent } from './views/markdown-citation-reference.component';
// ...
export const cacheplaneMarkdownViews: ViewRegistry = views({
  // ...existing entries...
  'citation-reference': MarkdownCitationReferenceComponent,
});
```

- [ ] Step 5: Run `npx nx run chat:test`. Expect green.
- [ ] Step 6: Commit `feat(chat): add markdown citation-reference view component`.

---

## Phase 4 — chat-citations primitive

### Task 5: ChatCitationsCardComponent + ChatCitationsComponent + spec

**Files:** Create `libs/chat/src/lib/primitives/chat-citations/`:
- `chat-citations-card.component.ts`
- `chat-citations.component.ts`
- `chat-citations.component.spec.ts`
- `index.ts`

- [ ] Step 1: Write the card component:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Citation } from '../../agent/citation';

@Component({
  selector: 'chat-citations-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-citations-card">
      <div class="chat-citations-card__index">{{ citation().index }}</div>
      <div class="chat-citations-card__body">
        @if (citation().url; as url) {
          <a class="chat-citations-card__title" [href]="url" target="_blank" rel="noopener noreferrer">
            {{ citation().title ?? url }}
          </a>
        } @else if (citation().title) {
          <span class="chat-citations-card__title">{{ citation().title }}</span>
        }
        @if (citation().snippet; as s) {
          <p class="chat-citations-card__snippet">{{ s }}</p>
        }
      </div>
    </div>
  `,
})
export class ChatCitationsCardComponent {
  readonly citation = input.required<Citation>();
}
```

- [ ] Step 2: Write the panel component:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy, Component, ContentChild, Directive, TemplateRef,
  computed, input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Message } from '../../agent/message';
import type { Citation } from '../../agent/citation';
import { ChatCitationsCardComponent } from './chat-citations-card.component';

/**
 * ContentChild template directive for custom citation card rendering.
 * Usage: <ng-template chatCitationCard let-citation>...</ng-template>
 */
@Directive({ selector: 'ng-template[chatCitationCard]', standalone: true })
export class ChatCitationCardTemplateDirective {
  constructor(public readonly tpl: TemplateRef<{ $implicit: Citation }>) {}
}

@Component({
  selector: 'chat-citations',
  standalone: true,
  imports: [NgTemplateOutlet, ChatCitationsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (citations().length > 0) {
      <section class="chat-citations">
        <h4 class="chat-citations__heading">{{ heading() }}</h4>
        <ul class="chat-citations__list">
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
      </section>
    }
  `,
})
export class ChatCitationsComponent {
  readonly message = input.required<Message>();
  readonly heading = input<string>('Sources');

  @ContentChild(ChatCitationCardTemplateDirective) cardTpl: ChatCitationCardTemplateDirective | null = null;

  protected readonly citations = computed<Citation[]>(() => {
    const list = this.message().citations ?? [];
    return [...list].sort((a, b) => a.index - b.index);
  });
}
```

- [ ] Step 3: Write the spec:

```ts
// libs/chat/src/lib/primitives/chat-citations/chat-citations.component.spec.ts
// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatCitationsComponent, ChatCitationCardTemplateDirective } from './chat-citations.component';
import type { Message } from '../../agent/message';

function msg(citations: Message['citations']): Message {
  return { id: 'm1', role: 'assistant', content: 'x', citations };
}

@Component({
  standalone: true,
  imports: [ChatCitationsComponent],
  template: `<chat-citations [message]="message()" />`,
})
class HostComponent {
  message = signal<Message>(msg(undefined));
}

describe('ChatCitationsComponent', () => {
  it('renders nothing when citations is undefined', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-citations')).toBeNull();
  });

  it('renders nothing when citations is empty', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-citations')).toBeNull();
  });

  it('renders citations sorted by index', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.message.set(msg([
      { id: 'b', index: 2, title: 'B' },
      { id: 'a', index: 1, title: 'A' },
    ]));
    fixture.detectChanges();
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.chat-citations-card__title'))
      .map((el: any) => el.textContent.trim());
    expect(titles).toEqual(['A', 'B']);
  });

  it('uses ContentChild template slot when provided', () => {
    @Component({
      standalone: true,
      imports: [ChatCitationsComponent, ChatCitationCardTemplateDirective],
      template: `
        <chat-citations [message]="message">
          <ng-template chatCitationCard let-c>
            <span class="custom-card">{{ c.title }}</span>
          </ng-template>
        </chat-citations>
      `,
    })
    class CustomHost {
      message: Message = msg([{ id: 'a', index: 1, title: 'Custom' }]);
    }
    const fixture = TestBed.createComponent(CustomHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.custom-card')?.textContent.trim()).toBe('Custom');
    expect(fixture.nativeElement.querySelector('.chat-citations-card')).toBeNull();
  });
});
```

- [ ] Step 4: Write the barrel `libs/chat/src/lib/primitives/chat-citations/index.ts`:

```ts
export { ChatCitationsComponent, ChatCitationCardTemplateDirective } from './chat-citations.component';
export { ChatCitationsCardComponent } from './chat-citations-card.component';
```

- [ ] Step 5: Re-export from chat's public surface. Find the existing primitives barrel pattern (look at how `chat-reasoning` is exported) and mirror it.

- [ ] Step 6: Run `npx nx run chat:test`. Expect green.
- [ ] Step 7: Commit `feat(chat): add chat-citations primitive (sources panel)`.

---

## Phase 5 — Wire into ChatMessage and ChatStreamingMd

### Task 6: Render `<chat-citations>` in `<chat-message>` (assistant only)

**Files:** Modify `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`.

- [ ] Step 1: Locate the template position immediately after the message body slot and before message-actions.
- [ ] Step 2: Add `<chat-citations [message]="message()" />` for assistant messages:

```html
@if (message().role === 'assistant') {
  <chat-citations [message]="message()" />
}
```

- [ ] Step 3: Add `ChatCitationsComponent` to the component's `imports` array.
- [ ] Step 4: Run `npx nx run chat:test`. Expect green (existing chat-message tests still pass).
- [ ] Step 5: Commit `feat(chat): render chat-citations under assistant messages`.

### Task 7: Provide CitationsResolverService at chat-message level + feed markdown sidecar

**Files:** Modify `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`, `libs/chat/src/lib/streaming/streaming-markdown.component.ts`.

- [ ] Step 1: In `ChatMessageComponent`, add to `providers`:

```ts
providers: [CitationsResolverService],
```

In an `effect()` (created in constructor), set the resolver's message:

```ts
constructor() {
  effect(() => {
    this.resolver.message.set(this.message());
  });
}
private readonly resolver = inject(CitationsResolverService);
```

- [ ] Step 2: In `ChatStreamingMdComponent`, inject the resolver and feed `markdownDefs` from `doc.citations` whenever the root computes:

```ts
private readonly resolver = inject(CitationsResolverService, { optional: true });

constructor() {
  effect(() => {
    const r = this.root();
    if (this.resolver && r) {
      this.resolver.markdownDefs.set(r.citations ?? new Map());
    }
  });
}
```

(`{ optional: true }` because chat-streaming-md may be used outside of chat-message in tests.)

- [ ] Step 3: Run `npx nx run chat:test`. Existing tests still pass; markdown citation refs in assistant messages now resolve via the chained injector.
- [ ] Step 4: Commit `feat(chat): wire CitationsResolverService through chat-message + chat-streaming-md`.

---

## Phase 6 — LangGraph adapter

### Task 8: extractCitations + tests + integration

**Files:**
- Create: `libs/langgraph/src/lib/internals/extract-citations.ts` + `.spec.ts`
- Modify: the existing LangChain message → ngaf Message conversion file (likely `libs/langgraph/src/lib/internals/messages.ts` or similar — locate by grep for "additional_kwargs" or "BaseMessage").

- [ ] Step 1: Write the spec:

```ts
// libs/langgraph/src/lib/internals/extract-citations.spec.ts
// SPDX-License-Identifier: MIT
import { extractCitations } from './extract-citations';

describe('extractCitations', () => {
  it('returns undefined when no citations or sources', () => {
    expect(extractCitations({ additional_kwargs: {} })).toBeUndefined();
    expect(extractCitations({})).toBeUndefined();
  });

  it('reads additional_kwargs.citations', () => {
    const result = extractCitations({
      additional_kwargs: { citations: [{ id: 'a', title: 'Title A', url: 'https://a' }] },
    });
    expect(result).toEqual([{ id: 'a', index: 1, title: 'Title A', url: 'https://a' }]);
  });

  it('falls back to additional_kwargs.sources', () => {
    const result = extractCitations({
      additional_kwargs: { sources: [{ id: 'b', title: 'B', url: 'https://b' }] },
    });
    expect(result).toEqual([{ id: 'b', index: 1, title: 'B', url: 'https://b' }]);
  });

  it('handles string entries (URL only)', () => {
    expect(extractCitations({ additional_kwargs: { citations: ['https://x'] } }))
      .toEqual([{ id: 'c1', index: 1, url: 'https://x' }]);
  });

  it('coerces key spellings (href/source, name, content/excerpt)', () => {
    expect(extractCitations({
      additional_kwargs: {
        citations: [
          { name: 'N', href: 'https://h', content: 'C' },
          { name: 'O', source: 'https://s', excerpt: 'E' },
        ],
      },
    })).toEqual([
      { id: 'c1', index: 1, title: 'N', url: 'https://h', snippet: 'C' },
      { id: 'c2', index: 2, title: 'O', url: 'https://s', snippet: 'E' },
    ]);
  });

  it('preserves explicit index when provided', () => {
    expect(extractCitations({
      additional_kwargs: { citations: [{ id: 'a', index: 5, title: 'A' }] },
    })).toEqual([{ id: 'a', index: 5, title: 'A' }]);
  });

  it('returns undefined for empty array', () => {
    expect(extractCitations({ additional_kwargs: { citations: [] } })).toBeUndefined();
  });
});
```

- [ ] Step 2: Run `npx nx run langgraph:test` — expect FAIL.

- [ ] Step 3: Implement:

```ts
// libs/langgraph/src/lib/internals/extract-citations.ts
// SPDX-License-Identifier: MIT
import type { Citation } from '@ngaf/chat';

interface KwargsLike {
  additional_kwargs?: Record<string, unknown> | undefined;
}

export function extractCitations(msg: KwargsLike): Citation[] | undefined {
  const raw = msg.additional_kwargs?.['citations'] ?? msg.additional_kwargs?.['sources'];
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry, i) => normalizeCitation(entry, i + 1));
}

function normalizeCitation(entry: unknown, fallbackIndex: number): Citation {
  if (typeof entry === 'string') {
    return { id: `c${fallbackIndex}`, index: fallbackIndex, url: entry };
  }
  const e = (entry ?? {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof e[key] === 'string' ? (e[key] as string) : undefined;
  const firstStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return {
    id: str('id') ?? str('refId') ?? `c${fallbackIndex}`,
    index: typeof e['index'] === 'number' ? (e['index'] as number) : fallbackIndex,
    title: firstStr('title', 'name'),
    url: firstStr('url', 'href', 'source'),
    snippet: firstStr('snippet', 'content', 'excerpt'),
    extra:
      typeof e['extra'] === 'object' && e['extra'] !== null
        ? (e['extra'] as Record<string, unknown>)
        : undefined,
  };
}
```

- [ ] Step 4: Wire into the existing message conversion. Find the file that maps LangChain BaseMessage → `Message` (search for `additional_kwargs`, `role: 'assistant'`, or `reasoning?:`). After the existing message construction, set:

```ts
const citations = extractCitations(rawLcMessage);
if (citations) (result as Message).citations = citations;
```

- [ ] Step 5: Run `npx nx run langgraph:test`. Expect green.
- [ ] Step 6: Commit `feat(langgraph): extract citations from additional_kwargs`.

---

## Phase 7 — ag-ui adapter

### Task 9: bridgeCitationsState + tests + integration

**Files:**
- Create: `libs/ag-ui/src/lib/bridge-citations-state.ts` + `.spec.ts`
- Modify: `libs/ag-ui/src/lib/reducer.ts`

- [ ] Step 1: Write the spec:

```ts
// libs/ag-ui/src/lib/bridge-citations-state.spec.ts
// SPDX-License-Identifier: MIT
import { bridgeCitationsState } from './bridge-citations-state';
import type { Message } from '@ngaf/chat';

describe('bridgeCitationsState', () => {
  const baseMsg = (id: string): Message => ({ id, role: 'assistant', content: 'x' });

  it('returns messages unchanged when state has no citations', () => {
    const msgs = [baseMsg('m1'), baseMsg('m2')];
    const result = bridgeCitationsState({ state: {} }, msgs);
    expect(result).toEqual(msgs);
  });

  it('merges citations into matching messages by id', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: [{ id: 'a', title: 'A', url: 'https://a' }] } } },
      [baseMsg('m1'), baseMsg('m2')],
    );
    expect(result[0].citations).toEqual([{ id: 'a', index: 1, title: 'A', url: 'https://a' }]);
    expect(result[1].citations).toBeUndefined();
  });

  it('idempotent — same input produces same output', () => {
    const state = { state: { citations: { m1: [{ id: 'a', title: 'A' }] } } };
    const msgs = [baseMsg('m1')];
    const a = bridgeCitationsState(state, msgs);
    const b = bridgeCitationsState(state, a);
    expect(b[0].citations).toEqual(a[0].citations);
  });

  it('coerces key spellings (href/source, name, excerpt)', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: [{ name: 'N', href: 'https://h', excerpt: 'E' }] } } },
      [baseMsg('m1')],
    );
    expect(result[0].citations).toEqual([
      { id: 'c1', index: 1, title: 'N', url: 'https://h', snippet: 'E' },
    ]);
  });

  it('handles string entries', () => {
    const result = bridgeCitationsState(
      { state: { citations: { m1: ['https://x'] } } },
      [baseMsg('m1')],
    );
    expect(result[0].citations).toEqual([{ id: 'c1', index: 1, url: 'https://x' }]);
  });
});
```

- [ ] Step 2: Run test — expect FAIL.

- [ ] Step 3: Implement:

```ts
// libs/ag-ui/src/lib/bridge-citations-state.ts
// SPDX-License-Identifier: MIT
import type { Citation, Message } from '@ngaf/chat';

interface ThreadStateLike {
  state?: Record<string, unknown>;
}

export function bridgeCitationsState(thread: ThreadStateLike, messages: Message[]): Message[] {
  const citationsByMsg = (thread.state as { citations?: unknown })?.citations;
  if (!citationsByMsg || typeof citationsByMsg !== 'object') return messages;
  const map = citationsByMsg as Record<string, unknown>;
  return messages.map(msg => {
    const raw = map[msg.id];
    if (!Array.isArray(raw) || raw.length === 0) return msg;
    return { ...msg, citations: raw.map((entry, i) => normalizeCitation(entry, i + 1)) };
  });
}

function normalizeCitation(entry: unknown, fallbackIndex: number): Citation {
  if (typeof entry === 'string') {
    return { id: `c${fallbackIndex}`, index: fallbackIndex, url: entry };
  }
  const e = (entry ?? {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof e[key] === 'string' ? (e[key] as string) : undefined;
  const firstStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return {
    id: str('id') ?? str('refId') ?? `c${fallbackIndex}`,
    index: typeof e['index'] === 'number' ? (e['index'] as number) : fallbackIndex,
    title: firstStr('title', 'name'),
    url: firstStr('url', 'href', 'source'),
    snippet: firstStr('snippet', 'content', 'excerpt'),
    extra:
      typeof e['extra'] === 'object' && e['extra'] !== null
        ? (e['extra'] as Record<string, unknown>)
        : undefined,
  };
}
```

- [ ] Step 4: Wire into `reducer.ts` — call `bridgeCitationsState(thread, messages)` after the existing JSON-patch application step. The exact integration depends on the reducer shape; the implementer should locate where `messages` are produced and pipe them through this bridge.

- [ ] Step 5: Run `npx nx run ag-ui:test`. Expect green.
- [ ] Step 6: Commit `feat(ag-ui): bridge state.citations into Message.citations`.

---

## Phase 8 — Synchronize all @ngaf libs to 0.0.21

### Task 10: Bump all 16 @ngaf lib versions to 0.0.21

**Files:** All `libs/*/package.json`.

- [ ] Step 1: For each of:
  - `libs/a2ui/package.json`
  - `libs/ag-ui/package.json`
  - `libs/chat/package.json`
  - `libs/cockpit-docs/package.json`
  - `libs/cockpit-registry/package.json`
  - `libs/cockpit-shell/package.json`
  - `libs/cockpit-testing/package.json`
  - `libs/cockpit-ui/package.json`
  - `libs/db/package.json`
  - `libs/design-tokens/package.json`
  - `libs/example-layouts/package.json`
  - `libs/langgraph/package.json`
  - `libs/licensing/package.json`
  - `libs/partial-json/package.json`
  - `libs/render/package.json`
  - `libs/ui-react/package.json`

  Set `"version": "0.0.21"`.

- [ ] Step 2: In `libs/chat/package.json`, also update the `@cacheplane/partial-markdown` peer:

```json
"@cacheplane/partial-markdown": "^0.2.0",
```

(Currently `^0.1.0`.)

- [ ] Step 3: Verify no peer/dep ranges that pin specific @ngaf versions need updating. (Most use `*` per existing repo convention.)
- [ ] Step 4: Run `npx nx run-many --target=lint --projects=chat,langgraph,ag-ui,a2ui,render,licensing` and `npx nx run-many --target=test --projects=chat,langgraph,ag-ui,a2ui,render,licensing`. Expect green.
- [ ] Step 5: Commit `chore(release): synchronize all @ngaf libs to 0.0.21`.

---

## Phase 9 — Documentation

### Task 11: README + CHANGELOG updates

**Files:** `libs/chat/README.md`, `libs/langgraph/README.md`, `libs/ag-ui/README.md`, root or per-lib CHANGELOG.

- [ ] Step 1: Add a "Citations" section to `libs/chat/README.md` covering: Citation interface, `Message.citations` field, `<chat-citations>` primitive usage, custom card slot, inline marker rendering via the markdown view registry.

- [ ] Step 2: Add a citations sub-section to `libs/langgraph/README.md` documenting `additional_kwargs.citations` / `additional_kwargs.sources` extraction with shape examples.

- [ ] Step 3: Add a citations sub-section to `libs/ag-ui/README.md` documenting the `state.citations[messageId]` STATE_DELTA path with shape examples.

- [ ] Step 4: Add `0.0.21` entry to the project's CHANGELOG.md (or per-lib CHANGELOGs if that's the convention) covering: citations primitive + adapter bridges + synchronized version bump policy.

- [ ] Step 5: Commit `docs: chat citations + adapter bridge documentation`.

---

## Phase 10 — Release

### Task 12: Push, PR, merge on green, tag

- [ ] Step 1: Push branch:

```bash
git push -u origin claude/chat-citations-0.0.21
```

- [ ] Step 2: Open PR:

```bash
gh pr create --title "feat: citations + sync all @ngaf to 0.0.21" --body "..."
```

PR body covers: citations summary, type surface, adapter bridges, synchronized version bump rationale, test plan checklist.

- [ ] Step 3: Wait for CI green. If failing, fix root cause; do NOT skip checks.

- [ ] Step 4: Squash-merge:

```bash
gh pr merge --squash --delete-branch
```

- [ ] Step 5: Tag at squash-merge commit:

```bash
gh api -X POST repos/cacheplane/angular-agent-framework/git/refs -f ref=refs/tags/ngaf-v0.0.21 -f sha=<merge-sha>
```

(Single unified tag, not per-lib tags.)

- [ ] Step 6: Done.
