import { useContext } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { FieldContext } from './field-context';

interface ControlExtras {
  /** Shorter control for the toast and the footer. */
  compact?: boolean;
}

function useControlAttributes(compact: boolean, explicitId: string | undefined) {
  const field = useContext(FieldContext);
  return {
    id: explicitId ?? field?.id,
    'aria-describedby': field?.describedBy,
    'aria-invalid': field?.invalid ? true : undefined,
    'data-ui': 'form-control' as const,
    'data-compact': compact ? '' : undefined,
  };
}

export function TextInput({ compact = false, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id);
  return <input {...attributes} {...rest} />;
}

export function TextArea({ compact = false, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id);
  return <textarea {...attributes} data-multiline="" {...rest} />;
}

export function Select({ compact = false, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & ControlExtras) {
  const attributes = useControlAttributes(compact, id);
  return (
    <select {...attributes} {...rest}>
      {children}
    </select>
  );
}
