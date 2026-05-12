import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Elevation = 'sm' | 'md' | 'lg';

interface BrowserFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Faux URL shown in the address bar. */
  url?: string;
  /** Degrees of rotation for collage stacking. */
  rotate?: number;
  /** Elevation tier — defaults to `md`. */
  elevation?: Elevation;
  /** Optional max-width override. */
  maxWidth?: number | string;
}

const ELEVATION: Record<Elevation, string> = {
  sm: tokens.shadows.sm,
  md: tokens.shadows.md,
  lg: tokens.shadows.lg,
};

export function BrowserFrame({
  children,
  url,
  rotate = 0,
  elevation = 'md',
  maxWidth,
  className,
  style,
  ...rest
}: BrowserFrameProps) {
  return (
    <div
      data-ui="browser-frame"
      className={cn(className)}
      style={{
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: ELEVATION[elevation],
        overflow: 'hidden',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        maxWidth,
        ...style,
      }}
      {...rest}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: tokens.surfaces.surfaceTinted,
          borderBottom: `1px solid ${tokens.surfaces.border}`,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#FF5F57' }} />
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#FEBC2E' }} />
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#28C840' }} />
        </div>
        {/* URL pill */}
        {url ? (
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: tokens.typography.fontMono,
              fontSize: 11,
              color: tokens.colors.textMuted,
              background: tokens.surfaces.surface,
              border: `1px solid ${tokens.surfaces.border}`,
              borderRadius: tokens.radius.sm,
              padding: '4px 10px',
              maxWidth: 360,
              margin: '0 auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </div>
        ) : null}
        {/* Right spacer to balance traffic lights */}
        <div style={{ width: 54 }} aria-hidden="true" />
      </div>

      {/* Frame body */}
      <div data-ui="browser-frame-body" style={{ position: 'relative', background: tokens.surfaces.surface }}>
        {children}
      </div>
    </div>
  );
}
