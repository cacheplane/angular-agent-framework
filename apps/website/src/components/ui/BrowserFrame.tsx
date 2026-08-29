import type { ReactNode, HTMLAttributes } from 'react';
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
      data-elevation={elevation}
      className={cn(className)}
      style={{
        // Genuinely dynamic — computed from unbounded caller props, so these
        // stay inline. Everything else here is static and lives in ui.css.
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        maxWidth,
        ...style,
      }}
      {...rest}
    >
      {/* Title bar */}
      <div data-ui="browser-frame-titlebar">
        {/* Traffic lights */}
        <div data-ui="browser-frame-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {/* URL pill */}
        {url ? <div data-ui="browser-frame-url">{url}</div> : null}
        {/* Right spacer to balance traffic lights */}
        <div data-ui="browser-frame-spacer" aria-hidden="true" />
      </div>

      {/* Frame body */}
      <div data-ui="browser-frame-body">{children}</div>
    </div>
  );
}
