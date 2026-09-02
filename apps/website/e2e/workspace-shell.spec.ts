import { expect, test, type Locator, type Page } from '@playwright/test';

const streamingDocsPath = '/docs/langgraph/guides/streaming';
const persistenceDocsPath = '/docs/langgraph/guides/persistence';
const mappedDocsOnlyPath = '/docs/langgraph/getting-started/introduction';
const unmappedDocsOnlyPath = '/docs/langgraph/getting-started/installation';
const workspaceOnlyPath = '/workspace/langgraph/durable-execution';
const deepAgentsDocsPath = '/docs/deep-agents/capabilities/planning';
const RUN_RAIL_ITEM = /^Run(?:,|$)/;

const modeButton = (page: Page, mode: 'Docs' | 'Run' | 'Code' | 'API') =>
  page.locator('[data-cockpit-desktop-navigation]').getByRole('button', {
    name: mode === 'Run' ? RUN_RAIL_ITEM : mode,
    exact: mode !== 'Run',
  });

const visiblePanel = (page: Page, mode: 'Docs' | 'Run' | 'Code' | 'API') =>
  page.locator(`[data-workspace-panel-target="${mode}"]`).filter({
    visible: true,
  });

async function expectMode(page: Page, mode: 'Docs' | 'Run' | 'Code' | 'API') {
  const shell = page.locator('[data-workspace-shell]');
  await expect(shell).toHaveAttribute('data-hydrated', 'true');
  await expect(shell).toHaveAttribute('data-workspace-mode', mode);
  await expect(visiblePanel(page, mode)).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow, label).toBeLessThanOrEqual(1);
}

async function markRuntimeFrame(frame: Locator) {
  await frame.evaluate((element) => {
    element.setAttribute('data-e2e-runtime-frame', crypto.randomUUID());
  });
  return frame.getAttribute('data-e2e-runtime-frame');
}

test.describe('workspace shell', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const hideDevelopmentIndicator = () => {
        document
          .querySelectorAll<HTMLElement>('nextjs-portal')
          .forEach((portal) => {
            portal.style.setProperty('display', 'none', 'important');
          });
      };
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          hideDevelopmentIndicator();
          new MutationObserver(hideDevelopmentIndicator).observe(
            document.documentElement,
            { childList: true, subtree: true }
          );
        },
        { once: true }
      );
    });
  });
  test('moves Docs to Run to Code to API to Docs without replacing the runtime frame', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(streamingDocsPath);
    await expectMode(page, 'Docs');

    await modeButton(page, 'Run').click();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=run`);
    await expectMode(page, 'Run');
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();

    const frame = page.locator(
      'iframe[title="LangGraph Streaming live example"]'
    );
    await expect(frame).toBeVisible();
    const frameIdentity = await markRuntimeFrame(frame);
    expect(frameIdentity).toBeTruthy();

    for (const mode of ['Code', 'API', 'Docs'] as const) {
      await modeButton(page, mode).click();
      await expect(page).toHaveURL(
        mode === 'Docs'
          ? streamingDocsPath
          : `${streamingDocsPath}?mode=${mode.toLowerCase()}`
      );
      await expectMode(page, mode);
      await expect(
        page.locator(`iframe[data-e2e-runtime-frame="${frameIdentity}"]`)
      ).toBeAttached();
    }
  });

  test('restores mode and capability navigation through Back and Forward', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(streamingDocsPath);
    const shell = page.locator('[data-workspace-shell]');
    await shell.evaluate((element) => {
      element.setAttribute('data-e2e-shell-lifetime', 'original');
    });

    await modeButton(page, 'Run').click();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=run`);
    await expectMode(page, 'Run');
    await modeButton(page, 'Code').click();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=code`);
    await expectMode(page, 'Code');

    await page.goBack();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=run`);
    await expectMode(page, 'Run');
    await page.goForward();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=code`);
    await expectMode(page, 'Code');

    await page.getByRole('link', { name: 'Persistence', exact: true }).click();
    await expect(page).toHaveURL(persistenceDocsPath);
    await expectMode(page, 'Docs');
    await expect(shell).toHaveAttribute('data-e2e-shell-lifetime', 'original');
    await page
      .locator('[data-cockpit-desktop-navigation]')
      .getByRole('button', { name: 'Activity', exact: true })
      .click();
    await expect(page.getByText('Mode changed to Code')).toBeVisible();
    await expect(
      page.locator('[data-activity-capability]').first()
    ).toContainText('streaming');
    await page
      .locator('[data-cockpit-desktop-navigation]')
      .getByRole('button', { name: 'Activity', exact: true })
      .click();
    await page.goBack();
    await expect(page).toHaveURL(`${streamingDocsPath}?mode=code`);
    await expectMode(page, 'Code');
    await expect(shell).toHaveAttribute('data-e2e-shell-lifetime', 'original');
    await page.goForward();
    await expect(page).toHaveURL(persistenceDocsPath);
    await expectMode(page, 'Docs');
    await expect(shell).toHaveAttribute('data-e2e-shell-lifetime', 'original');
  });

  for (const query of ['mode=run&mode=code', 'mode=invalid']) {
    test(`normalizes ${query} to the canonical Docs URL`, async ({ page }) => {
      await page.goto(`${streamingDocsPath}?${query}`);
      await expect(page).toHaveURL(streamingDocsPath);
      await expectMode(page, 'Docs');
    });
  }

  test('normalizes a valid but unavailable mode and explains docs-only controls', async ({
    page,
  }) => {
    await page.goto(`${mappedDocsOnlyPath}?mode=run`);
    await expect(page).toHaveURL(mappedDocsOnlyPath);
    await expectMode(page, 'Docs');
    await expect(modeButton(page, 'Run')).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await page.goto(`${unmappedDocsOnlyPath}?mode=api`);
    await expect(page).toHaveURL(unmappedDocsOnlyPath);
    await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
      'data-workspace-kind',
      'docs-only'
    );
    await expectMode(page, 'Docs');
    for (const mode of ['Run', 'Code', 'API'] as const) {
      await expect(modeButton(page, mode)).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await expect(modeButton(page, mode)).toHaveAccessibleDescription(
        new RegExp(
          `${mode} is unavailable because this page has no workspace capability`,
          'i'
        )
      );
    }
  });

  test('uses workspace fallbacks only when a shared Docs path would lose identity', async ({
    page,
  }) => {
    const response = await page.goto(workspaceOnlyPath);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(workspaceOnlyPath);
    await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
      'aria-label',
      'Website workspace'
    );
    await expectMode(page, 'Run');

    await page.goto(deepAgentsDocsPath);
    await expect(page).toHaveURL(deepAgentsDocsPath);
    await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
      'aria-label',
      'Documentation workspace'
    );
    await expectMode(page, 'Docs');
    await expect(
      page.locator('iframe[title="Deep Agents Planning live example"]')
    ).toBeAttached();
  });

  test('renders the full desktop rail and context at the 64rem breakpoint', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(streamingDocsPath);
    await expectNoHorizontalOverflow(page, 'desktop workspace');

    const desktop = page.locator('[data-cockpit-desktop-navigation]');
    await expect(desktop).toBeVisible();
    await expect(desktop.locator('[data-control-plane-rail]')).toBeVisible();
    await expect(desktop.locator('[data-control-plane-pane]')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open context' })
    ).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Open navigation' })
    ).toBeHidden();
  });

  test('uses tablet disclosure, focuses destinations, and restores utility focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(streamingDocsPath);
    await expectNoHorizontalOverflow(page, 'tablet workspace');

    const desktop = page.locator('[data-cockpit-desktop-navigation]');
    await expect(desktop.locator('[data-control-plane-rail]')).toBeVisible();
    await expect(desktop.locator('[data-control-plane-pane]')).toBeHidden();
    const contextTrigger = page.getByRole('button', { name: 'Open context' });
    await expect(contextTrigger).toBeVisible();

    const activity = desktop.getByRole('button', { name: 'Activity' });
    await activity.click();
    const dialog = page.getByRole('dialog', {
      name: 'Documentation control plane context',
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Activity' })
    ).toBeFocused();

    const settings = desktop.getByRole('button', { name: 'Settings' });
    await settings.click();
    await expect(
      dialog.getByRole('heading', { name: 'Settings' })
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(
      dialog.getByRole('heading', { name: 'Settings' })
    ).toBeHidden();
    await expect(settings).toBeFocused();

    await modeButton(page, 'Code').click();
    await expect(dialog).toBeHidden();
    await expectMode(page, 'Code');
    await expect(visiblePanel(page, 'Code')).toBeFocused();

    await contextTrigger.click();
    await dialog
      .getByRole('link', { name: 'Persistence', exact: true })
      .click();
    await expect(page).toHaveURL(persistenceDocsPath);
    await expect(dialog).toBeHidden();
    await expectMode(page, 'Docs');
    await expect(visiblePanel(page, 'Docs')).toBeFocused();
  });

  test('uses a modal control plane below 48rem and restores Escape focus', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 767, height: 844 });
    await page.goto(streamingDocsPath);
    await expectNoHorizontalOverflow(page, 'mobile workspace');

    await expect(
      page.locator('[data-cockpit-desktop-navigation]')
    ).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await expect(trigger).toBeVisible();
    await page.evaluate(() => {
      const element = document.createElement('div');
      element.className = 'toast-root';
      element.setAttribute('data-announcement-toast', '');
      element.setAttribute('data-mounted', '');
      element.textContent = 'Visible announcement fixture';
      document
        .querySelector('[data-announcement-region]')
        ?.appendChild(element);
    });
    const announcement = page.locator('[data-announcement-toast]');
    const announcementRegion = page.locator('[data-announcement-region]');
    await expect(announcement).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole('dialog', {
      name: 'Documentation control plane',
    });
    const globalNavigation = page.locator('[data-site-navigation]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(globalNavigation).toHaveAttribute('inert', '');
    await expect(announcementRegion).toHaveAttribute('inert', '');
    await expect(announcementRegion).toHaveAttribute(
      'data-workspace-modal-hidden',
      ''
    );
    await expect(announcement).toBeHidden();
    await page.evaluate(() => {
      const lateToast = document.createElement('button');
      lateToast.setAttribute('data-late-announcement', '');
      lateToast.textContent = 'Late announcement fixture';
      document
        .querySelector('[data-announcement-region]')
        ?.appendChild(lateToast);
    });
    const lateAnnouncement = page.locator('[data-late-announcement]');
    await expect(lateAnnouncement).toBeHidden();
    await expect(page.locator('[data-cockpit-workspace]')).toHaveAttribute(
      'inert',
      ''
    );

    await dialog.getByRole('button', { name: RUN_RAIL_ITEM }).click();
    await expect(dialog).toBeHidden();
    await expectMode(page, 'Run');
    await expect(visiblePanel(page, 'Run')).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveAttribute('data-state', 'closing');
    await expect(globalNavigation).toHaveAttribute('inert', '');
    await expect(announcementRegion).toHaveAttribute('inert', '');
    await expect(lateAnnouncement).toBeHidden();
    await expect(dialog).toHaveCount(0);
    await expect(globalNavigation).not.toHaveAttribute('inert', '');
    await expect(announcementRegion).not.toHaveAttribute('inert', '');
    await expect(announcementRegion).not.toHaveAttribute(
      'data-workspace-modal-hidden',
      ''
    );
    await expect(announcement).toBeVisible();
    await expect(lateAnnouncement).toBeVisible();
    await expect(trigger).toBeFocused();
    await announcement.evaluate((element) => element.remove());
    await lateAnnouncement.evaluate((element) => element.remove());
  });

  test('defers mobile Learn navigation and focuses each destination heading', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(streamingDocsPath);

    await page.getByRole('button', { name: 'Open navigation' }).click();
    let dialog = page.getByRole('dialog', {
      name: 'Documentation control plane',
    });
    await dialog.getByRole('link', { name: 'Streaming', exact: true }).click();
    await expect(page).toHaveURL(streamingDocsPath);
    await expect(dialog).toHaveCount(0);
    await expect(visiblePanel(page, 'Docs')).toBeFocused();

    await page.getByRole('button', { name: 'Open navigation' }).click();
    dialog = page.getByRole('dialog', {
      name: 'Documentation control plane',
    });
    await dialog
      .getByRole('link', { name: 'Persistence', exact: true })
      .click();
    await expect(page).toHaveURL(persistenceDocsPath);
    await expect(dialog).toHaveCount(0);
    await expect(visiblePanel(page, 'Docs')).toBeFocused();

    await page.getByRole('button', { name: 'Open navigation' }).click();
    dialog = page.getByRole('dialog', {
      name: 'Documentation control plane',
    });
    await dialog
      .getByRole('link', { name: 'Choosing an adapter', exact: true })
      .click();
    await expect(page).toHaveURL('/docs/choosing-an-adapter');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('main h1').first()).toBeFocused();
  });

  test('keeps Learn and visible Search in mapped and unmapped mobile Docs context', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [streamingDocsPath, unmappedDocsOnlyPath]) {
      await page.goto(path);
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const dialog = page.getByRole('dialog', {
        name: 'Documentation control plane',
      });
      await expect(dialog.getByText('Learn', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Search docs' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('dialog', { name: 'Search documentation' })
      ).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('preserves visible boundaries and focus in forced colors', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(streamingDocsPath);

    const run = modeButton(page, 'Run');
    await run.focus();
    const styles = await run.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderTopWidth,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(Number.parseFloat(styles.borderWidth)).toBeGreaterThan(0);
    expect(styles.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(styles.outlineWidth)).toBeGreaterThan(0);
  });

  test('removes mobile control-plane motion when reduced motion is requested', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(streamingDocsPath);
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const dialog = page.getByRole('dialog', {
      name: 'Documentation control plane',
    });
    await expect(dialog).toBeVisible();
    const motion = await dialog.evaluate((element) => {
      const panel = element.querySelector(
        '.cockpit-mobile-control-plane-panel'
      );
      const overlayStyle = getComputedStyle(element);
      const panelStyle = panel ? getComputedStyle(panel) : null;
      return {
        overlayAnimation: overlayStyle.animationName,
        overlayTransition: overlayStyle.transitionDuration,
        panelAnimation: panelStyle?.animationName,
        panelTransition: panelStyle?.transitionDuration,
      };
    });
    expect(motion).toEqual({
      overlayAnimation: 'none',
      overlayTransition: '0s',
      panelAnimation: 'none',
      panelTransition: '0s',
    });
  });
});
