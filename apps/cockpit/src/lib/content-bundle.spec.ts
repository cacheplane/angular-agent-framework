import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRuntimeUrl, getContentBundle } from './content-bundle';
import type { CapabilityPresentation } from './route-resolution';

// Stable mock function references, hoisted so vi.mock factories can access them
const { mockReadFileSync, mockCodeToHtml } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockCodeToHtml: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: { ...actual, readFileSync: mockReadFileSync },
    readFileSync: mockReadFileSync,
  };
});

vi.mock('shiki', () => ({
  default: { codeToHtml: mockCodeToHtml },
  codeToHtml: mockCodeToHtml,
}));

describe('resolveRuntimeUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', 'https://examples.cacheplane.ai');
    expect(
      resolveRuntimeUrl({ runtimeUrl: 'langgraph/streaming', devPort: 4300 })
    ).toBe('https://examples.cacheplane.ai/langgraph/streaming');
  });

  it('falls back to localhost with devPort when no env var is set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    expect(
      resolveRuntimeUrl({ runtimeUrl: 'langgraph/streaming', devPort: 4300 })
    ).toBe('http://localhost:4300');
  });

  it('returns null when neither env var nor devPort is available', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    expect(
      resolveRuntimeUrl({ runtimeUrl: undefined, devPort: undefined })
    ).toBeNull();
  });

  it('returns null when runtimeUrl is undefined even with env var set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', 'https://examples.cacheplane.ai');
    expect(
      resolveRuntimeUrl({ runtimeUrl: undefined, devPort: undefined })
    ).toBeNull();
  });
});

describe('getContentBundle', () => {
  afterEach(() => {
    mockReadFileSync.mockReset();
    mockCodeToHtml.mockReset();
    vi.unstubAllEnvs();
  });

  it('returns highlighted code and raw prompt content for a capability presentation', async () => {
    mockReadFileSync.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.includes('index.ts')) return 'const x = 1;';
      if (p.includes('streaming.md')) return '# Streaming prompt';
      throw new Error(`ENOENT: ${filePath}`);
    });
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>highlighted</code></pre>');

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
      codeAssetPaths: ['cockpit/langgraph/streaming/python/src/index.ts'],
      runtimeUrl: 'langgraph/streaming',
      devPort: 4300,
    } as any;

    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    const bundle = await getContentBundle(presentation);

    expect(Object.keys(bundle.codeFiles)).toContain('cockpit/langgraph/streaming/python/src/index.ts');
    expect(bundle.codeFiles['cockpit/langgraph/streaming/python/src/index.ts']).toBe(
      '<pre class="shiki"><code>highlighted</code></pre>'
    );
    expect(bundle.promptFiles).toEqual({
      'cockpit/langgraph/streaming/python/prompts/streaming.md': '# Streaming prompt',
    });
    expect(bundle.runtimeUrl).toBe('http://localhost:4300');
    expect(bundle.docSections).toEqual([]);
    expect(bundle.narrativeDocs).toEqual([]);
  });

  it('returns a placeholder string when a code file is missing', async () => {
    mockReadFileSync.mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: [],
      codeAssetPaths: ['missing/file.ts'],
      runtimeUrl: undefined,
      devPort: undefined,
    } as any;

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles['missing/file.ts']).toBe('File not found: missing/file.ts');
    expect(bundle.runtimeUrl).toBeNull();
    expect(bundle.docSections).toEqual([]);
    expect(bundle.narrativeDocs).toEqual([]);
  });

  it('falls back to unhighlighted code when Shiki fails', async () => {
    mockReadFileSync.mockReturnValue('const y = 2;');
    mockCodeToHtml.mockRejectedValue(new Error('Shiki error'));

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: [],
      codeAssetPaths: ['some/file.ts'],
      runtimeUrl: undefined,
      devPort: undefined,
    } as any;

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles['some/file.ts']).toBe(
      '<pre><code>const y = 2;</code></pre>'
    );
    expect(bundle.docSections).toEqual([]);
    expect(bundle.narrativeDocs).toEqual([]);
  });

  it('returns empty maps for a docs-only presentation', async () => {
    const presentation: CapabilityPresentation = {
      kind: 'docs-only',
      entry: {} as any,
      docsPath: '/docs/test',
    };

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles).toEqual({});
    expect(bundle.promptFiles).toEqual({});
    expect(bundle.runtimeUrl).toBeNull();
    expect(bundle.docSections).toEqual([]);
    expect(bundle.narrativeDocs).toEqual([]);
  });

  it('extracts docSections from code and backend files', async () => {
    mockReadFileSync.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.includes('streaming.component.ts')) return '/**\n * StreamingComponent renders a chat UI.\n */\nexport class StreamingComponent {}';
      if (p.includes('graph.py')) return 'class StreamingGraph:\n    """Streams LLM responses."""\n    pass';
      if (p.includes('streaming.md')) return '# Prompt';
      throw new Error('ENOENT');
    });
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>highlighted</code></pre>');

    const presentation = {
      kind: 'capability' as const,
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: ['prompts/streaming.md'],
      codeAssetPaths: ['src/streaming.component.ts'],
      backendAssetPaths: ['src/graph.py'],
      runtimeUrl: undefined,
      devPort: undefined,
    };

    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    const bundle = await getContentBundle(presentation);

    expect(bundle.docSections).toHaveLength(2);
    expect(bundle.docSections[0].title).toBe('StreamingComponent');
    expect(bundle.docSections[0].language).toBe('typescript');
    expect(bundle.docSections[1].title).toBe('StreamingGraph');
    expect(bundle.docSections[1].language).toBe('python');
    expect(bundle.narrativeDocs).toEqual([]);
  });
});
