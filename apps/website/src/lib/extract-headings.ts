export interface DocHeading {
  id: string;
  text: string;
  level: number;
  /**
   * Zero-based index of this heading's own line in the source passed to
   * `extractHeadings`. Additive: existing callers (the TOC, PageActions)
   * destructure only `id`/`text`/`level` and are unaffected. It exists so a
   * second consumer (the search indexer) can split a document into sections
   * without re-scanning for headings itself — see `indexDocSections` in
   * `docs-search-index.ts`, which is the reason this field was added.
   */
  line: number;
}

/** Extract ## and ### headings from MDX source for TOC */
export function extractHeadings(source: string): DocHeading[] {
  const lines = source.split('\n');
  const headings: DocHeading[] = [];
  let inCodeBlock = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const text = match[2].replace(/`/g, '');
      // Match rehype-slug's GitHub-style slugification
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
      headings.push({ id, text, level: match[1].length, line: index });
    }
  });

  return headings;
}
