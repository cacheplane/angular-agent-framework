import { createContext } from 'react';

export interface FieldControlContext {
  /** id the label points at; the control must render it as its id. */
  id: string;
  /** Space-separated ids of help and error text, or undefined when neither exists. */
  describedBy: string | undefined;
  /** True while the field shows an error. */
  invalid: boolean;
}

export const FieldContext = createContext<FieldControlContext | null>(null);
