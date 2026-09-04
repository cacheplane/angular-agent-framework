// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { Select, TextArea, TextInput } from './controls';

describe('form controls', () => {
  it('TextInput takes id, described-by, and invalid from the surrounding Field', () => {
    render(
      <Field id="c-email" label="Work email" error="Enter a full address, like jordan@acme.dev.">
        <TextInput type="email" autoComplete="email" />
      </Field>
    );
    const input = screen.getByLabelText('Work email') as HTMLInputElement;
    expect(input.id).toBe('c-email');
    expect(input.getAttribute('data-ui')).toBe('form-control');
    expect(input.getAttribute('aria-describedby')).toBe('c-email-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.type).toBe('email');
    expect(input.autocomplete).toBe('email');
  });

  it('TextArea marks itself multiline and Select renders its options', () => {
    render(
      <>
        <Field id="c-msg" label="Message">
          <TextArea rows={3} />
        </Field>
        <Field id="c-when" label="Timeline">
          <Select defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="this_quarter">This quarter</option>
          </Select>
        </Field>
      </>
    );
    expect(screen.getByLabelText('Message').getAttribute('data-multiline')).toBe('');
    expect(screen.getByLabelText('Timeline').tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'This quarter' })).toBeTruthy();
  });

  it('accepts a compact size', () => {
    render(
      <Field id="c-nl" label="Email">
        <TextInput compact />
      </Field>
    );
    expect(screen.getByLabelText('Email').getAttribute('data-compact')).toBe('');
  });

  it('works outside a Field when given an explicit id', () => {
    render(<TextInput id="lone" aria-label="Lone" />);
    expect(screen.getByLabelText('Lone').id).toBe('lone');
  });

  it('lets an explicit id win over the Field id while keeping the field description', () => {
    render(
      <Field id="c-email" label="Work email" help="We reply from a real inbox.">
        <TextInput id="explicit" />
      </Field>
    );
    const input = screen.getByRole('textbox');
    expect(input.id).toBe('explicit');
    expect(input.getAttribute('aria-describedby')).toBe('c-email-help');
  });

  it('merges a caller aria-describedby after the field ids', () => {
    render(
      <Field id="c-email" label="Work email" error="Enter a full address, like jordan@acme.dev.">
        <TextInput aria-describedby="extra-note" />
      </Field>
    );
    expect(screen.getByLabelText('Work email').getAttribute('aria-describedby')).toBe('c-email-error extra-note');
  });
});
