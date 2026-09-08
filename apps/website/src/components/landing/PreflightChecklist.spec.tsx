import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PreflightChecklist } from './PreflightChecklist';
import { PREFLIGHT_OURS, PREFLIGHT_YOURS, AIRWORTHINESS } from '../../lib/preflight-checklist';

describe('PreflightChecklist', () => {
  it('renders one row per data row', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('.preflight-row')).toHaveLength(
      PREFLIGHT_OURS.length + PREFLIGHT_YOURS.length + AIRWORTHINESS.length,
    );
  });

  it('links every ticked row and none of the Yours rows', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('a.preflight-row')).toHaveLength(
      PREFLIGHT_OURS.length + AIRWORTHINESS.length,
    );
    for (const a of Array.from(container.querySelectorAll('a.preflight-row'))) {
      expect(a.getAttribute('href')).toBeTruthy();
    }
  });

  it('draws the boxes rather than using form controls', () => {
    // Nothing here is interactive. An <input type="checkbox"> would tell a
    // screen reader it can be toggled, which is a lie.
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('.preflight-box')).toHaveLength(
      PREFLIGHT_OURS.length + PREFLIGHT_YOURS.length + AIRWORTHINESS.length,
    );
  });

  it('names each column list so two adjacent lists are distinguishable', () => {
    const { container } = render(<PreflightChecklist />);
    const lists = Array.from(container.querySelectorAll('ul[aria-labelledby]'));
    expect(lists).toHaveLength(3);
    for (const ul of lists) {
      const label = container.querySelector(`#${ul.getAttribute('aria-labelledby')}`);
      expect(label?.textContent).toBeTruthy();
    }
  });

  it('keeps the HVTrust grade a live badge with real alt text', () => {
    const { container } = render(<PreflightChecklist />);
    const badge = container.querySelector('img.preflight-badge');
    expect(badge?.getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
    // Not decorative: it carries the grade, so it needs a real description.
    expect(badge?.getAttribute('alt')).toBeTruthy();
    expect(badge?.getAttribute('alt')).not.toBe('');
  });

  it('opens off-site sources safely in a new tab', () => {
    const { container } = render(<PreflightChecklist />);
    for (const a of Array.from(container.querySelectorAll('a.preflight-row'))) {
      const href = a.getAttribute('href')!;
      if (!href.startsWith('http')) continue;
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
