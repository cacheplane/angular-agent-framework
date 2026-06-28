// libs/chat/src/lib/streaming/streaming-markdown.table-stream.spec.ts
// SPDX-License-Identifier: MIT
//
// Regression: a streaming table must render as a <table> as it arrives, not as
// raw "| a | b |" paragraph text. The bug was that ChatStreamingMdComponent
// called parser.finish() on every render where [streaming] was false — and
// finish() reverts an incomplete table (header with no delimiter row yet) to a
// CommonMark paragraph (raw pipes). Because the [streaming] flag is unreliable
// (observed false for an entire live stream at cold start), the whole table
// rendered as raw pipes until the message completed. The fix: do not finalize
// the parser while content is still growing; finalize only once it settles.
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  streaming = signal<boolean>(true);
}

describe('ChatStreamingMdComponent — streaming table rendering', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  let host: HostComponent;
  let el: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
  });
  const grow = (c: string) => { host.content.set(c); fixture.detectChanges(); };

  it('renders a <table> as a table streams in even when [streaming] lags false', () => {
    // The cold-start race: content is actively growing but streaming is false.
    host.streaming.set(false);
    grow('Here is a table:\n\n| Name ');
    grow('Here is a table:\n\n| Name | Age |'); // header on the open line, no delimiter
    // Before the fix: finish() reverted this to raw-pipe paragraphs.
    expect(el.querySelector('table'), 'header should render as a table, not raw pipes').toBeTruthy();
    const paras = [...el.querySelectorAll('p')].map((p) => p.textContent || '');
    expect(paras.some((t) => t.includes('| Name | Age |')), 'no raw-pipe paragraph').toBe(false);
  });

  it('renders a <table> while streaming (flag true), through the delimiter wait', () => {
    grow('| Name | Age |');
    expect(el.querySelector('table')).toBeTruthy();
    grow('| Name | Age |\n'); // header committed, awaiting delimiter
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('finalizes the table once the stream settles (streaming -> false)', () => {
    host.streaming.set(true);
    grow('| Name | Age |\n| --- | --- |\n| Ada | 36 |\n');
    expect(el.querySelector('table')).toBeTruthy();
    host.streaming.set(false); // settle
    fixture.detectChanges();
    const table = el.querySelector('table');
    expect(table).toBeTruthy();
    expect(el.querySelectorAll('thead th').length).toBe(2);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('renders a complete one-shot (non-streaming) table message', () => {
    host.streaming.set(false);
    grow('| Name | Age |\n| --- | --- |\n| Ada | 36 |\n');
    expect(el.querySelector('table')).toBeTruthy();
    expect(el.querySelectorAll('thead th').length).toBe(2);
  });

  it('does not flash raw pipes when [streaming] flaps false mid-stream', () => {
    vi.useFakeTimers();
    try {
      host.streaming.set(true);
      grow('| Name | Age |'); // streaming header → table
      expect(el.querySelector('table')).toBeTruthy();
      // Flap: streaming reads false for a moment with no new content.
      host.streaming.set(false);
      fixture.detectChanges();
      vi.advanceTimersByTime(60); // less than the debounce — must NOT finalize
      expect(el.querySelector('table'), 'table must survive the flap').toBeTruthy();
      expect(
        [...el.querySelectorAll('p')].some((p) => (p.textContent || '').includes('|')),
        'no raw-pipe paragraph during the flap',
      ).toBe(false);
      // Flap recovers: streaming true again + more content arrives.
      host.streaming.set(true);
      grow('| Name | Age |\n| --- | --- |\n');
      vi.advanceTimersByTime(300);
      expect(el.querySelector('table')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
