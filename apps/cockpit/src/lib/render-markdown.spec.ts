import { describe, expect, it, vi } from 'vitest';

const { mockCodeToHtml } = vi.hoisted(() => ({
  mockCodeToHtml: vi.fn(),
}));

vi.mock('shiki', () => ({
  codeToHtml: mockCodeToHtml,
}));

import { renderMarkdown } from './render-markdown';

describe('renderMarkdown', () => {
  it('converts markdown to HTML with headings and paragraphs', async () => {
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>highlighted</code></pre>');

    const md = `# Getting Started\n\nThis is a paragraph.\n\n## Step 1\n\nAnother paragraph.`;
    const result = await renderMarkdown(md);

    expect(result.title).toBe('Getting Started');
    expect(result.html).toContain('Getting Started');
    expect(result.html).toContain('This is a paragraph.');
  });

  it('highlights fenced code blocks with Shiki', async () => {
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>const x = 1;</code></pre>');

    const md = '# Test\n\n```typescript\nconst x = 1;\n```';
    const result = await renderMarkdown(md);

    expect(result.html).toContain('class="shiki"');
    expect(mockCodeToHtml).toHaveBeenCalled();
  });

  it('extracts title from first h1', async () => {
    const md = '# My Title\n\nContent here.';
    const result = await renderMarkdown(md);
    expect(result.title).toBe('My Title');
  });

  it('returns empty title when no h1 exists', async () => {
    const md = 'Just a paragraph.';
    const result = await renderMarkdown(md);
    expect(result.title).toBe('');
  });

  it('renders Summary blocks', async () => {
    const md = '# Test\n\n<Summary>\nBuild a streaming chat.\n</Summary>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-summary');
    expect(result.html).toContain('Build a streaming chat.');
  });

  it('renders Tip callout blocks', async () => {
    const md = '# Test\n\n<Tip>\nNo service layer needed.\n</Tip>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-callout');
    expect(result.html).toContain('doc-callout--tip');
    expect(result.html).toContain('No service layer needed.');
  });

  it('renders Note callout blocks', async () => {
    const md = '# Test\n\n<Note>\nInjection context required.\n</Note>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-callout--note');
  });

  it('renders Warning callout blocks', async () => {
    const md = '# Test\n\n<Warning>\nDo not expose API keys.\n</Warning>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-callout--warning');
  });

  it('renders Steps with numbered step indicators', async () => {
    const md = '# Test\n\n<Steps>\n<Step title="First step">\n\nDo this first.\n\n</Step>\n<Step title="Second step">\n\nThen this.\n\n</Step>\n</Steps>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-steps');
    expect(result.html).toContain('doc-step');
    expect(result.html).toContain('First step');
    expect(result.html).toContain('Second step');
    expect(result.html).toContain('doc-step__number');
  });

  it('renders Prompt blocks with copy button', async () => {
    const md = '# Test\n\n<Prompt>\nAdd streaming to this component.\n</Prompt>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-prompt');
    expect(result.html).toContain('Add streaming to this component.');
    expect(result.html).toContain('data-copy-prompt');
  });

  it('renders ApiTable blocks as styled tables', async () => {
    const md = '# Test\n\n<ApiTable>\n| Signal | Type |\n|--------|------|\n| `messages()` | `BaseMessage[]` |\n</ApiTable>';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-api-table');
    expect(result.html).toContain('messages()');
  });

  it('wraps code blocks with filename header when first line is a comment', async () => {
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>code</code></pre>');
    const md = '# Test\n\n```typescript\n// app.config.ts\nconst x = 1;\n```';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('doc-codeblock__header');
    expect(result.html).toContain('app.config.ts');
    expect(result.html).toContain('data-copy-code');
  });
});
