'use client';
import { useContext } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { FieldContext } from './field-context';

interface ControlExtras {
  /** Shorter control for the toast and the footer. */
  compact?: boolean;
}

/**
 * Field-derived describedby ids come first, then any caller-supplied ids.
 * An explicit `id` prop still overrides the field's id.
 */
function useControlAttributes(
  compact: boolean,
  explicitId: string | undefined,
  callerDescribedBy: string | undefined
) {
  const field = useContext(FieldContext);
  const describedBy = [field?.describedBy, callerDescribedBy].filter(Boolean).join(' ') || undefined;
  return {
    id: explicitId ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': field?.invalid ? true : undefined,
    'data-ui': 'form-control' as const,
    'data-compact': compact ? '' : undefined,
  };
}

export function TextInput({
  compact = false,
  id,
  'aria-describedby': describedBy,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id, describedBy);
  return <input {...attributes} {...rest} />;
}

export function TextArea({
  compact = false,
  id,
  'aria-describedby': describedBy,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id, describedBy);
  return <textarea {...attributes} data-multiline="" {...rest} />;
}

export function Select({
  compact = false,
  id,
  'aria-describedby': describedBy,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id, describedBy);
  return (
    <select {...attributes} {...rest}>
      {children}
    </select>
  );
}
