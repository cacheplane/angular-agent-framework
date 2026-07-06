import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import a2uiApiDocs from '../../../content/docs/a2ui/api/api-docs.json';
import langgraphApiDocs from '../../../content/docs/langgraph/api/api-docs.json';
import agUiApiDocs from '../../../content/docs/ag-ui/api/api-docs.json';
import chatApiDocs from '../../../content/docs/chat/api/api-docs.json';
import licensingApiDocs from '../../../content/docs/licensing/api/api-docs.json';
import middlewareApiDocs from '../../../content/docs/middleware/api/api-docs.json';
import renderApiDocs from '../../../content/docs/render/api/api-docs.json';
import telemetryApiDocs from '../../../content/docs/telemetry/api/api-docs.json';

const API_DOCS: Record<string, unknown> = {
  a2ui: a2uiApiDocs,
  'ag-ui': agUiApiDocs,
  langgraph: langgraphApiDocs,
  chat: chatApiDocs,
  licensing: licensingApiDocs,
  middleware: middlewareApiDocs,
  render: renderApiDocs,
  telemetry: telemetryApiDocs,
};

function loadApiDocs(): string {
  const sections = Object.entries(API_DOCS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([library, docs]) => `### ${library}\n\n${JSON.stringify(docs, null, 2)}`);

  return sections.length > 0
    ? sections.join('\n\n')
    : '(API reference not yet generated — run npm run generate-api-docs)';
}

function loadAllPrompts(): string {
  const roots = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'prompts'),
    path.join(process.cwd(), 'content', 'prompts'),
  ];
  const dir = roots.find((root) => fs.existsSync(root));
  if (!dir) return '(no prompt recipes found)';
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
    '# Threadplane — Full Reference\n\nSee /llms.txt for a compact summary.\n',
    '## API Reference (TypeDoc)\n\n' + loadApiDocs(),
    '## Prompt Recipes\n\n' + loadAllPrompts(),
    [
      '## Common Gotchas',
      '',
      'injectAgent() MUST be called inside an Angular injection context.',
      'Do not call it in ngOnInit — use constructor or field initializer.',
      'Do not mock injectAgent() in tests — use MockAgentTransport via provideAgent({ transport: new MockAgentTransport(...) }).',
      'RxJS is an internal implementation detail — do not import rxjs in consumer code.',
    ].join('\n'),
  ];

  return new NextResponse(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
