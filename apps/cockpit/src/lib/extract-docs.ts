export interface DocParam {
  name: string;
  description: string;
}

export interface DocSection {
  title: string;
  signature: string;
  description: string;
  params: DocParam[];
  returns: string | null;
  sourceFile: string;
  language: 'typescript' | 'python';
}

function parseJsDocContent(raw: string): { description: string; params: DocParam[]; returns: string | null } {
  const lines = raw.split('\n').map((line) => line.replace(/^\s*\*\s?/, ''));
  const params: DocParam[] = [];
  let returns: string | null = null;
  const descriptionLines: string[] = [];

  for (const line of lines) {
    const paramMatch = line.match(/^@param\s+(?:\{[^}]*\}\s+)?(?:-\s+)?(\w+)\s*[-–—]?\s*(.*)/);
    const returnsMatch = line.match(/^@returns?\s+(.*)/);

    if (paramMatch) {
      params.push({ name: paramMatch[1], description: paramMatch[2].trim() });
    } else if (returnsMatch) {
      returns = returnsMatch[1].trim();
    } else if (!line.startsWith('@')) {
      descriptionLines.push(line);
    }
  }

  return { description: descriptionLines.join('\n').trim(), params, returns };
}

/**
 * Extracts JSDoc blocks that precede export declarations or named members.
 * Captures the full signature line following the JSDoc block.
 */
export function extractTsDocSections(source: string, filePath: string): DocSection[] {
  const sections: DocSection[] = [];
  const lines = source.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Find JSDoc start
    if (!lines[i].trimStart().startsWith('/**')) { i++; continue; }

    // Collect JSDoc block
    const jsDocLines: string[] = [];
    let j = i;
    while (j < lines.length) {
      jsDocLines.push(lines[j]);
      if (lines[j].includes('*/')) break;
      j++;
    }
    j++; // move past */

    // Skip blank lines after JSDoc
    while (j < lines.length && lines[j].trim() === '') j++;

    // Check if next non-blank line is a declaration we care about
    if (j < lines.length) {
      const nextLine = lines[j].trim();
      const declMatch = nextLine.match(
        /^(?:export\s+)?(?:class|function|interface|const|type|abstract\s+class)\s+(\w+)|^(?:(?:protected|private|public|readonly)\s+)*(\w+)\s*[=(]/
      );

      if (declMatch) {
        const name = declMatch[1] ?? declMatch[2] ?? 'unknown';
        // Signature is just this one line, cleaned up
        const signature = nextLine.replace(/\s*[{=]\s*$/, '').replace(/\s*\{$/, '');

        const rawComment = jsDocLines
          .join('\n')
          .replace(/^\s*\/\*\*\s*/, '')
          .replace(/\s*\*\/\s*$/, '');

        const { description, params, returns } = parseJsDocContent(rawComment);

        if (description) {
          sections.push({
            title: name,
            signature,
            description,
            params,
            returns,
            sourceFile: filePath,
            language: 'typescript',
          });
        }
      }
    }

    i = j > i ? j : i + 1;
  }

  return sections;
}

/**
 * Extracts Python docstrings from class and def declarations.
 * Captures the full def/class signature line.
 */
export function extractPyDocSections(source: string, filePath: string): DocSection[] {
  const sections: DocSection[] = [];
  const pattern = /((?:class|def)\s+(\w+)[^\n]*):\s*\n\s*"""([\s\S]*?)"""/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const signatureLine = match[1].trim();
    const name = match[2];
    const rawDocstring = match[3]
      .split('\n')
      .map((line) => line.replace(/^\s{4}/, ''))
      .join('\n')
      .trim();

    // Parse simple rst-style params (Args: / Returns:) or just use as description
    const lines = rawDocstring.split('\n');
    const descriptionLines: string[] = [];
    const params: DocParam[] = [];
    let returns: string | null = null;
    let inArgs = false;
    let inReturns = false;

    for (const line of lines) {
      if (/^(Args|Arguments|Parameters)\s*:/.test(line)) { inArgs = true; inReturns = false; continue; }
      if (/^(Returns?)\s*:/.test(line)) { inReturns = true; inArgs = false; continue; }
      if (/^(Attributes)\s*:/.test(line)) { inArgs = true; inReturns = false; continue; }
      if (/^\S/.test(line) && !inArgs && !inReturns) {
        descriptionLines.push(line);
      } else if (inArgs) {
        const paramMatch = line.match(/^\s+(\w+)\s*(?:\([^)]*\))?\s*[-:]\s*(.*)/);
        if (paramMatch) params.push({ name: paramMatch[1], description: paramMatch[2].trim() });
      } else if (inReturns) {
        if (line.trim()) returns = (returns ? returns + ' ' : '') + line.trim();
      } else {
        descriptionLines.push(line);
      }
    }

    const description = descriptionLines.join('\n').trim();

    if (description) {
      sections.push({
        title: name,
        signature: signatureLine,
        description,
        params,
        returns,
        sourceFile: filePath,
        language: 'python',
      });
    }
  }

  return sections;
}
