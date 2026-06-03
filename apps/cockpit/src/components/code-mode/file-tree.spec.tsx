/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileTree } from './file-tree';

describe('FileTree', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => { root?.unmount(); });
    container?.remove();
    vi.clearAllMocks();
  });

  function render(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(node); });
  }

  it('renders a file row for every path', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts', 'python/src/graph.py', 'prompts/planning.md']}
        activePath={null}
        onSelect={onSelect}
      />
    );

    const labels = Array.from(container!.querySelectorAll('[data-file-label]')).map((el) => el.textContent);
    expect(labels).toContain('planning.component.ts');
    expect(labels).toContain('graph.py');
    expect(labels).toContain('planning.md');
  });

  it('marks the active file row with aria-current="true"', () => {
    render(
      <FileTree
        paths={['a.ts', 'b.py']}
        activePath="b.py"
        onSelect={() => {}}
      />
    );

    const active = container!.querySelector('[data-file-row][aria-current="true"]');
    expect(active?.querySelector('[data-file-label]')?.textContent).toBe('b.py');
  });

  it('emits onSelect with the file path when a file row is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts']}
        activePath={null}
        onSelect={onSelect}
      />
    );

    const row = container!.querySelector('[data-file-row]') as HTMLElement;
    act(() => { row.click(); });

    expect(onSelect).toHaveBeenCalledWith('angular/src/app/planning.component.ts');
  });

  it('collapses a folder when its header is clicked and hides its children', () => {
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts', 'angular/src/app/app.config.ts']}
        activePath={null}
        onSelect={() => {}}
      />
    );

    // Folder "angular/src/app" is the only top-level row (compact-merged).
    const folder = container!.querySelector('[data-folder-row]') as HTMLElement;
    expect(folder.textContent).toContain('angular/src/app');
    expect(container!.querySelectorAll('[data-file-row]')).toHaveLength(2);

    act(() => { folder.click(); });

    expect(container!.querySelectorAll('[data-file-row]')).toHaveLength(0);
  });
});
