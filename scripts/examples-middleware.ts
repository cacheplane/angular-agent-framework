/**
 * Vercel Serverless Function proxy for LangGraph Cloud.
 *
 * Deployed as api/[...path].js - catches all /api/* requests.
  * Injects x-api-key header from LANGSMITH_API_KEY env var.
  * Routes active product paths to the shared cockpit dev backend based on the
  * Referer header.
  */
// Types only - Vercel provides these at runtime
type VercelRequest = {
  method?: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  url?: string;
  query: Record<string, string | string[]>;
};
type VercelResponse = {
  setHeader(k: string, v: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): void;
  write(chunk: string): void;
  end(): void;
  send(body: string): void;
};

const SHARED_DEPLOYMENT_URL = 'https://cockpit-dev-219a15942c545a00a03a9a41905d7fc2.us.langgraph.app';

const ACTIVE_PRODUCT_PATHS = new Set([
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'deep-agents/sandboxes',
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/debug',
  'chat/theming',
  'chat/a2ui',
]);

function isActiveProductPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return false;
  }

  return ACTIVE_PRODUCT_PATHS.has(`${segments[0]}/${segments[1]}`);
}

function resolveBackend(referer: string | undefined): string {
  if (!referer) {
    return SHARED_DEPLOYMENT_URL;
  }

  try {
    const url = new URL(referer);
    if (isActiveProductPath(url.pathname)) {
      return SHARED_DEPLOYMENT_URL;
    }
  } catch {
    // Ignore invalid referers and fall back to the shared deployment.
  }

  return SHARED_DEPLOYMENT_URL;
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

  // Build target URL - extract path from req.url, stripping /api prefix.
  const parsedUrl = new URL(req.url ?? '', `https://${req.headers.host ?? 'localhost'}`);
  const apiPath = parsedUrl.pathname.replace(/^\/api/, '') || '/';
  // Strip the Vercel catch-all query param, keep any real query params.
  parsedUrl.searchParams.delete('[...path]');
  parsedUrl.searchParams.delete('[[...path]]');
  const cleanSearch = parsedUrl.searchParams.toString() ? `?${parsedUrl.searchParams.toString()}` : '';
  const targetUrl = `${backendUrl}${apiPath}${cleanSearch}`;

  // Debug endpoint.
  if (apiPath === '/_proxy_debug') {
    return res.status(200).json({
      method: req.method,
      url: req.url,
      apiPath,
      targetUrl,
      backendUrl,
      sharedDeployment: SHARED_DEPLOYMENT_URL,
      referer: req.headers.referer,
      query: req.query,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey?.substring(0, 10),
    });
  }

  console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl}`);

  // Forward headers, inject API key.
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

    // Stream the response back.
    const contentType = response.headers.get('content-type') ?? 'application/json';
    res.setHeader('content-type', contentType);
    res.status(response.status);

    if (contentType.includes('text/event-stream')) {
      // SSE streaming - pipe the response body.
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
};
