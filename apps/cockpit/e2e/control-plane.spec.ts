import { expect, test, type Page } from '@playwright/test';

const route = '/langgraph/core-capabilities/streaming/overview/python';

declare global {
  interface Window {
    __cockpitAboutBlankMounted?: boolean;
    __cockpitRuntimePhases?: string[];
  }
}

async function installRuntimeObservation(page: Page) {
  await page.addInitScript(() => {
    window.__cockpitAboutBlankMounted = false;
    window.__cockpitRuntimePhases = [];

    const inspect = () => {
      for (const frame of document.querySelectorAll('iframe')) {
        if (frame.getAttribute('src') === 'about:blank') {
          window.__cockpitAboutBlankMounted = true;
        }
      }
      for (const status of document.querySelectorAll('[data-runtime-phase]')) {
        const phase = status.getAttribute('data-runtime-phase');
        if (phase && !window.__cockpitRuntimePhases?.includes(phase)) {
          window.__cockpitRuntimePhases?.push(phase);
        }
      }
    };

    new MutationObserver(inspect).observe(document, {
      attributes: true,
      attributeFilter: ['src', 'data-runtime-phase'],
      childList: true,
      subtree: true,
    });
    document.addEventListener('DOMContentLoaded', inspect, { once: true });
  });
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow, label).toBeLessThanOrEqual(1);
}

test.describe('Cockpit operational control plane', () => {
  test('completes the real Angular handshake without blank or unresponsive states', async ({
    page,
  }) => {
    await installRuntimeObservation(page);
    await page.goto(route);

    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__cockpitAboutBlankMounted)).toBe(
      false
    );
    expect(
      await page.evaluate(() => window.__cockpitRuntimePhases)
    ).not.toContain('unresponsive');

    await page.getByRole('button', { name: 'Activity' }).click();
    await expect(
      page.locator('[data-activity-kind="runtime_check_requested"]')
    ).toHaveCount(1);
    await expect(
      page.locator('[data-activity-kind="runtime_ready"]')
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Close Activity' }).click();

    await page.getByRole('button', { name: 'Recheck' }).click();
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Activity' }).click();
    await expect(
      page.locator('[data-activity-kind="runtime_check_requested"]')
    ).toHaveCount(2);
    await expect(
      page.locator('[data-activity-kind="runtime_ready"]')
    ).toHaveCount(2);
    expect(
      await page.evaluate(() => window.__cockpitRuntimePhases)
    ).not.toContain('unresponsive');
  });

  for (const viewport of [
    { width: 1440, height: 900, surface: 'desktop' },
    { width: 768, height: 900, surface: 'tablet' },
    { width: 390, height: 844, surface: 'mobile' },
    { width: 320, height: 844, surface: 'compact mobile' },
  ] as const) {
    test(`${viewport.surface} keeps operational controls reachable`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      await expectNoHorizontalOverflow(page, `Cockpit at ${viewport.width}px`);

      const desktopNavigation = page.locator(
        '[data-cockpit-desktop-navigation]'
      );
      const mobileTrigger = page.getByRole('button', {
        name: 'Open navigation',
      });
      if (viewport.width >= 768) {
        await expect(desktopNavigation).toBeVisible();
        await expect(mobileTrigger).toBeHidden();
        await expect(
          page.getByRole('button', { name: 'Runtime', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Activity' }).click();
        await expect(
          page.getByRole('heading', { name: 'Activity' })
        ).toBeVisible();
      } else {
        await expect(desktopNavigation).toBeHidden();
        await expect(mobileTrigger).toBeVisible();
        const triggerBox = await mobileTrigger.boundingBox();
        expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
        expect(triggerBox?.height).toBeGreaterThanOrEqual(44);

        await mobileTrigger.click();
        const dialog = page.getByRole('dialog', {
          name: 'Cockpit control plane',
        });
        await expect(dialog).toBeVisible();
        await expect(page.locator('[data-cockpit-workspace]')).toHaveAttribute(
          'inert',
          ''
        );
        await expect(
          dialog.getByRole('button', { name: 'Runtime', exact: true })
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Activity' }).click();
        await expect(
          dialog.getByRole('heading', { name: 'Activity' })
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Close Activity' }).click();
        await expect(
          dialog.getByRole('button', { name: 'Runtime', exact: true })
        ).toBeVisible();

        const close = dialog.getByRole('button', { name: 'Close navigation' });
        const closeBox = await close.boundingBox();
        expect(closeBox?.width).toBeGreaterThanOrEqual(44);
        expect(closeBox?.height).toBeGreaterThanOrEqual(44);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(mobileTrigger).toBeFocused();
      }
    });
  }

  test('forced colors preserve control boundaries and keyboard focus', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(route);

    const runtime = page.getByRole('button', { name: 'Runtime', exact: true });
    await runtime.focus();
    const styles = await runtime.evaluate((element) => {
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

  test('reduced motion disables loader and drawer animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('http://localhost:4300/**', (request) => request.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await page.getByRole('button', { name: 'Open navigation' }).click();

    const dialog = page.getByRole('dialog', { name: 'Cockpit control plane' });
    const loader = dialog.locator('.cockpit-runtime-status-loader');
    await expect(loader).toBeVisible();
    expect(
      await loader.evaluate(
        (element) => getComputedStyle(element).animationName
      )
    ).toBe('none');

    const panel = page.locator('.cockpit-mobile-control-plane-panel');
    await expect(panel).toBeVisible();
    const motion = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationName: style.animationName,
        transitionDuration: style.transitionDuration,
      };
    });
    expect(motion.animationName).toBe('none');
    expect(motion.transitionDuration).toBe('0s');
  });
});
