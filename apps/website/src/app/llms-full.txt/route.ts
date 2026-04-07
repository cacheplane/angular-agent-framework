import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadApiDocs(): string {
  // process.cwd() = apps/website/ in Nx Next.js context
  const p = path.join(process.cwd(), 'public', 'api-docs.json');
  if (!fs.existsSync(p)) {
    return '(API reference not yet generated — run npm run generate-docs)';
  }
  const raw = fs.readFileSync(p, 'utf8');
  return raw;
}

function loadAllPrompts(): string {
  const dir = path.join(process.cwd(), 'content', 'prompts');
  if (!fs.existsSync(dir)) return '(no prompt recipes found)';
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const content = fs.readFileSync(path.join(dir, f), 'utf8').trim();
      return `## Prompt: ${slug}\n\n${content}`;
    })
    .join('\n\n---\n\n');
}

export async function GET() {
  const sections = [
    '# Angular Agent Framework — Full Reference\n\nSee /llms.txt for a compact summary.\n',
    '## API Reference (TypeDoc)\n\n' + loadApiDocs(),
    '## Prompt Recipes\n\n' + loadAllPrompts(),
    [
      '## Common Gotchas',
      '',
      'agent() MUST be called inside an Angular injection context.',
      'Do not call it in ngOnInit — use constructor or field initializer.',
      'Do not mock agent() in tests — use MockAgentTransport.',
      'RxJS is an internal implementation detail — do not import rxjs in consumer code.',
    ].join('\n'),
    [
      '## MCP server',
      '',
      'npx @cacheplane/angular-mcp',
      'Add to Claude Code settings.json, Cursor .cursor/mcp.json, or any MCP-compatible agent.',
    ].join('\n'),
  ];

  return new NextResponse(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
