import type { ReactNode } from 'react';

type Tone = 'success' | 'failure' | 'stale';

interface FormStatusProps {
  tone: Tone;
  title: string;
  detail?: ReactNode;
  /** Optional follow-up: a link, a retry button, a refresh button. */
  children?: ReactNode;
}

const ICON: Record<Tone, string> = { success: '✓', failure: '!', stale: '↻' };

export function FormStatus({ tone, title, detail, children }: FormStatusProps) {
  const role = tone === 'success' ? 'status' : 'alert';
  return (
    <div data-ui="form-status" data-tone={tone} role={role}>
      <span data-ui="form-status-icon" aria-hidden="true">{ICON[tone]}</span>
      <div data-ui="form-status-body">
        <p>
          <strong>{title}</strong>
          {detail ? <> {detail}</> : null}
        </p>
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
