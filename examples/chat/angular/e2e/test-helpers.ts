// SPDX-License-Identifier: MIT
import { expect, type Locator, type Page } from '@playwright/test';

export function attachBrowserHygiene(page: Page): {
  consoleErrors: string[];
  failedRequests: string[];
} {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/PostHog|ERR_NAME_NOT_RESOLVED|license/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    const url = request.url();
    if (/runs\/stream/.test(url) && /abort|ERR_ABORTED/i.test(failure)) return;
    failedRequests.push(`${request.method()} ${url} ${failure}`.trim());
  });

  return { consoleErrors, failedRequests };
}

export async function openDemo(page: Page, path = '/embed'): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(path);
}

export function messageInput(page: Page): Locator {
  return page.getByRole('textbox', { name: /type a message|message|prompt/i });
}

export function sendButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Send message' });
}

export function toolbarSelect(page: Page, label: string): Locator {
  return page
    .locator('.demo-shell__field')
    .filter({ hasText: label })
    .locator('select');
}

export async function selectToolbarOption(
  page: Page,
  label: string,
  option: string
): Promise<void> {
  await toolbarSelect(page, label).selectOption({ label: option });
}

async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.first().isVisible();
  } catch {
    return false;
  }
}

export async function openChatDevtools(page: Page): Promise<void> {
  const region = page.getByRole('region', { name: 'Chat devtools' });
  const launcher = page.getByRole('button', { name: 'Open chat devtools' });

  await expect
    .poll(
      async () => (await isVisible(region)) || (await isVisible(launcher)),
      {
        timeout: 5_000,
      }
    )
    .toBe(true);

  if (await isVisible(region)) return;

  await launcher.first().click();
  await expect(region).toBeVisible();
}

export async function closeChatDevtools(page: Page): Promise<void> {
  const region = page.getByRole('region', { name: 'Chat devtools' });
  const launcher = page.getByRole('button', { name: 'Open chat devtools' });

  await expect
    .poll(
      async () => (await isVisible(region)) || (await isVisible(launcher)),
      {
        timeout: 5_000,
      }
    )
    .toBe(true);

  if (!(await isVisible(region))) return;

  const close = page
    .locator('chat-debug')
    .getByRole('button', { name: 'Close' });
  await close.first().click();
  await expect(region).toHaveCount(0);
  await expect(launcher.first()).toBeVisible();
}

export async function waitForFinalAssistant(page: Page): Promise<Locator> {
  const finalizedAssistant = page
    .locator('chat-message[data-role="assistant"][data-streaming="false"]')
    .last();
  await expect(finalizedAssistant).toBeAttached({ timeout: 45_000 });
  await expect
    .poll(
      async () => ((await finalizedAssistant.innerText()) ?? '').trim().length,
      {
        timeout: 30_000,
      }
    )
    .toBeGreaterThan(0);
  return finalizedAssistant;
}

/**
 * Send a user prompt and wait for the assistant bubble to finalize.
 *
 * "Finalized" means `chat-message[data-role="assistant"][data-streaming="false"]`:
 * the chat composition wires `[streaming]` to `agent.isLoading() && i === lastIndex`
 * on the latest assistant `<chat-message>`, so the attribute flips to `"false"`
 * once the agent stops loading and the markdown render has settled.
 *
 * Asserting on intermediate streaming-state DOM (partial `<ul>`, in-flight
 * code fences, etc.) is the source of e2e flake — always wait on this
 * attribute before counting or text-matching downstream of the assistant turn.
 */
export async function sendPromptAndWait(
  page: Page,
  prompt: string
): Promise<Locator> {
  await openDemo(page, '/embed');
  const input = messageInput(page);
  await input.fill(prompt);
  await sendButton(page).click();

  return waitForFinalAssistant(page);
}
