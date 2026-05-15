import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateThemeCss } from '../../scripts/generate-theme-css';

const COMMITTED_PATH = resolve(__dirname, 'theme.css');

describe('generate-theme-css', () => {
  it('produces output that matches the committed theme.css', () => {
    const expected = readFileSync(COMMITTED_PATH, 'utf-8');
    const actual = generateThemeCss();
    expect(actual).toBe(expected);
  });
});
