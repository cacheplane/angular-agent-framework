import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();
const MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6';
const DOCS_DIR = 'apps/website/content/docs';
const API_DOCS_ROOT = 'apps/website/content/docs';

const TOPICS = [
  {
    slug: 'introduction',
    prompt: 'Write an introduction to the Angular Agent Framework library. Explain what it does, who it is for, and why it exists. Include a minimal getting-started example.',
  },
  {
    slug: 'streaming',
    prompt: 'Explain how token-by-token streaming works with agent(). Cover the messages signal, how chunks arrive, and how Angular re-renders on each chunk.',
  },
  {
    slug: 'thread-persistence',
    prompt: 'Explain thread persistence in agent(). Cover threadId, onThreadId, and how to resume threads across page refreshes with localStorage.',
  },
  {
    slug: 'configuration',
    prompt: 'Explain provideAgent() and per-call configuration. Show how to set a global apiUrl and how to override it per-call.',
  },
  {
    slug: 'testing',
    prompt: 'Explain how to unit test components that use agent() with MockAgentTransport. Show a complete test example.',
  },
];

async function generateDoc(slug: string, prompt: string, apiDocsJson: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are writing documentation for the Angular Agent Framework library.
Here is the TypeDoc API reference JSON:\n\n${apiDocsJson}\n\n${prompt}

Write clean, developer-friendly MDX documentation. Use precise, no-fluff prose. Include code examples. Start with a single # heading.`,
    }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  return content.text;
}

function loadApiDocs(): string {
  if (!fs.existsSync(API_DOCS_ROOT)) {
    throw new Error('Run generate-api-docs first: npx tsx apps/website/scripts/generate-api-docs.ts');
  }

  const sections = fs.readdirSync(API_DOCS_ROOT)
    .sort()
    .map((library) => {
      const apiDocsPath = path.join(API_DOCS_ROOT, library, 'api', 'api-docs.json');
      if (!fs.existsSync(apiDocsPath)) return null;
      return `### ${library}\n\n${fs.readFileSync(apiDocsPath, 'utf8')}`;
    })
    .filter((section): section is string => section !== null);

  if (sections.length === 0) {
    throw new Error('Run generate-api-docs first: npx tsx apps/website/scripts/generate-api-docs.ts');
  }

  return sections.join('\n\n');
}

async function main() {
  const apiDocsJson = loadApiDocs();
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  for (const topic of TOPICS) {
    console.log(`Generating ${topic.slug}...`);
    const mdx = await generateDoc(topic.slug, topic.prompt, apiDocsJson);
    fs.writeFileSync(path.join(DOCS_DIR, `${topic.slug}.mdx`), mdx);
    console.log(`✓ ${topic.slug}.mdx`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
