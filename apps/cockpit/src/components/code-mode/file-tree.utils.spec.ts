import { describe, expect, it } from 'vitest';
import { buildTree, type TreeNode } from './file-tree.utils';

describe('buildTree', () => {
  it('returns an empty array when no paths are given', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('returns a flat list of file nodes when there are no folders after trimming', () => {
    const tree = buildTree(['planning.md']);
    expect(tree).toEqual<TreeNode[]>([
      { kind: 'file', path: 'planning.md', label: 'planning.md' },
    ]);
  });

  it('strips the common directory prefix shared by all paths', () => {
    const tree = buildTree([
      'cockpit/planning/angular/app.config.ts',
      'cockpit/planning/python/graph.py',
    ]);
    // common prefix "cockpit/planning/" is removed; "angular" and "python" become top-level folders
    expect(tree.map((n) => (n.kind === 'folder' ? n.label : n.label))).toEqual(['angular', 'python']);
  });

  it('compacts single-child folder chains into one row', () => {
    const tree = buildTree([
      'angular/src/app/planning.component.ts',
      'angular/src/app/app.config.ts',
    ]);
    // angular > src > app each have one child folder beneath them on the way down;
    // they merge into a single "angular/src/app" folder row.
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'folder', label: 'angular/src/app' });
    expect((tree[0] as { children: TreeNode[] }).children.map((c) => c.label).sort()).toEqual([
      'app.config.ts',
      'planning.component.ts',
    ]);
  });

  it('keeps a folder distinct from its children when it has both a file and a subfolder', () => {
    const tree = buildTree([
      'angular/src/app/planning.component.ts',
      'angular/src/app/views/plan-checklist.component.ts',
    ]);
    // angular/src/app contains a file AND a "views" subfolder → does not merge with "views"
    const top = tree[0] as { kind: 'folder'; label: string; children: TreeNode[] };
    expect(top.label).toBe('angular/src/app');
    expect(top.children).toHaveLength(2);
    const labels = top.children.map((c) => c.label).sort();
    expect(labels).toEqual(['planning.component.ts', 'views']);
  });

  it('renders all files flat when no common prefix and only one segment each', () => {
    const tree = buildTree(['a.ts', 'b.py']);
    expect(tree).toEqual<TreeNode[]>([
      { kind: 'file', path: 'a.ts', label: 'a.ts' },
      { kind: 'file', path: 'b.py', label: 'b.py' },
    ]);
  });
});
