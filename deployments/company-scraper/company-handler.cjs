// HTTP policy for the pinned Firecrawl standalone Playwright component.
// Browser creation, navigation, content extraction and SSRF checks remain upstream.
const { timingSafeEqual } = require('node:crypto');
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function createHandler({
  secret,
  ready,
  assertSafeTargetUrl,
  createContext,
  scrapePage,
  budgetMs = 10000,
}) {
  if (!secret || !secret.trim())
    throw new Error('COMPANY_SCRAPER_SECRET is required');
  const expected = Buffer.from(`Bearer ${secret}`);
  let busy = false;
  return async (req, res) => {
    const supplied = Buffer.from(req.get('authorization') || '');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return res.status(401).json({ error: 'unauthorized' });
    if (!ready() || busy) return res.status(503).json({ error: 'unavailable' });
    busy = true;
    const deadline = performance.now() + budgetMs;
    let stopped = false,
      disconnected = false,
      context,
      closing,
      allocationPending = false;
    const close = () => {
      if (context && !closing)
        closing = Promise.resolve()
          .then(() => context.close())
          .catch(() => {});
      return closing;
    };
    let rejectStop;
    const stopPromise = new Promise((_, reject) => {
      rejectStop = reject;
    });
    // A client can already be disconnected before the first asynchronous stage.
    stopPromise.catch(() => {});
    const stop = (code) => {
      if (stopped) return;
      stopped = true;
      close();
      rejectStop(Object.assign(new Error(code), { code }));
    };
    const timer = setTimeout(() => stop('deadline'), budgetMs);
    const disconnect = () => {
      if (!res.writableEnded) {
        disconnected = true;
        stop('disconnect');
      }
    };
    req.once('aborted', disconnect);
    res.once('close', disconnect);
    if (req.aborted || res.destroyed) disconnect();
    const stage = async (operation) => {
      if (stopped)
        throw Object.assign(new Error('deadline'), { code: 'deadline' });
      return Promise.race([
        Promise.resolve().then(() => {
          if (stopped)
            throw Object.assign(new Error('deadline'), { code: 'deadline' });
          return operation();
        }),
        stopPromise,
      ]);
    };
    try {
      const body = req.body;
      let input;
      try {
        if (
          !body ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          typeof body.url !== 'string' ||
          body.url.length > 500 ||
          body.url.trim() !== body.url ||
          /[?#]/.test(body.url)
        )
          throw Error();
        input = new URL(body.url);
        if (
          input.protocol !== 'https:' ||
          input.username ||
          input.password ||
          input.port ||
          input.pathname !== '/' ||
          input.search ||
          input.hash
        )
          throw Error();
      } catch {
        return res.status(400).json({ error: 'invalid_request' });
      }
      await stage(() => assertSafeTargetUrl(body.url));
      const bundle = await stage(async () => {
        allocationPending = true;
        try {
          return await createContext(
            false,
            'ThreadplaneCompanyResearch/1.0',
            (allocated) => {
              context = allocated;
              allocationPending = false;
              if (stopped)
                close().then(() => {
                  busy = false;
                });
            }
          );
        } finally {
          allocationPending = false;
          if (stopped && !context) busy = false;
        }
      });
      const page = await stage(() => bundle.context.newPage());
      const result = await stage(() =>
        scrapePage(
          page,
          body.url,
          'domcontentloaded',
          0,
          budgetMs,
          undefined,
          bundle.securityState
        )
      );
      const finalUrl = page.url();
      const parsed = new URL(finalUrl);
      if (
        finalUrl.length > 500 ||
        /[?#]/.test(finalUrl) ||
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.port
      )
        throw Error();
      await stage(() => assertSafeTargetUrl(finalUrl));
      const serialized = JSON.stringify({
        content: result.content,
        pageStatusCode: result.status,
        sourceURL: body.url,
        url: finalUrl,
      });
      if (Buffer.byteLength(serialized) > MAX_RESPONSE_BYTES) throw Error();
      if (performance.now() >= deadline)
        throw Object.assign(new Error('deadline'), { code: 'deadline' });
      if (!disconnected) res.type('json').send(serialized);
    } catch (error) {
      if (!disconnected)
        res.status(error.code === 'deadline' ? 504 : 502).json({
          error:
            error.code === 'deadline' ? 'deadline_exceeded' : 'capture_failed',
        });
    } finally {
      stopped = true;
      clearTimeout(timer);
      req.off('aborted', disconnect);
      res.off('close', disconnect);
      // Initiate cleanup before releasing admission. Late allocation is also
      // observed and immediately closed, even after this response has ended.
      await close();
      if (!allocationPending) busy = false;
    }
  };
}
module.exports = { createHandler };
