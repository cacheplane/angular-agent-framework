'use client';

import React from 'react';
import { buildTree, type FolderNode, type TreeNode } from './file-tree.utils';

interface FileTreeProps {
  paths: readonly string[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

function langChip(label: string): string | null {
  const dot = label.lastIndexOf('.');
  if (dot <= 0) return null;
  return label.slice(dot + 1).toUpperCase();
}

export function FileTree({ paths, activePath, onSelect }: FileTreeProps) {
  const tree = React.useMemo(() => buildTree(paths), [paths]);
  const [collapsedFolders, setCollapsedFolders] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggleFolder = React.useCallback((id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <ul className="cockpit-file-tree">
      {tree.map((node, i) => (
        <Node
          key={`${i}-${node.label}`}
          node={node}
          depth={0}
          folderId={node.label}
          activePath={activePath}
          collapsedFolders={collapsedFolders}
          onToggleFolder={toggleFolder}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

interface NodeProps {
  node: TreeNode;
  depth: number;
  folderId: string;
  activePath: string | null;
  collapsedFolders: ReadonlySet<string>;
  onToggleFolder: (id: string) => void;
  onSelect: (path: string) => void;
}

function Node({ node, depth, folderId, activePath, collapsedFolders, onToggleFolder, onSelect }: NodeProps) {
  if (node.kind === 'file') {
    const chip = langChip(node.label);
    const isActive = activePath === node.path;
    return (
      <li>
        <button
          type="button"
          data-file-row
          aria-current={isActive ? 'true' : undefined}
          onClick={() => onSelect(node.path)}
          className="cockpit-file-tree__file"
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
        >
          <span className="cockpit-file-tree__label" data-file-label>{node.label}</span>
          {chip ? <span className="cockpit-file-tree__chip" aria-hidden="true">{chip}</span> : null}
        </button>
      </li>
    );
  }

  const folder = node as FolderNode;
  const isCollapsed = collapsedFolders.has(folderId);
  return (
    <li>
      <button
        type="button"
        data-folder-row
        aria-expanded={!isCollapsed}
        onClick={() => onToggleFolder(folderId)}
        className="cockpit-file-tree__folder"
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        <span
          className={`cockpit-file-tree__caret${isCollapsed ? '' : ' cockpit-file-tree__caret--open'}`}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 2.5 6.5 5 3.5 7.5" />
          </svg>
        </span>
        <span className="cockpit-file-tree__label">{folder.label}</span>
      </button>
      {!isCollapsed ? (
        <ul>
          {folder.children.map((child, i) => (
            <Node
              key={`${i}-${child.label}`}
              node={child}
              depth={depth + 1}
              folderId={`${folderId}/${child.label}`}
              activePath={activePath}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
