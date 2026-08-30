import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateThemeCss, generateTokensCss, generateTokensDarkCss } from '../../scripts/generate-theme-css';

const COMMITTED_PATH = resolve(__dirname, 'theme.css');
const COMMITTED_TOKENS_PATH = resolve(__dirname, 'tokens.css');
const COMMITTED_TOKENS_DARK_PATH = resolve(__dirname, 'tokens-dark.css');

describe('generate-theme-css', () => {
  it('produces output that matches the committed theme.css', () => {
    const expected = readFileSync(COMMITTED_PATH, 'utf-8');
    const actual = generateThemeCss();
    expect(actual).toBe(expected);
  });

  it('produces output that matches the committed tokens.css', () => {
    const expected = readFileSync(COMMITTED_TOKENS_PATH, 'utf-8');
    const actual = generateTokensCss();
    expect(actual).toBe(expected);
  });

  it('produces output that matches the committed tokens-dark.css', () => {
    const expected = readFileSync(COMMITTED_TOKENS_DARK_PATH, 'utf-8');
    const actual = generateTokensDarkCss();
    expect(actual).toBe(expected);
  });

  it('light and dark tokens files define the same --ds-* names', () => {
    const names = (css: string) =>
      [...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]).sort();
    expect(names(readFileSync(COMMITTED_TOKENS_DARK_PATH, 'utf-8'))).toEqual(
      names(readFileSync(COMMITTED_TOKENS_PATH, 'utf-8')),
    );
  });
});
