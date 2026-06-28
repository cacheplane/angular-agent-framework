// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
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

interface FinalizedRow {
  name: string;
  input: string;
  /** Expected concatenated textContent of the rendered root, trimmed and collapsed-whitespace. */
  expectedText: string;
  /** Optional CSS selector that must match at least once in the rendered DOM. */
  selectorPresent?: string;
  /** Optional CSS selector that must NOT match. */
  selectorAbsent?: string;
}

const finalizedRows: FinalizedRow[] = [
  { name: 'plain text no trailing newline', input: 'Hello', expectedText: 'Hello', selectorPresent: 'p' },
  { name: 'plain text with trailing newline', input: 'Hello\n', expectedText: 'Hello', selectorPresent: 'p' },
  { name: 'heading no trailing newline', input: '# Title', expectedText: 'Title', selectorPresent: 'h1' },
  { name: 'heading with trailing newline', input: '# Title\n', expectedText: 'Title', selectorPresent: 'h1' },
  { name: 'completed bold', input: '**bold**', expectedText: 'bold', selectorPresent: 'strong' },
  { name: 'inline code', input: 'Run `npm test` to verify', expectedText: 'Run npm test to verify', selectorPresent: 'code' },
  { name: 'CRLF line endings', input: 'Line one\r\nLine two\r\n', expectedText: 'Line one Line two' },
  { name: 'whitespace only', input: '   ', expectedText: '' },
  { name: 'empty string', input: '', expectedText: '', selectorAbsent: 'p' },
  { name: 'trailing whitespace no newline', input: 'Answer   ', expectedText: 'Answer', selectorPresent: 'p' },
];

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

describe('ChatStreamingMdComponent — finalized input variance', () => {
  it.each(finalizedRows)('$name', (row) => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set(row.input);
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    expect(normalize(fixture.nativeElement.textContent ?? '')).toBe(row.expectedText);
    if (row.selectorPresent) {
      expect(fixture.nativeElement.querySelector(row.selectorPresent)).toBeTruthy();
    }
    if (row.selectorAbsent) {
      expect(fixture.nativeElement.querySelector(row.selectorAbsent)).toBeNull();
    }
  });
});

interface MidStreamRow {
  name: string;
  /** Content pushed while streaming=true. */
  midStream: string;
  /** Content pushed when streaming flips to false. Defaults to midStream. */
  onFinish?: string;
  expectedText: string;
}

const midStreamRows: MidStreamRow[] = [
  { name: 'partial bold mid-stream then unchanged', midStream: '**bo', expectedText: '**bo' },
  { name: 'partial bold mid-stream then completed', midStream: '**bo', onFinish: '**bold**', expectedText: 'bold' },
  { name: 'unfinished sentence then finalized', midStream: 'The quick', onFinish: 'The quick brown fox.', expectedText: 'The quick brown fox.' },
];

describe('ChatStreamingMdComponent — mid-stream input variance', () => {
  it.each(midStreamRows)('$name', (row) => {
    // Finalization is debounced (the component must not finalize on a transient
    // streaming=false), so an unclosed construct only reverts to its literal
    // CommonMark form once the debounce elapses. Drive fake timers to settle.
    vi.useFakeTimers();
    try {
      TestBed.configureTestingModule({ imports: [HostComponent] });
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.content.set(row.midStream);
      fixture.componentInstance.streaming.set(true);
      fixture.detectChanges();
      fixture.componentInstance.content.set(row.onFinish ?? row.midStream);
      fixture.componentInstance.streaming.set(false);
      fixture.detectChanges();
      vi.advanceTimersByTime(800); // elapse the finalize debounce
      fixture.detectChanges();
      expect(normalize(fixture.nativeElement.textContent ?? '')).toBe(row.expectedText);
    } finally {
      vi.useRealTimers();
    }
  });
});
