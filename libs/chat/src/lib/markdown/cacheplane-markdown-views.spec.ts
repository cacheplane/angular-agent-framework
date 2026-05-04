// libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { cacheplaneMarkdownViews } from './cacheplane-markdown-views';

describe('cacheplaneMarkdownViews', () => {
  it('registers all 22 markdown node types (v0.2 adds table, table-row, table-cell)', () => {
    expect(Object.keys(cacheplaneMarkdownViews).sort()).toEqual([
      'autolink',
      'blockquote',
      'citation-reference',
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
      'table',
      'table-cell',
      'table-row',
      'text',
      'thematic-break',
    ]);
  });

  it('is a frozen registry (immutable at runtime)', () => {
    expect(Object.isFrozen(cacheplaneMarkdownViews)).toBe(true);
  });
});
