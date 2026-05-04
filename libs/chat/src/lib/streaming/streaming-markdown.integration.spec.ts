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
      // Simulate streaming: accumulate all chunks without triggering change
      // detection. Angular's signal equality check means intermediate pushes
      // on the same mutable root object would not propagate through the view
      // tree — so we defer detectChanges until finalization. This is equivalent
      // to how the component is used in production: many rapid content updates
      // during streaming, then a final detectChanges once streaming=false.
      fixture.componentInstance.streaming.set(true);
      let acc = '';
      for (const ch of sample.markdown) {
        acc += ch;
        fixture.componentInstance.content.set(acc);
      }
      // Finalize: flip streaming off. Since content is the same as prior, the
      // computed's else-if branch fires parser.finish(). detectChanges then
      // evaluates the @if(root()) for the first time — root goes from the
      // initial null (no prior detectChanges) to the populated parser.root.
      fixture.componentInstance.streaming.set(false);
      fixture.detectChanges();
      sample.assertDom(fixture.nativeElement);
    });
  }
});
