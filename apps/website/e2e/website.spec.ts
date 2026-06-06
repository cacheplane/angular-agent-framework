import { test, expect } from '@playwright/test';

test('landing page renders hero headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero-heading')).toBeVisible();
  const headline = await page.locator('#hero-heading').textContent();
  expect(headline?.toLowerCase()).toContain('angular');
});

test('landing page renders differentiator section', async ({ page }) => {
  await page.goto('/');
  // Assert on the stable id, not the heading copy — landing-page text rewrites
  // happen far more often than the section structure changes.
  await expect(page.locator('#differentiator-heading')).toBeVisible();
});

test('landing page renders feature blocks (Stream/Render/Ship)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stream-heading')).toBeVisible();
  await expect(page.locator('#render-heading')).toBeVisible();
  await expect(page.locator('#ship-heading')).toBeVisible();
});

test('pricing page shows plan cards', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByText('Community').first()).toBeVisible();
  await expect(page.getByText('Developer Seat').first()).toBeVisible();
  await expect(page.getByText('Team').first()).toBeVisible();
  await expect(page.getByText('Enterprise').first()).toBeVisible();
});

test('pricing page lead form validates required fields', async ({ page }) => {
  let checkoutCalled = false;
  await page.route('**/api/checkout/session', async (route) => {
    checkoutCalled = true;
    await route.abort();
  });

  await page.goto('/pricing');
  const leadForm = page.locator('#lead-form form');
  await expect(leadForm).toBeVisible();
  await leadForm.getByRole('button', { name: 'Request enterprise quote' }).click();
  await expect(leadForm).toBeVisible();
  expect(checkoutCalled).toBe(false);
  expect(await leadForm.evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(false);
});

test('contact page submits a lead payload and renders success state', async ({ page }) => {
  let leadPayload: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    leadPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/contact?source=e2e_contact&track=enterprise');
  const contactForm = page.locator('main form').first();
  await contactForm.getByRole('textbox', { name: 'Email', exact: true }).fill('jane@acme.com');
  await contactForm.getByRole('textbox', { name: 'Name' }).fill('Jane Smith');
  await contactForm.getByRole('textbox', { name: 'Company' }).fill('Acme');
  await contactForm.getByRole('textbox', { name: 'Message' }).fill('We are evaluating Threadplane.');
  await contactForm.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText("Thanks. We'll be in touch within one business day.")).toBeVisible();
  expect(leadPayload).toMatchObject({
    email: 'jane@acme.com',
    name: 'Jane Smith',
    company: 'Acme',
    message: 'We are evaluating Threadplane.',
    source_page: 'e2e_contact',
    track: 'enterprise',
  });
});

test('pricing lead form posts to /api/leads and renders success state', async ({ page }) => {
  let leadPayload: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    leadPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/pricing#lead-form');
  const leadForm = page.locator('#lead-form form');
  await leadForm.getByLabel('Name').fill('Jane Smith');
  await leadForm.getByLabel('Work email').fill('jane@acme.com');
  await leadForm.getByLabel('Company').fill('Acme');
  await leadForm.getByLabel('Tell us about your use case').fill('Volume seats and security review.');
  await leadForm.getByRole('button', { name: 'Request enterprise quote' }).click();

  await expect(page.getByText(/we'll be in touch within one business day/i)).toBeVisible();
  expect(leadPayload).toMatchObject({
    email: 'jane@acme.com',
    name: 'Jane Smith',
    company: 'Acme',
    message: 'Volume seats and security review.',
  });
});

test('footer newsletter form posts to /api/newsletter and renders success state', async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/newsletter', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/');
  const footer = page.locator('footer');
  await footer.getByLabel('Email address').fill('reader@acme.com');
  await footer.getByRole('button', { name: 'Subscribe' }).click();

  await expect(page.getByText("✓ You're subscribed!")).toBeVisible();
  expect(payload).toEqual({ email: 'reader@acme.com' });
});

test('whitepaper signup form posts to /api/whitepaper-signup and renders success state', async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/whitepaper-signup', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/chat');
  await page.locator('#whitepaper-block').getByLabel('Email address').fill('reader@acme.com');
  await page.locator('#whitepaper-block').getByRole('button', { name: 'Download (free)' }).click();

  await expect(page.getByText(/check your inbox/i)).toBeVisible();
  expect(payload).toEqual({ email: 'reader@acme.com', paper: 'chat' });
});

test('docs page renders sidebar and content', async ({ page }) => {
  await page.goto('/docs/langgraph/getting-started/introduction');
  await expect(page.locator('aside').first()).toBeVisible();
  await expect(page.locator('article')).toBeVisible();
});

test('docs landing page shows library cards', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByText('LangGraph').first()).toBeVisible();
  await expect(page.getByText('Render').first()).toBeVisible();
  await expect(page.getByText('Chat').first()).toBeVisible();
  await expect(page.getByText('AG-UI').first()).toBeVisible();
});

test('api reference renders in docs', async ({ page }) => {
  await page.goto('/docs/langgraph/api/inject-agent');
  await expect(page.locator('article').first()).toBeVisible();
});

test('footer has pricing link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/pricing"]').first()).toBeVisible();
});

test('mobile viewport renders nav', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('nav')).toBeVisible();
});

test('/llms.txt returns plain text', async ({ page }) => {
  const response = await page.goto('/llms.txt');
  expect(response?.headers()['content-type']).toContain('text/plain');
  const body = await page.locator('body').textContent();
  expect(body).toContain('@threadplane/a2ui');
  expect(body).toContain('@threadplane/telemetry');
  expect(body).toContain('ChatMessageListComponent');
  expect(body).not.toContain('ChatMessagesComponent');
});

test('/llms-full.txt includes generated API reference content', async ({ request }) => {
  const response = await request.get('/llms-full.txt');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('text/plain');

  const body = await response.text();
  expect(body).toContain('## API Reference (TypeDoc)');
  expect(body).toContain('### a2ui');
  expect(body).toContain('### langgraph');
  expect(body).toContain('### chat');
  expect(body).toContain('### licensing');
  expect(body).toContain('### telemetry');
  expect(body).not.toContain('API reference not yet generated');
});

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);

  const body = await response.text();
  expect(body).toContain('User-Agent: *');
  expect(body).toContain('Allow: /');
  expect(body).toContain('Sitemap: https://threadplane.ai/sitemap.xml');
});

test('sitemap.xml includes configured docs pages', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);

  const body = await response.text();
  expect(body).toContain('https://threadplane.ai/docs');
  expect(body).toContain('https://threadplane.ai/docs/langgraph/getting-started/introduction');
  expect(body).toContain('https://threadplane.ai/docs/chat/a2ui/overview');
});

test('docs pages render canonical and social metadata', async ({ page }) => {
  await page.goto('/docs/langgraph/guides/streaming');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://threadplane.ai/docs/langgraph/guides/streaming',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Streaming - LangGraph Docs - Threadplane',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://threadplane.ai/docs/langgraph/guides/streaming',
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'Streaming - LangGraph Docs - Threadplane',
  );
});

test('marketing pages render canonical and page-specific social URLs', async ({ page }) => {
  for (const route of ['/', '/langgraph', '/ag-ui', '/render', '/chat', '/pricing', '/contact', '/pilot-to-prod', '/solutions']) {
    await page.goto(route);
    const expectedUrl = route === '/' ? 'https://threadplane.ai' : `https://threadplane.ai${route}`;

    await expect(page.locator('link[rel="canonical"]'), `${route} canonical`).toHaveAttribute('href', expectedUrl);
    await expect(page.locator('meta[property="og:url"]'), `${route} og:url`).toHaveAttribute('content', expectedUrl);
  }
});

test('representative docs pages do not create page-level horizontal overflow', async ({ page }) => {
  const routes = [
    '/docs',
    '/docs/langgraph/getting-started/introduction',
    '/docs/langgraph/api/inject-agent',
    '/docs/chat/components/chat-tool-calls',
    '/docs/chat/a2ui/overview',
    '/docs/telemetry/guides/browser',
  ];
  const widths = [320, 375, 768, 1280];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    for (const route of routes) {
      await page.goto(route);
      const overflow = await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ));

      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test('marketing pages link to downloadable whitepaper PDFs', async ({ page }) => {
  const expectedDownloads: Record<string, string> = {
    '/': '/whitepaper.pdf',
    '/langgraph': '/whitepapers/angular.pdf',
    '/render': '/whitepapers/render.pdf',
    '/chat': '/whitepapers/chat.pdf',
  };

  for (const [route, href] of Object.entries(expectedDownloads)) {
    await page.goto(route);
    await expect(page.locator(`a[href="${href}"]`).first(), `${route} links ${href}`).toBeVisible();
  }
});

test('whitepaper PDFs are served as static downloads', async ({ request }) => {
  for (const href of [
    '/whitepaper.pdf',
    '/whitepapers/angular.pdf',
    '/whitepapers/render.pdf',
    '/whitepapers/chat.pdf',
  ]) {
    const response = await request.get(href);
    expect(response.ok(), `${href} responds successfully`).toBe(true);
    expect(response.headers()['content-type'], `${href} content type`).toContain('application/pdf');
  }
});
