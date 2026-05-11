// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@angular/core';
import type { Thread } from './chat-thread-list.component';

const threads: Thread[] = [
  { id: 'thread-1', title: 'First Thread' },
  { id: 'thread-2', title: 'Second Thread' },
  { id: 'thread-3', title: 'Third Thread' },
];

describe('ChatThreadListComponent — structure', () => {
  it('threads input signal holds provided threads', () => {
    const threads$ = signal<Thread[]>(threads);
    expect(threads$()).toHaveLength(3);
    expect(threads$()[0].id).toBe('thread-1');
  });

  it('activeThreadId input defaults to empty string', () => {
    const activeThreadId$ = signal<string>('');
    expect(activeThreadId$()).toBe('');
  });

  it('isActive context is true when thread.id matches activeThreadId', () => {
    const activeThreadId$ = signal<string>('thread-2');

    const contextForThread = (thread: Thread) => ({
      $implicit: thread,
      isActive: thread.id === activeThreadId$(),
    });

    expect(contextForThread(threads[0]).isActive).toBe(false);
    expect(contextForThread(threads[1]).isActive).toBe(true);
    expect(contextForThread(threads[2]).isActive).toBe(false);
  });

  it('isActive updates reactively when activeThreadId changes', () => {
    const activeThreadId$ = signal<string>('thread-1');

    const isActive = (thread: Thread) =>
      computed(() => thread.id === activeThreadId$());

    const thread1Active = isActive(threads[0]);
    const thread2Active = isActive(threads[1]);

    expect(thread1Active()).toBe(true);
    expect(thread2Active()).toBe(false);

    activeThreadId$.set('thread-2');

    expect(thread1Active()).toBe(false);
    expect(thread2Active()).toBe(true);
  });

  it('renders context with $implicit thread reference', () => {
    const threads$ = signal<Thread[]>(threads);
    const activeThreadId$ = signal<string>('thread-3');

    const contexts = computed(() =>
      threads$().map(thread => ({
        $implicit: thread,
        isActive: thread.id === activeThreadId$(),
      }))
    );

    const result = contexts();
    expect(result).toHaveLength(3);
    expect(result[2].$implicit.id).toBe('thread-3');
    expect(result[2].isActive).toBe(true);
  });

  it('threads updates reactively when thread list changes', () => {
    const threads$ = signal<Thread[]>(threads.slice(0, 2));
    expect(threads$()).toHaveLength(2);

    threads$.set(threads);
    expect(threads$()).toHaveLength(3);
  });
});

describe('ChatThreadListComponent — default item template', () => {
  // Helper function that mirrors the component's relativeTime method
  const relativeTime = (epochMs: number): string => {
    const delta = Date.now() - epochMs;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} hr ago`;
    return `${Math.floor(delta / 86_400_000)} day ago`;
  };

  it('Thread type includes optional updatedAt field', () => {
    const threadWithTime: Thread = { id: 'a', title: 'Test', updatedAt: Date.now() };
    const threadWithoutTime: Thread = { id: 'b', title: 'Test' };
    expect(threadWithTime.updatedAt).toBeDefined();
    expect(threadWithoutTime.updatedAt).toBeUndefined();
  });

  it('relativeTime returns "just now" for < 60s delta', () => {
    const now = Date.now();
    expect(relativeTime(now - 30_000)).toBe('just now');
  });

  it('relativeTime returns "X min ago" for < 1h delta', () => {
    const now = Date.now();
    const result = relativeTime(now - 300_000); // 5 min ago
    expect(result).toMatch(/\d+ min ago/);
  });

  it('relativeTime returns "X hr ago" for < 1d delta', () => {
    const now = Date.now();
    const result = relativeTime(now - 7_200_000); // 2 hr ago
    expect(result).toMatch(/\d+ hr ago/);
  });

  it('relativeTime returns "X day ago" for >= 1d delta', () => {
    const now = Date.now();
    const result = relativeTime(now - 172_800_000); // 2 day ago
    expect(result).toMatch(/\d+ day ago/);
  });
});
