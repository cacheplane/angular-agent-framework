// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

for (const width of [1440, 1024, 768, 480]) {
  test(`visual polish: ${width}px viewport has no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDemo(page, '/embed');

    await expect(
      page.getByRole('heading', { name: 'How can I help?' })
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.documentElement.clientWidth,
      html:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }));
    expect(Math.max(overflow.body, overflow.html)).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole('button', { name: 'Open chat devtools' })
    ).toBeVisible();
  });
}
