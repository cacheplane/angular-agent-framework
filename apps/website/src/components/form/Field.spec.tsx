// @vitest-environment jsdom
import React, { useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { FieldContext } from './field-context';

function Probe() {
  const ctx = useContext(FieldContext);
  return <input data-testid="probe" id={ctx?.id} aria-describedby={ctx?.describedBy} aria-invalid={ctx?.invalid || undefined} />;
}

describe('Field', () => {
  it('labels the control by id and marks optional fields', () => {
    render(
      <Field id="f-email" label="Work email" optional>
        <Probe />
      </Field>
    );
    const label = screen.getByText('Work email', { selector: 'label' });
    expect(label.getAttribute('for')).toBe('f-email');
    expect(screen.getByText('(optional)')).toBeTruthy();
    expect(screen.getByTestId('probe').id).toBe('f-email');
  });

  it('wires help and error text through aria-describedby and sets aria-invalid', () => {
    render(
      <Field id="f-email" label="Work email" help="We reply from a real inbox." error="Enter a full address, like jordan@acme.dev.">
        <Probe />
      </Field>
    );
    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('aria-describedby')).toBe('f-email-help f-email-error');
    expect(probe.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.').id).toBe('f-email-error');
    expect(screen.getByText('We reply from a real inbox.').id).toBe('f-email-help');
  });

  it('omits aria-describedby when there is nothing to describe', () => {
    render(
      <Field id="f-name" label="Name">
        <Probe />
      </Field>
    );
    expect(screen.getByTestId('probe').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByTestId('probe').getAttribute('aria-invalid')).toBeNull();
  });
});
