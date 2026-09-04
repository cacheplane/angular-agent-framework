// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormStatus } from './FormStatus';

describe('FormStatus', () => {
  it('announces success politely', () => {
    render(<FormStatus tone="success" title="Sent." detail="Expect a reply within one business day." />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('data-tone')).toBe('success');
    expect(status.textContent).toContain('Sent.');
    expect(status.textContent).toContain('Expect a reply within one business day.');
  });

  it('announces failure as an alert and renders an action', () => {
    render(
      <FormStatus tone="failure" title="That did not send." detail="Email brian@threadplane.ai instead.">
        <a href="/whitepaper.pdf">Download the PDF directly</a>
      </FormStatus>
    );
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-tone')).toBe('failure');
    expect(screen.getByRole('link', { name: 'Download the PDF directly' })).toBeTruthy();
  });

  it('announces the stale tone as an alert', () => {
    render(<FormStatus tone="stale" title="This page is out of date." detail="Refresh to continue." />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-tone')).toBe('stale');
    expect(alert.textContent).toContain('This page is out of date.');
  });
});
