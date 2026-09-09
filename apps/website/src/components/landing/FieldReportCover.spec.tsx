// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldReportCover } from './FieldReportCover';
import { FIELD_REPORT } from '../../lib/field-report';

describe('FieldReportCover', () => {
  it('shows every chapter, in order', () => {
    const { container } = render(<FieldReportCover />);
    const items = Array.from(container.querySelectorAll('.field-report-toc li'));
    expect(items.map((li) => li.textContent?.replace(/^\d+/, '').trim())).toEqual([
      ...FIELD_REPORT.chapters,
    ]);
  });

  it('is readable rather than decorative', () => {
    // The old .wp-cover-wrap is aria-hidden because it is artwork. This one
    // carries the table of contents, which is the reason to download — hiding
    // it would withhold the substance from screen reader users.
    const { container } = render(<FieldReportCover />);
    expect(container.querySelector('[aria-hidden="true"].field-report-paper')).toBeNull();
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(FIELD_REPORT.title);
    expect(container.querySelector('ol.field-report-toc')).toBeTruthy();
  });

  it('does not read the numbers twice', () => {
    // The <ol> already numbers the list for assistive tech; the drawn 01/02
    // markers are visual duplicates and must be hidden.
    const { container } = render(<FieldReportCover />);
    const nums = Array.from(container.querySelectorAll('.field-report-num'));
    expect(nums).toHaveLength(FIELD_REPORT.chapters.length);
    for (const n of nums) expect(n.getAttribute('aria-hidden')).toBe('true');
  });

  it('borrows the library pages’ paper styling', () => {
    // Same object the four library pages already show, so it is not a second
    // visual language for the same artifact.
    const { container } = render(<FieldReportCover />);
    expect(container.querySelector('.wp-paper.field-report-paper')).toBeTruthy();
  });
});
