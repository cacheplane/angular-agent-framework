'use client';
import type { ReactNode } from 'react';
import { FieldContext } from './field-context';

interface FieldProps {
  /** Control id. The label's `for` and the control's `id` both use it. */
  id: string;
  label: ReactNode;
  optional?: boolean;
  help?: ReactNode;
  /** Error copy. Present means the field is invalid. */
  error?: string | null;
  children: ReactNode;
}

export function Field({ id, label, optional = false, help, error, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div data-ui="field">
      <label data-ui="field-label" htmlFor={id}>
        {label}
        {optional ? <> <span data-ui="field-optional">(optional)</span></> : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {help ? (
        <p data-ui="field-help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p data-ui="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
