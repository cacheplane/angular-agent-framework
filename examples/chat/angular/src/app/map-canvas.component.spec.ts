// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { readAppColorScheme } from './map-canvas.component';

describe('readAppColorScheme — map follows the app light/dark toggle', () => {
  afterEach(() => document.documentElement.removeAttribute('data-color-scheme'));

  it("reads 'light' from <html data-color-scheme='light'>", () => {
    document.documentElement.setAttribute('data-color-scheme', 'light');
    expect(readAppColorScheme()).toBe('light');
  });

  it("reads 'dark' from <html data-color-scheme='dark'>", () => {
    document.documentElement.setAttribute('data-color-scheme', 'dark');
    expect(readAppColorScheme()).toBe('dark');
  });

  it("defaults to 'dark' when the attribute is absent or unknown", () => {
    expect(readAppColorScheme()).toBe('dark');
    document.documentElement.setAttribute('data-color-scheme', 'sepia');
    expect(readAppColorScheme()).toBe('dark');
  });
});
