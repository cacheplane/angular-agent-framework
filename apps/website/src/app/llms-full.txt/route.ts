import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function loadApiDocs(): string {
  const roots = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'docs'),
    path.join(process.cwd(), 'content', 'docs'),
  ];

  const docsRoot = roots.find((root) => fs.existsSync(root));
  if (!docsRoot) {
    return '(API reference not yet generated — run npm run generate-api-docs)';
  }

  const sections = fs.readdirSync(docsRoot)
    .sort()
    .map((library) => {
      const apiDocsPath = path.join(docsRoot, library, 'api', 'api-docs.json');
      if (!fs.existsSync(apiDocsPath)) return null;
      const raw = fs.readFileSync(apiDocsPath, 'utf8');
      return `### ${library}\n\n${raw}`;
    })
    .filter((section): section is string => section !== null);

  return sections.length > 0
    ? sections.join('\n\n')
    : '(API reference not yet generated — run npm run generate-api-docs)';
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
  ];

  return new NextResponse(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
