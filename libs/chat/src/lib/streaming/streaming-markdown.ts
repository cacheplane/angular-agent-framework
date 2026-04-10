// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface StreamingMarkdownRenderer {
  /** Push a text delta (not full content). Appends to the live DOM. */
  push(delta: string): void;
  /** Get the container element with all rendered content */
  readonly container: HTMLElement;
  /** Reset for a new message */
  reset(): void;
  /** Signal the stream is complete — flush any buffered content */
  finish(): void;
}

// ---------------------------------------------------------------------------
// Inline formatting parser
// ---------------------------------------------------------------------------

/**
 * Parse inline markdown formatting and append DOM nodes to the given parent.
 * Handles: **bold**, *italic*, `code`, [text](url)
 */
function parseInline(text: string, parent: Node): void {
  let i = 0;
  let plainStart = i;

  const flushPlain = (end: number): void => {
    if (end > plainStart) {
      parent.appendChild(document.createTextNode(text.slice(plainStart, end)));
    }
  };

  while (i < text.length) {
    // Bold **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const closeIdx = text.indexOf('**', i + 2);
      if (closeIdx !== -1) {
        flushPlain(i);
        const strong = document.createElement('strong');
        parseInline(text.slice(i + 2, closeIdx), strong);
        parent.appendChild(strong);
        i = closeIdx + 2;
        plainStart = i;
        continue;
      }
    }

    // Italic *...*  (but not **)
    if (text[i] === '*' && text[i + 1] !== '*') {
      // Find closing * that is not part of **
      let closeIdx = -1;
      for (let j = i + 1; j < text.length; j++) {
        if (text[j] === '*' && text[j + 1] !== '*' && (j === 0 || text[j - 1] !== '*')) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx !== -1) {
        flushPlain(i);
        const em = document.createElement('em');
        parseInline(text.slice(i + 1, closeIdx), em);
        parent.appendChild(em);
        i = closeIdx + 1;
        plainStart = i;
        continue;
      }
    }

    // Inline code `...`
    if (text[i] === '`') {
      const closeIdx = text.indexOf('`', i + 1);
      if (closeIdx !== -1) {
        flushPlain(i);
        const code = document.createElement('code');
        code.textContent = text.slice(i + 1, closeIdx);
        parent.appendChild(code);
        i = closeIdx + 1;
        plainStart = i;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          flushPlain(i);
          const linkText = text.slice(i + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen);
          const a = document.createElement('a');
          a.href = href;
          parseInline(linkText, a);
          parent.appendChild(a);
          i = closeParen + 1;
          plainStart = i;
          continue;
        }
      }
    }

    i++;
  }

  flushPlain(i);
}

// ---------------------------------------------------------------------------
// Table parsing
// ---------------------------------------------------------------------------

interface TableData {
  headers: string[];
  alignments: ('left' | 'center' | 'right' | null)[];
  rows: string[][];
}

function parseTableLines(lines: string[]): TableData | null {
  if (lines.length < 2) return null;

  const parseCells = (line: string): string[] => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    return trimmed.split('|').map((c) => c.trim());
  };

  const headers = parseCells(lines[0]);
  const separatorCells = parseCells(lines[1]);

  // Validate separator row (must contain only dashes, colons, spaces)
  const isSeparator = separatorCells.every((cell) => /^:?-+:?$/.test(cell));
  if (!isSeparator) return null;

  const alignments = separatorCells.map((cell): 'left' | 'center' | 'right' | null => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });

  const rows = lines.slice(2).map(parseCells);

  return { headers, alignments, rows };
}

function renderTable(data: TableData): HTMLTableElement {
  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (let i = 0; i < data.headers.length; i++) {
    const th = document.createElement('th');
    if (data.alignments[i]) {
      th.style.textAlign = data.alignments[i]!;
    }
    parseInline(data.headers[i], th);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  if (data.rows.length > 0) {
    const tbody = document.createElement('tbody');
    for (const row of data.rows) {
      const tr = document.createElement('tr');
      for (let i = 0; i < row.length; i++) {
        const td = document.createElement('td');
        if (data.alignments[i]) {
          td.style.textAlign = data.alignments[i]!;
        }
        parseInline(row[i], td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  return table;
}

// ---------------------------------------------------------------------------
// Line type detection
// ---------------------------------------------------------------------------

type LineType =
  | 'heading'
  | 'ul'
  | 'ol'
  | 'blockquote'
  | 'fence'
  | 'table-row'
  | 'blank'
  | 'paragraph';

function classifyLine(line: string): LineType {
  if (line.trim() === '') return 'blank';
  if (/^```/.test(line)) return 'fence';
  if (/^#{1,4}\s/.test(line)) return 'heading';
  if (/^[-*]\s/.test(line)) return 'ul';
  if (/^\d+\.\s/.test(line)) return 'ol';
  if (/^>\s?/.test(line)) return 'blockquote';
  if (/^\|/.test(line)) return 'table-row';
  return 'paragraph';
}

// ---------------------------------------------------------------------------
// Streaming markdown renderer
// ---------------------------------------------------------------------------

export function createStreamingMarkdownRenderer(): StreamingMarkdownRenderer {
  const container = document.createElement('div');
  container.className = 'chat-md';

  // Internal state
  let buffer = '';
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent = '';

  // Current open block-level element tracking
  let currentParagraph: HTMLParagraphElement | null = null;
  let currentList: HTMLUListElement | HTMLOListElement | null = null;
  let currentListType: 'ul' | 'ol' | null = null;
  let currentBlockquote: HTMLQuoteElement | null = null;

  // Table buffering
  let tableBuffer: string[] = [];
  let inTable = false;

  // ---------------------------------------------------------------------------
  // Block-level element management
  // ---------------------------------------------------------------------------

  function closeParagraph(): void {
    currentParagraph = null;
  }

  function closeList(): void {
    currentList = null;
    currentListType = null;
  }

  function closeBlockquote(): void {
    currentBlockquote = null;
  }

  function flushTable(): void {
    if (tableBuffer.length === 0) return;
    const data = parseTableLines(tableBuffer);
    if (data) {
      container.appendChild(renderTable(data));
    } else {
      // Not a valid table — render lines as paragraphs
      for (const line of tableBuffer) {
        const p = document.createElement('p');
        parseInline(line, p);
        container.appendChild(p);
      }
    }
    tableBuffer = [];
    inTable = false;
  }

  function closeAllBlocks(): void {
    closeParagraph();
    closeList();
    closeBlockquote();
    if (inTable) flushTable();
  }

  // ---------------------------------------------------------------------------
  // Line processing
  // ---------------------------------------------------------------------------

  function processLine(line: string): void {
    // Inside fenced code block — buffer until closing fence
    if (inCodeBlock) {
      if (/^```/.test(line)) {
        // Close code block — render it
        inCodeBlock = false;
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        if (codeBlockLang) {
          code.className = `language-${codeBlockLang}`;
        }
        code.textContent = codeBlockContent;
        pre.appendChild(code);
        container.appendChild(pre);
        codeBlockContent = '';
        codeBlockLang = '';
      } else {
        codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      }
      return;
    }

    const type = classifyLine(line);

    // Table continuity: if we're in a table and get a non-table, non-blank line, flush
    if (inTable && type !== 'table-row' && type !== 'blank') {
      flushTable();
    }

    switch (type) {
      case 'blank': {
        if (inTable) {
          flushTable();
        }
        closeAllBlocks();
        break;
      }

      case 'fence': {
        closeAllBlocks();
        inCodeBlock = true;
        const langMatch = line.match(/^```(\w*)/);
        codeBlockLang = langMatch ? langMatch[1] : '';
        break;
      }

      case 'heading': {
        closeAllBlocks();
        const match = line.match(/^(#{1,4})\s+(.*)/);
        if (match) {
          const level = match[1].length as 1 | 2 | 3 | 4;
          const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
          const heading = document.createElement(tag);
          parseInline(match[2], heading);
          container.appendChild(heading);
        }
        break;
      }

      case 'ul': {
        closeParagraph();
        closeBlockquote();
        if (inTable) flushTable();

        if (!currentList || currentListType !== 'ul') {
          closeList();
          currentList = document.createElement('ul');
          currentListType = 'ul';
          container.appendChild(currentList);
        }
        const li = document.createElement('li');
        const content = line.replace(/^[-*]\s/, '');
        parseInline(content, li);
        currentList.appendChild(li);
        break;
      }

      case 'ol': {
        closeParagraph();
        closeBlockquote();
        if (inTable) flushTable();

        if (!currentList || currentListType !== 'ol') {
          closeList();
          currentList = document.createElement('ol');
          currentListType = 'ol';
          container.appendChild(currentList);
        }
        const li = document.createElement('li');
        const content = line.replace(/^\d+\.\s/, '');
        parseInline(content, li);
        currentList.appendChild(li);
        break;
      }

      case 'blockquote': {
        closeParagraph();
        closeList();
        if (inTable) flushTable();

        if (!currentBlockquote) {
          currentBlockquote = document.createElement('blockquote');
          container.appendChild(currentBlockquote);
        }
        const content = line.replace(/^>\s?/, '');
        const p = document.createElement('p');
        parseInline(content, p);
        currentBlockquote.appendChild(p);
        break;
      }

      case 'table-row': {
        closeParagraph();
        closeList();
        closeBlockquote();
        inTable = true;
        tableBuffer.push(line);
        break;
      }

      case 'paragraph': {
        closeList();
        closeBlockquote();
        if (inTable) flushTable();

        if (!currentParagraph) {
          currentParagraph = document.createElement('p');
          container.appendChild(currentParagraph);
        } else {
          // Continuation of paragraph — add a space or newline
          currentParagraph.appendChild(document.createTextNode(' '));
        }
        parseInline(line, currentParagraph);
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function push(delta: string): void {
    buffer += delta;

    // Process complete lines from the buffer
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      processLine(line);
    }
  }

  function finish(): void {
    // Flush remaining buffer as a final line
    if (buffer.length > 0) {
      processLine(buffer);
      buffer = '';
    }

    // Close any open code block
    if (inCodeBlock) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (codeBlockLang) {
        code.className = `language-${codeBlockLang}`;
      }
      code.textContent = codeBlockContent;
      pre.appendChild(code);
      container.appendChild(pre);
      inCodeBlock = false;
      codeBlockContent = '';
      codeBlockLang = '';
    }

    // Flush table if buffered
    if (inTable) {
      flushTable();
    }

    closeAllBlocks();
  }

  function reset(): void {
    container.innerHTML = '';
    buffer = '';
    inCodeBlock = false;
    codeBlockLang = '';
    codeBlockContent = '';
    currentParagraph = null;
    currentList = null;
    currentListType = null;
    currentBlockquote = null;
    tableBuffer = [];
    inTable = false;
  }

  return {
    push,
    get container() {
      return container;
    },
    reset,
    finish,
  };
}
