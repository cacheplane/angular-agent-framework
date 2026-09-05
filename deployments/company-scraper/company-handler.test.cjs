const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createHandler } = require('./company-handler.cjs');
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = () => new Promise((r) => setImmediate(r));
function fixture(overrides = {}) {
  let closed = 0,
    created = 0;
  const context = {
    close: async () => {
      closed++;
    },
    newPage: async () => ({ url: () => 'https://www.example.com/about' }),
  };
  const deps = {
    secret: 'test-secret',
    ready: () => true,
    assertSafeTargetUrl: async () => {},
    createContext: async (_, ua, observe) => {
      created++;
      assert.equal(ua, 'ThreadplaneCompanyResearch/1.0');
      observe(context);
      return { context, securityState: {} };
    },
    scrapePage: async (_page, _url, waitUntil) => {
      assert.equal(waitUntil, 'domcontentloaded');
      return { content: '<html>company</html>', status: 200 };
    },
    budgetMs: 25,
    ...overrides,
  };
  const handler = createHandler(deps);
  const request = (
    body = { url: 'https://example.com/' },
    auth = 'Bearer test-secret',
    aborted = false
  ) => {
    const req = new EventEmitter();
    req.body = body;
    req.get = () => auth;
    req.aborted = aborted;
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (value) => {
      res.body = value;
      res.writableEnded = true;
      return res;
    };
    res.type = () => res;
    res.send = (value) => res.json(JSON.parse(value));
    return { req, res, done: handler(req, res) };
  };
  return {
    request,
    get closed() {
      return closed;
    },
    get created() {
      return created;
    },
  };
}
test('secret mandatory, authentication and strict homepage input', async () => {
  assert.throws(() => createHandler({ secret: '' }), /secret/i);
  const f = fixture();
  for (const [body, auth, status] of [
    [{ url: 'https://example.com/' }, '', 401],
    [{ url: 'https://example.com/', headers: {} }, undefined, 400],
    [{ url: 'http://example.com/' }, undefined, 400],
    [{ url: 'https://user@example.com/' }, undefined, 400],
    [{ url: 'https://example.com/path' }, undefined, 400],
  ]) {
    const r = f.request(body, auth);
    await r.done;
    assert.equal(r.res.statusCode, status);
  }
  assert.equal(f.created, 0);
});
test('returns actual final URL and closes browser context', async () => {
  const f = fixture();
  const r = f.request();
  await r.done;
  assert.deepEqual(r.res.body, {
    content: '<html>company</html>',
    pageStatusCode: 200,
    sourceURL: 'https://example.com/',
    url: 'https://www.example.com/about',
  });
  assert.equal(f.closed, 1);
});
test('deadline covers DNS and does not start browser when DNS resolves late', async () => {
  const dns = deferred();
  const f = fixture({ assertSafeTargetUrl: () => dns.promise });
  const r = f.request();
  await r.done;
  assert.equal(r.res.statusCode, 504);
  dns.resolve();
  await tick();
  assert.equal(f.created, 0);
});
test('deadline closes a context created late and rejects concurrent work', async () => {
  const pending = deferred();
  let closed = 0;
  const f = fixture({
    createContext: async (_, ua, observe) => {
      await pending.promise;
      const context = { close: async () => closed++ };
      observe(context);
      return { context };
    },
  });
  const first = f.request();
  const busy = f.request();
  await busy.done;
  assert.equal(busy.res.statusCode, 503);
  await first.done;
  assert.equal(first.res.statusCode, 504);
  const stillBusy = f.request();
  await stillBusy.done;
  assert.equal(stillBusy.res.statusCode, 503);
  pending.resolve();
  await tick();
  assert.equal(closed, 1);
});
test('disconnect during navigation closes context without returning content', async () => {
  const navigating = deferred();
  const f = fixture({ scrapePage: () => navigating.promise });
  const r = f.request();
  await tick();
  r.res.emit('close');
  await r.done;
  assert.equal(f.closed, 1);
  assert.equal(r.res.body, undefined);
  navigating.resolve({ content: 'late', status: 200 });
});
test('deadline includes route setup after context allocation', async () => {
  const setup = deferred();
  let closed = 0;
  const f = fixture({
    createContext: async (_, ua, observe) => {
      const context = { close: async () => closed++ };
      observe(context);
      await setup.promise;
      return { context };
    },
  });
  const r = f.request();
  await r.done;
  assert.equal(r.res.statusCode, 504);
  assert.equal(closed, 1);
  setup.resolve();
});
test('rejects unsafe final URL and serialized response above cap', async () => {
  const f = fixture({
    assertSafeTargetUrl: async (url) => {
      if (url.includes('/about')) throw Error('private URL must not leak');
    },
  });
  const r = f.request();
  await r.done;
  assert.equal(r.res.statusCode, 502);
  assert.deepEqual(r.res.body, { error: 'capture_failed' });
  const big = fixture({
    scrapePage: async () => ({ content: '"'.repeat(1024 * 1024), status: 200 }),
  });
  const b = big.request();
  await b.done;
  assert.equal(b.res.statusCode, 502);
});
test('rejects empty query/fragment delimiters and URLs longer than contract cap', async () => {
  const f = fixture();
  for (const url of [
    'https://example.com/?',
    'https://example.com/#',
    `https://${'a'.repeat(490)}.com/`,
  ]) {
    const r = f.request({ url });
    await r.done;
    assert.equal(r.res.statusCode, 400);
  }
});
test('already aborted requests never allocate context or write response', async () => {
  const f = fixture();
  const r = f.request(undefined, undefined, true);
  await r.done;
  assert.equal(f.created, 0);
  assert.equal(r.res.body, undefined);
});
test('synchronous extraction cannot send after elapsed deadline', async () => {
  const f = fixture({
    scrapePage: async () => {
      const end = performance.now() + 35;
      while (performance.now() < end) {}
      return { content: 'late', status: 200 };
    },
  });
  const r = f.request();
  await r.done;
  assert.equal(r.res.statusCode, 504);
});
