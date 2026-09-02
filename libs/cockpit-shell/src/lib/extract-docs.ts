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

function parseJsDocContent(raw: string): {
  description: string;
  params: DocParam[];
  returns: string | null;
} {
  const lines = raw.split('\n').map((line) => line.replace(/^\s*\*\s?/, ''));
  const params: DocParam[] = [];
  let returns: string | null = null;
  const descriptionLines: string[] = [];

  for (const line of lines) {
    const paramMatch = line.match(
      /^@param\s+(?:\{[^}]*\}\s+)?(?:-\s+)?(\w+)\s*[-–—]?\s*(.*)/
    );
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

function trimDeclarationSuffix(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) <= 32) end--;
  if (value[end - 1] === '{' || value[end - 1] === '=') end--;
  while (end > 0 && value.charCodeAt(end - 1) <= 32) end--;
  return value.slice(0, end);
}

function stripJsDocDelimiters(lines: readonly string[]): string {
  let value = lines.join('\n').trim();
  if (value.startsWith('/**')) value = value.slice(3);
  if (value.endsWith('*/')) value = value.slice(0, -2);
  return value.trim();
}

function isIdentifier(value: string): boolean {
  if (!value) return false;
  const first = value.charCodeAt(0);
  const validFirst =
    first === 95 ||
    (first >= 65 && first <= 90) ||
    (first >= 97 && first <= 122);
  if (!validFirst) return false;
  for (let index = 1; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (
      code !== 95 &&
      !(code >= 48 && code <= 57) &&
      !(code >= 65 && code <= 90) &&
      !(code >= 97 && code <= 122)
    ) {
      return false;
    }
  }
  return true;
}

function isHorizontalWhitespace(value: string, index: number): boolean {
  const code = value.charCodeAt(index);
  return code === 9 || code === 11 || code === 12 || code === 32;
}

function skipHorizontalWhitespace(value: string, index: number): number {
  while (index < value.length && isHorizontalWhitespace(value, index)) index++;
  return index;
}

function readPythonDeclaration(line: string): {
  name: string;
  signature: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed.endsWith(':')) return null;
  let nameStart: number;
  if (trimmed.startsWith('async')) {
    let cursor = 5;
    if (!isHorizontalWhitespace(trimmed, cursor)) return null;
    cursor = skipHorizontalWhitespace(trimmed, cursor);
    if (trimmed.slice(cursor, cursor + 3) !== 'def') return null;
    cursor += 3;
    if (!isHorizontalWhitespace(trimmed, cursor)) return null;
    nameStart = skipHorizontalWhitespace(trimmed, cursor);
  } else if (trimmed.startsWith('class')) {
    const cursor = 5;
    if (!isHorizontalWhitespace(trimmed, cursor)) return null;
    nameStart = skipHorizontalWhitespace(trimmed, cursor);
  } else if (trimmed.startsWith('def')) {
    const cursor = 3;
    if (!isHorizontalWhitespace(trimmed, cursor)) return null;
    nameStart = skipHorizontalWhitespace(trimmed, cursor);
  } else {
    return null;
  }
  let nameEnd = nameStart;
  while (nameEnd < trimmed.length) {
    const char = trimmed[nameEnd];
    if (
      char === '(' ||
      char === ':' ||
      char === '[' ||
      isHorizontalWhitespace(trimmed, nameEnd)
    ) {
      break;
    }
    nameEnd++;
  }
  const name = trimmed.slice(nameStart, nameEnd);
  if (!isIdentifier(name)) return null;
  return { name, signature: trimmed.slice(0, -1).trimEnd() };
}

function readPythonSectionLabel(
  line: string
): 'args' | 'returns' | 'attributes' | null {
  const value = line.trim();
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  const label = value.slice(0, separator).trimEnd();
  if (label === 'Args' || label === 'Arguments' || label === 'Parameters') {
    return 'args';
  }
  if (label === 'Return' || label === 'Returns') return 'returns';
  if (label === 'Attributes') return 'attributes';
  return null;
}

function parsePythonParam(line: string): DocParam | null {
  if (line.trimStart() === line) return null;
  const value = line.trim();
  let depth = 0;
  let separator = -1;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '(') depth++;
    else if (char === ')' && depth > 0) depth--;
    else if (depth === 0 && (char === ':' || char === '-')) {
      separator = index;
      break;
    }
  }
  if (separator < 0) return null;
  const declaration = value.slice(0, separator).trimEnd();
  const typeStart = declaration.indexOf('(');
  const name = (
    typeStart < 0 ? declaration : declaration.slice(0, typeStart)
  ).trim();
  if (!isIdentifier(name)) return null;
  return { name, description: value.slice(separator + 1).trim() };
}

/**
 * Extracts JSDoc blocks that precede export declarations or named members.
 * Captures the full signature line following the JSDoc block.
 */
export function extractTsDocSections(
  source: string,
  filePath: string
): DocSection[] {
  const sections: DocSection[] = [];
  const lines = source.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Find JSDoc start
    if (!lines[i].trimStart().startsWith('/**')) {
      i++;
      continue;
    }

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
        const signature = trimDeclarationSuffix(nextLine);
        const rawComment = stripJsDocDelimiters(jsDocLines);

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
export function extractPyDocSections(
  source: string,
  filePath: string
): DocSection[] {
  const sections: DocSection[] = [];
  const sourceLines = source.split('\n');

  for (let sourceIndex = 0; sourceIndex < sourceLines.length; sourceIndex++) {
    const declaration = readPythonDeclaration(sourceLines[sourceIndex]);
    if (!declaration) continue;
    let docIndex = sourceIndex + 1;
    while (docIndex < sourceLines.length && !sourceLines[docIndex].trim()) {
      docIndex++;
    }
    if (docIndex >= sourceLines.length) continue;
    const openingLine = sourceLines[docIndex].trim();
    if (!openingLine.startsWith('"""')) continue;

    const docLines: string[] = [];
    const remainder = openingLine.slice(3);
    const inlineClose = remainder.indexOf('"""');
    if (inlineClose >= 0) {
      docLines.push(remainder.slice(0, inlineClose));
    } else {
      if (remainder) docLines.push(remainder);
      docIndex++;
      while (docIndex < sourceLines.length) {
        const line = sourceLines[docIndex];
        const close = line.indexOf('"""');
        const content = close < 0 ? line : line.slice(0, close);
        docLines.push(content.startsWith('    ') ? content.slice(4) : content);
        if (close >= 0) break;
        docIndex++;
      }
      if (docIndex >= sourceLines.length) continue;
    }
    const rawDocstring = docLines.join('\n').trim();

    // Parse simple rst-style params (Args: / Returns:) or just use as description
    const lines = rawDocstring.split('\n');
    const descriptionLines: string[] = [];
    const params: DocParam[] = [];
    let returns: string | null = null;
    let inArgs = false;
    let inReturns = false;

    for (const line of lines) {
      const sectionLabel = readPythonSectionLabel(line);
      if (sectionLabel === 'args') {
        inArgs = true;
        inReturns = false;
        continue;
      }
      if (sectionLabel === 'returns') {
        inReturns = true;
        inArgs = false;
        continue;
      }
      if (sectionLabel === 'attributes') {
        inArgs = true;
        inReturns = false;
        continue;
      }
      if (line.trimStart() === line && !inArgs && !inReturns) {
        descriptionLines.push(line);
      } else if (inArgs) {
        const param = parsePythonParam(line);
        if (param) params.push(param);
      } else if (inReturns) {
        if (line.trim()) returns = (returns ? returns + ' ' : '') + line.trim();
      } else {
        descriptionLines.push(line);
      }
    }

    const description = descriptionLines.join('\n').trim();

    if (description) {
      sections.push({
        title: declaration.name,
        signature: declaration.signature,
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
