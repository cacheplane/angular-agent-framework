export interface DocHeading {
  id: string;
  text: string;
  level: number;
}

/** Extract ## and ### headings from MDX source for TOC */
export function extractHeadings(source: string): DocHeading[] {
  const lines = source.split('\n');
  const headings: DocHeading[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const text = match[2].replace(/`/g, '');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ id, text, level: match[1].length });
    }
  }

  return headings;
}
