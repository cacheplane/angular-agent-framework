// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from './route';

function ctx(params: { library: string; section: string; slug: string }) {
  return { params: Promise.resolve(params) };
}

describe('GET /api/markdown/[library]/[section]/[slug]', () => {
  it('returns the raw mdx for a known page as text/markdown', async () => {
    const res = await GET(
      new Request('http://localhost/api/markdown/langgraph/getting-started/introduction'),
      ctx({ library: 'langgraph', section: 'getting-started', slug: 'introduction' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('# Introduction');
  });

  it('404s for an unknown page', async () => {
    const res = await GET(
      new Request('http://localhost/api/markdown/langgraph/getting-started/does-not-exist'),
      ctx({ library: 'langgraph', section: 'getting-started', slug: 'does-not-exist' }),
    );
    expect(res.status).toBe(404);
  });
});
