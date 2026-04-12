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
  // Chat capabilities
  'c-a2ui': 'https://c-a2ui-8e9f0ef287d25d2fb134d7f881570d1c.us.langgraph.app',
  'c-debug': 'https://c-debug-98cf2d0aa084584c93cbd6c40ab260bd.us.langgraph.app',
  'c-generative-ui': 'https://c-generative-ui-8ad5bc56908f5a45b033bd8258d61bb1.us.langgraph.app',
  'c-input': 'https://c-input-5b25fd46dcdf5e0086fa4ef01349e332.us.langgraph.app',
  'c-interrupts': 'https://c-interrupts-fdb30735b73352ddbf58f7388ae5fce5.us.langgraph.app',
  'c-messages': 'https://c-messages-46ae9adfa13e5ebeae5b3b6e6a03038e.us.langgraph.app',
  'c-subagents': 'https://c-subagents-687f67b7a44257f096f9c700a9982b33.us.langgraph.app',
  'c-theming': 'https://c-theming-d76a27db156351b4936f4b6a995519db.us.langgraph.app',
  'c-threads': 'https://c-threads-d14fe73520c353c89c3c45529c284646.us.langgraph.app',
  'c-timeline': 'https://c-timeline-f53431e515ca54dea03f08f7f75e344c.us.langgraph.app',
  'c-tool-calls': 'https://c-tool-calls-6541936001185fb88f83888136d36b5b.us.langgraph.app',
  // Render capabilities
  'r-computed-functions': 'https://r-computed-functions-d13875d7991f586f986f8fa78b3b5150.us.langgraph.app',
  'r-element-rendering': 'https://r-element-rendering-72a833e9aeb1504aa1b2f62283fe7d0d.us.langgraph.app',
  'r-registry': 'https://r-registry-8dfd9a501a9d554aad4a63b4b5eb7d63.us.langgraph.app',
  'r-repeat-loops': 'https://r-repeat-loops-3d57704b1c4b5af999beab9f300dc81e.us.langgraph.app',
  'r-spec-rendering': 'https://r-spec-rendering-92ee35b6e8565f0c87eed4e8de085f28.us.langgraph.app',
  'r-state-management': 'https://r-state-management-298d402c1f3b5a729ef1872e3d6b83be.us.langgraph.app',
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
  // Chat capabilities — routed through the streaming deployment which has
  // all chat graphs consolidated in its langgraph.json (PR #113).
  'chat/a2ui': 'streaming',
  'chat/debug': 'streaming',
  'chat/generative-ui': 'streaming',
  'chat/input': 'streaming',
  'chat/interrupts': 'streaming',
  'chat/messages': 'streaming',
  'chat/subagents': 'streaming',
  'chat/theming': 'streaming',
  'chat/threads': 'streaming',
  'chat/timeline': 'streaming',
  'chat/tool-calls': 'streaming',
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
