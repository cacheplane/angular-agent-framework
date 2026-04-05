import { marked } from 'marked';
import { codeToHtml } from 'shiki';

export interface RenderedMarkdown {
  title: string;
  html: string;
}

interface ExtractedBlock {
  placeholder: string;
  type: string;
  content: string;
  attrs: Record<string, string>;
}

const COMPONENT_TAGS = ['Summary', 'Tip', 'Note', 'Warning', 'Prompt', 'ApiTable', 'Step', 'Steps'];

function extractComponentTags(source: string): { cleaned: string; blocks: ExtractedBlock[] } {
  const blocks: ExtractedBlock[] = [];
  let cleaned = source;
  let idx = 0;

  for (const tag of COMPONENT_TAGS) {
    const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
    cleaned = cleaned.replace(pattern, (_match, rawAttrs, content) => {
      const placeholder = `<!--COMPONENT_${idx}-->`;
      const attrs: Record<string, string> = {};
      if (rawAttrs) {
        const attrPattern = /(\w+)="([^"]*)"/g;
        let attrMatch;
        while ((attrMatch = attrPattern.exec(rawAttrs)) !== null) {
          attrs[attrMatch[1]] = attrMatch[2];
        }
      }
      blocks.push({ placeholder, type: tag, content: content.trim(), attrs });
      idx++;
      return placeholder;
    });
  }

  return { cleaned, blocks };
}

function renderSummary(content: string): string {
  return `<div class="doc-summary">${content}</div>`;
}

function renderCallout(type: 'tip' | 'note' | 'warning', content: string): string {
  const icons = { tip: '💡', note: '⚠️', warning: '🚨' };
  const labels = { tip: 'Tip', note: 'Note', warning: 'Warning' };
  return `<div class="doc-callout doc-callout--${type}"><div class="doc-callout__label">${icons[type]} ${labels[type]}</div><div class="doc-callout__content">${content}</div></div>`;
}

async function renderSteps(
  content: string,
  allBlocks: ExtractedBlock[],
): Promise<string> {
  let resolved = content;
  let stepNum = 0;
  for (const block of allBlocks) {
    if (block.type === 'Step' && resolved.includes(block.placeholder)) {
      stepNum++;
      const parsedContent = await parseStepContent(block.content);
      const stepHtml = `<div class="doc-step"><div class="doc-step__indicator"><div class="doc-step__number">${stepNum}</div><div class="doc-step__line"></div></div><div class="doc-step__body"><div class="doc-step__title">${block.attrs['title'] ?? `Step ${stepNum}`}</div><div class="doc-step__content">${parsedContent}</div></div></div>`;
      resolved = resolved.replace(block.placeholder, stepHtml);
    }
  }
  return `<div class="doc-steps">${resolved}</div>`;
}

async function parseStepContent(
  content: string,
): Promise<string> {
  const stepCodeBlocks: Array<{ lang: string; code: string; placeholder: string }> = [];
  let idx = 0;

  const stepRenderer = new marked.Renderer();
  stepRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const placeholder = `<!--STEP_SHIKI_${idx}-->`;
    stepCodeBlocks.push({ lang: lang ?? 'text', code: text, placeholder });
    idx++;
    return placeholder;
  };

  let html = await marked.parse(content, { renderer: stepRenderer });

  for (const block of stepCodeBlocks) {
    const { filename, cleanedCode } = extractFilename(block.code);
    const codeToHighlight = filename ? cleanedCode : block.code;
    let highlighted: string;
    try {
      highlighted = await codeToHtml(codeToHighlight, { lang: block.lang, theme: 'tokyo-night' });
    } catch {
      const escaped = codeToHighlight.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      highlighted = `<pre><code>${escaped}</code></pre>`;
    }
    html = html.replace(block.placeholder, wrapCodeBlock(highlighted, block.lang, filename));
  }

  return html;
}

function renderPrompt(content: string): string {
  return `<div class="doc-prompt"><div class="doc-prompt__header"><span class="doc-prompt__label">🤖 Agentic Prompt</span><button class="doc-prompt__copy" data-copy-prompt>Copy prompt</button></div><div class="doc-prompt__content">${content}</div></div>`;
}

function renderApiTable(content: string): string {
  return `<div class="doc-api-table">${content}</div>`;
}

function extractFilename(code: string): { filename: string | null; cleanedCode: string } {
  const firstLine = code.split('\n')[0];
  const tsMatch = firstLine?.match(/^\/\/\s*(.+\.\w+)\s*$/);
  if (tsMatch) {
    return { filename: tsMatch[1], cleanedCode: code.split('\n').slice(1).join('\n') };
  }
  const pyMatch = firstLine?.match(/^#\s*(.+\.\w+)\s*$/);
  if (pyMatch) {
    return { filename: pyMatch[1], cleanedCode: code.split('\n').slice(1).join('\n') };
  }
  return { filename: null, cleanedCode: code };
}

function wrapCodeBlock(shikiHtml: string, lang: string, filename: string | null): string {
  const langLabel = lang !== 'text' ? `<span class="doc-codeblock__lang">${lang}</span>` : '';
  const fileLabel = filename ? `<span class="doc-codeblock__file">${filename}</span>` : '';
  const header = (fileLabel || langLabel)
    ? `<div class="doc-codeblock__header">${fileLabel}${langLabel}<button class="doc-codeblock__copy" data-copy-code>Copy</button></div>`
    : '';
  return `<div class="doc-codeblock">${header}${shikiHtml}</div>`;
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const titleMatch = source.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? '';

  const { cleaned, blocks } = extractComponentTags(source);

  const codeBlocks: Array<{ lang: string; code: string; placeholder: string }> = [];
  let codeIdx = 0;

  const renderer = new marked.Renderer();
  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const placeholder = `<!--SHIKI_BLOCK_${codeIdx}-->`;
    codeBlocks.push({ lang: lang ?? 'text', code: text, placeholder });
    codeIdx++;
    return placeholder;
  };

  let html = await marked.parse(cleaned, { renderer });

  for (const block of codeBlocks) {
    const { filename, cleanedCode } = extractFilename(block.code);
    const codeToHighlight = filename ? cleanedCode : block.code;
    let highlighted: string;
    try {
      highlighted = await codeToHtml(codeToHighlight, { lang: block.lang, theme: 'tokyo-night' });
    } catch {
      const escaped = codeToHighlight.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      highlighted = `<pre><code>${escaped}</code></pre>`;
    }
    html = html.replace(block.placeholder, wrapCodeBlock(highlighted, block.lang, filename));
  }

  for (const block of blocks) {
    if (!html.includes(block.placeholder)) continue;
    let rendered: string;
    switch (block.type) {
      case 'Summary': rendered = renderSummary(block.content); break;
      case 'Tip': rendered = renderCallout('tip', block.content); break;
      case 'Note': rendered = renderCallout('note', block.content); break;
      case 'Warning': rendered = renderCallout('warning', block.content); break;
      case 'Steps': rendered = await renderSteps(block.content, blocks); break;
      case 'Step': rendered = ''; break;
      case 'Prompt': rendered = renderPrompt(block.content); break;
      case 'ApiTable': {
        const tableHtml = await marked.parse(block.content);
        rendered = renderApiTable(tableHtml);
        break;
      }
      default: rendered = block.content;
    }
    html = html.replace(block.placeholder, rendered);
  }

  return { title, html };
}
