// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
} from '@threadplane-internal/e2e-harness';

test('c-interrupts: confirm path books the flight via book_flight + resume("confirm")', async ({ page }) => {
  await sendPromptAndWaitForInterrupt(page, 'Book me on UA123.');

  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeVisible();

  const finalBubble = await clickInterruptActionAndWaitFinal(page, 'Accept');
  const text = (await finalBubble.innerText()).toLowerCase();
  expect(text).toMatch(/booked/);
  expect(text).toMatch(/ua123/);
});

test('c-interrupts: cancel path returns "Booking cancelled." via resume("cancel")', async ({ page }) => {
  await sendPromptAndWaitForInterrupt(page, 'Book me on AA404.');

  const panel = page.locator('chat-interrupt-panel');
  await expect(panel).toBeVisible();

  const finalBubble = await clickInterruptActionAndWaitFinal(page, 'Ignore');
  const text = (await finalBubble.innerText()).toLowerCase();
  expect(text).toMatch(/cancel/);
});
