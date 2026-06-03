export type FileNode = { kind: 'file'; path: string; label: string };
export type FolderNode = { kind: 'folder'; label: string; children: TreeNode[] };
export type TreeNode = FileNode | FolderNode;


function insert(root: FolderNode, segments: string[], fullPath: string): void {
  let node = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    let child = node.children.find((c): c is FolderNode => c.kind === 'folder' && c.label === seg);
    if (!child) {
      child = { kind: 'folder', label: seg, children: [] };
      node.children.push(child);
    }
    node = child;
  }
  const filename = segments[segments.length - 1];
  node.children.push({ kind: 'file', path: fullPath, label: filename });
}

function compact(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.kind === 'file') return node;
    let folder = node;
    // Merge while this folder has exactly one child AND that child is a folder.
    while (folder.children.length === 1 && folder.children[0].kind === 'folder') {
      const only = folder.children[0];
      folder = { kind: 'folder', label: `${folder.label}/${only.label}`, children: only.children };
    }
    return { ...folder, children: compact(folder.children) };
  });
}

/** Peel off a single top-level compacted folder when it is a pure "namespace"
 *  node — i.e. it has exactly one top-level item, that item is a folder, and
 *  every one of its direct children is also a folder (no files at that level).
 *  This implements the common-directory-prefix trimming: a shared root that
 *  only contains sub-folders is invisible; one that contains files is shown. */
function peelPrefix(nodes: TreeNode[]): TreeNode[] {
  if (
    nodes.length === 1 &&
    nodes[0].kind === 'folder' &&
    nodes[0].children.length > 0 &&
    nodes[0].children.every((c) => c.kind === 'folder')
  ) {
    return peelPrefix(nodes[0].children);
  }
  return nodes;
}

export function buildTree(paths: readonly string[]): TreeNode[] {
  if (paths.length === 0) return [];
  const root: FolderNode = { kind: 'folder', label: '', children: [] };
  paths.forEach((p) => insert(root, p.split('/'), p));
  return peelPrefix(compact(root.children));
}
