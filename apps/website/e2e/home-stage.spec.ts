import { test, expect, type Page } from '@playwright/test';

/** Drives the pinned act: the section is 6 viewports tall; scroll to a fraction of its travel. */
async function scrollAct(page: Page, p: number) {
  await page.evaluate((frac) => {
    const el = document.querySelector('[data-stage-act]') as HTMLElement;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (el.offsetHeight - window.innerHeight) * frac,
      behavior: 'instant',
    });
  }, p);
  // The engine writes `--sc-p` and the cue opacities from `scrollY` on ONE
  // requestAnimationFrame after the scroll event (the 0.18/frame lerp applies
  // to <video> playheads only; this page has none). The scroll event lands in
  // the frame after scrollTo, so two nested frames are past the engine's write.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
const progress = (page: Page) =>
  page.evaluate(() =>
    parseFloat(
      (
        document.querySelector('[data-stage-act]') as HTMLElement
      ).style.getPropertyValue('--sc-p')
    )
  );

test.describe('homepage stage', () => {
  test('stills render first and the act upgrades on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const act = page.locator('[data-stage-act]');
    await expect(act).toHaveAttribute('data-sc-span', '6');
    await expect(act.locator('iframe')).toHaveAttribute(
      'src',
      'https://demo.threadplane.ai/stage?t=0'
    );
    await expect(act.locator('.stage-pin')).toHaveCSS('position', 'sticky');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(0);
    // This runs well inside StageAct's 8 s READY_TIMEOUT_MS (after which the
    // act is swapped for the stills and [data-stage-act] disappears).
    // The engine's layout() sets the act's inline height to span × 100vh.
    await expect(page.locator('html')).toHaveClass(/sc-ready/);
    const heights = await page.evaluate(() => ({
      act: (document.querySelector('[data-stage-act]') as HTMLElement)
        .offsetHeight,
      viewport: window.innerHeight,
    }));
    expect(Math.abs(heights.act - 6 * heights.viewport)).toBeLessThanOrEqual(4);
  });

  test('scroll drives the act: progress, cues, and the declared hold', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // With the rAF settle this takes ~1-2 s, well inside StageAct's 8 s
    // READY_TIMEOUT_MS after which the act is swapped for the stills.
    await expect(page.locator('html')).toHaveClass(/sc-ready/);
    await scrollAct(page, 0.05);
    expect(await progress(page)).toBeGreaterThan(0);
    const stream = page
      .getByTestId('stage-rail-beat')
      .and(page.locator('[data-beat="stream"]'));
    await expect(stream).toHaveCSS('opacity', '1');
    // Inside the approve hold: approve spans 0.4167..0.8167 of the act and the
    // hold is 35–70% of it (0.5567..0.6967). 0.68 also sits on the last hold
    // line's plateau (its cue opens at 0.65, full from ~0.678).
    await scrollAct(page, 0.68);
    await expect(page.locator('[data-stage-act]')).toHaveAttribute(
      'data-sc-verify-hold',
      'true'
    );
    await expect(page.getByTestId('stage-rail-hold').last()).toHaveCSS(
      'opacity',
      /^(0\.[5-9]\d*|1)$/
    );
    await scrollAct(page, 0.8);
    await expect(page.locator('[data-stage-act]')).not.toHaveAttribute(
      'data-sc-verify-hold',
      'true'
    );
    await scrollAct(page, 1);
    await expect(
      page
        .getByTestId('stage-rail-beat')
        .and(page.locator('[data-beat="render"]'))
    ).toHaveCSS('opacity', '1');
  });

  test('the frame answers and the verify state changes between positions', async ({
    page,
  }) => {
    test.skip(
      process.env['STAGE_LIVE_FRAME'] !== 'true',
      'needs the deployed demo /stage (set STAGE_LIVE_FRAME=true after #1030 promotes)'
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const act = page.locator('[data-stage-act]');
    // After READY_TIMEOUT_MS (8 s) StageAct swaps the act for the stills and
    // [data-stage-act] is gone, so a `ready` that never arrives fails here,
    // on the state attribute, rather than later on a vanished locator.
    await expect(act).toHaveAttribute('data-state', 'ready', {
      timeout: 8_000,
    });
    // `data-state="ready"` only proves the iframe answered; the engine's
    // layout (html.sc-ready) is what makes the act 6 viewports tall.
    await expect(page.locator('html')).toHaveClass(/sc-ready/);
    // Once ready arrived the fallback timer is cleared, so the waits below
    // only cover the live frame's own latency.
    await scrollAct(page, 0.1);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^stream:\d+$/, {
      timeout: 10_000,
    });
    const a = await act.getAttribute('data-sc-verify-state');
    // Inside the approve hold: approve spans 0.4167..0.8167 of the act and the
    // hold is 35–70% of it (0.5567..0.6967). 0.68 also sits on the last hold
    // line's plateau (its cue opens at 0.65, full from ~0.678).
    await scrollAct(page, 0.68);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^pause:\d+$/, {
      timeout: 10_000,
    });
    expect(await act.getAttribute('data-sc-verify-state')).not.toBe(a);
    await scrollAct(page, 1);
    await expect(act).toHaveAttribute('data-sc-verify-state', /^render:\d+$/, {
      timeout: 10_000,
    });
  });

  test('phones and reduced motion get the stills', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(4);
    await expect(page.locator('[data-stage-act]')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByTestId('stage-still-beat')).toHaveCount(4);
    await expect(page.locator('[data-stage-act]')).toHaveCount(0);
  });
});
