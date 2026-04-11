/**
 * Vercel Serverless Function proxy for LangGraph Cloud.
 *
 * Deployed as api/[...path].js — catches all /api/* requests.
 * Injects x-api-key header from LANGSMITH_API_KEY env var.
 * Routes to the correct backend based on the Referer header.
 */
// Types only — Vercel provides these at runtime
type VercelRequest = { method?: string; headers: Record<string, string | undefined>; body: unknown; url?: string; query: Record<string, string | string[]> };
type VercelResponse = { setHeader(k: string, v: string): void; status(code: number): VercelResponse; json(body: unknown): void; write(chunk: string): void; end(): void; send(body: string): void };

const DEPLOYMENT_URLS: Record<string, string> = {
  'streaming': 'https://streaming-b01895ee8c8d5211967fba7a64c55db8.us.langgraph.app',
  'persistence': 'https://persistence-b4038c008b5e537787dda6a6774c8f91.us.langgraph.app',
  'interrupts': 'https://interrupts-8e1524d6d8fb558381eed4618129bc50.us.langgraph.app',
  'memory': 'https://memory-1b3234dbe2e55ba59010b3469be45a0a.us.langgraph.app',
  'durable-execution': 'https://durable-execution-123221d8b543545399d252dc6bd7de1b.us.langgraph.app',
  'subgraphs': 'https://subgraphs-c923bcb068c458b09d789f147875f426.us.langgraph.app',
  'time-travel': 'https://time-travel-f206148d75f45e75bf30002e68e1b14d.us.langgraph.app',
  'deployment-runtime': 'https://deployment-runtime-ce6aad33cc10505faca2b6137e76ba35.us.langgraph.app',
  'planning': 'https://planning-7ca04c65ce7650048ec0d16fb96a7638.us.langgraph.app',
  'filesystem': 'https://filesystem-2330285f57625bff8654bc026f70a6ae.us.langgraph.app',
  'da-subagents': 'https://da-subagents-31e4639441165df7848aaad426e61728.us.langgraph.app',
  'da-memory': 'https://da-memory-15f767adfa6f5cd48bd45a0fa4db29b5.us.langgraph.app',
  'skills': 'https://skills-802ff50f64325f1ea973cff1c97a49f9.us.langgraph.app',
  'sandboxes': 'https://sandboxes-8c70b6ac20265827aa92397299fcb9f7.us.langgraph.app',
  // Chat capabilities (URLs updated after first deployment)
  'c-a2ui': 'PENDING_DEPLOYMENT',
  'c-debug': 'PENDING_DEPLOYMENT',
  'c-generative-ui': 'PENDING_DEPLOYMENT',
  'c-input': 'PENDING_DEPLOYMENT',
  'c-interrupts': 'PENDING_DEPLOYMENT',
  'c-messages': 'PENDING_DEPLOYMENT',
  'c-subagents': 'PENDING_DEPLOYMENT',
  'c-theming': 'PENDING_DEPLOYMENT',
  'c-threads': 'PENDING_DEPLOYMENT',
  'c-timeline': 'PENDING_DEPLOYMENT',
  'c-tool-calls': 'PENDING_DEPLOYMENT',
  // Render capabilities
  'r-computed-functions': 'PENDING_DEPLOYMENT',
  'r-element-rendering': 'PENDING_DEPLOYMENT',
  'r-registry': 'PENDING_DEPLOYMENT',
  'r-repeat-loops': 'PENDING_DEPLOYMENT',
  'r-spec-rendering': 'PENDING_DEPLOYMENT',
  'r-state-management': 'PENDING_DEPLOYMENT',
};

const PATH_TO_KEY: Record<string, string> = {
  'langgraph/streaming': 'streaming',
  'langgraph/persistence': 'persistence',
  'langgraph/interrupts': 'interrupts',
  'langgraph/memory': 'memory',
  'langgraph/durable-execution': 'durable-execution',
  'langgraph/subgraphs': 'subgraphs',
  'langgraph/time-travel': 'time-travel',
  'langgraph/deployment-runtime': 'deployment-runtime',
  'deep-agents/planning': 'planning',
  'deep-agents/filesystem': 'filesystem',
  'deep-agents/subagents': 'da-subagents',
  'deep-agents/memory': 'da-memory',
  'deep-agents/skills': 'skills',
  'deep-agents/sandboxes': 'sandboxes',
  // Chat capabilities
  'chat/a2ui': 'c-a2ui',
  'chat/debug': 'c-debug',
  'chat/generative-ui': 'c-generative-ui',
  'chat/input': 'c-input',
  'chat/interrupts': 'c-interrupts',
  'chat/messages': 'c-messages',
  'chat/subagents': 'c-subagents',
  'chat/theming': 'c-theming',
  'chat/threads': 'c-threads',
  'chat/timeline': 'c-timeline',
  'chat/tool-calls': 'c-tool-calls',
  // Render capabilities
  'render/computed-functions': 'r-computed-functions',
  'render/element-rendering': 'r-element-rendering',
  'render/registry': 'r-registry',
  'render/repeat-loops': 'r-repeat-loops',
  'render/spec-rendering': 'r-spec-rendering',
  'render/state-management': 'r-state-management',
};

function resolveBackend(referer: string | undefined): string {
  if (referer) {
    try {
      const url = new URL(referer);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        const key = PATH_TO_KEY[`${segments[0]}/${segments[1]}`];
        if (key && DEPLOYMENT_URLS[key]) return DEPLOYMENT_URLS[key];
      }
    } catch { /* invalid referer */ }
  }
  return DEPLOYMENT_URLS['streaming'];
}

module.exports = async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, x-api-key, authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const apiKey = process.env['LANGSMITH_API_KEY'];
  if (!apiKey) {
    res.status(500).json({ error: 'LANGSMITH_API_KEY not configured' });
    return;
  }

  const backendUrl = resolveBackend(req.headers.referer);

  // Build target URL — extract path from req.url, stripping /api prefix
  const parsedUrl = new URL(req.url ?? '', `https://${req.headers.host ?? 'localhost'}`);
  const apiPath = parsedUrl.pathname.replace(/^\/api/, '') || '/';
  // Strip the Vercel catch-all query param, keep any real query params
  parsedUrl.searchParams.delete('[...path]');
  parsedUrl.searchParams.delete('[[...path]]');
  const cleanSearch = parsedUrl.searchParams.toString() ? `?${parsedUrl.searchParams.toString()}` : '';
  const targetUrl = `${backendUrl}${apiPath}${cleanSearch}`;

  // Debug endpoint
  if (apiPath === '/_proxy_debug') {
    return res.status(200).json({
      method: req.method,
      url: req.url,
      apiPath,
      targetUrl,
      backendUrl,
      referer: req.headers.referer,
      query: req.query,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 10),
    });
  }

  console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl}`);

  // Forward headers, inject API key
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'content-type': req.headers['content-type'] ?? 'application/json',
  };

  try {
    const response = await fetch(targetUrl, {
      method: req.method ?? 'GET',
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Stream the response back
    const contentType = response.headers.get('content-type') ?? 'application/json';
    res.setHeader('content-type', contentType);
    res.status(response.status);

    if (contentType.includes('text/event-stream')) {
      // SSE streaming — pipe the response body
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      }
      res.end();
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: (err as Error).message });
  }
}
