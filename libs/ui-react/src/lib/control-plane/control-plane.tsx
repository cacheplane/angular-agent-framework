'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ChevronRight, X } from 'lucide-react';

type CommonProps = {
  className?: string;
};

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export interface ControlPlaneRailProps extends CommonProps {
  label: string;
  primaryLabel?: string;
  primary: ReactNode;
  utilities?: ReactNode;
}

export function ControlPlaneRail({
  label,
  primaryLabel,
  primary,
  utilities,
  className,
}: ControlPlaneRailProps) {
  const primaryLabelId = useId();
  return (
    <nav aria-label={label} className={className} data-control-plane-rail>
      <div
        data-control-plane-rail-group="primary"
        role={primaryLabel ? 'group' : undefined}
        aria-labelledby={primaryLabel ? primaryLabelId : undefined}
      >
        {primaryLabel ? (
          <span id={primaryLabelId} data-control-plane-rail-group-label>
            {primaryLabel}
          </span>
        ) : null}
        {primary}
      </div>
      {utilities ? (
        <div data-control-plane-rail-group="utilities">{utilities}</div>
      ) : null}
    </nav>
  );
}

export type ControlPlaneRailStatus = 'success' | 'working' | 'error';

export interface ControlPlaneRailItemStatus {
  kind: ControlPlaneRailStatus;
  label: string;
}

export interface ControlPlaneRailItemProps extends CommonProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  href?: string;
  onSelect?: () => void;
  iconOnly?: boolean;
  target?: string;
  rel?: string;
  status?: ControlPlaneRailItemStatus;
}

export function ControlPlaneRailItem({
  label,
  icon,
  active = false,
  disabled = false,
  disabledReason,
  href,
  onSelect,
  iconOnly = false,
  className,
  target,
  rel,
  status,
}: ControlPlaneRailItemProps) {
  const tooltipId = useId();
  const disabledReasonId = useId();
  const accessibleName = status ? `${label}, ${status.label}` : label;
  // An icon-only item needs a tooltip because it has no visible label. A
  // status item needs its status in the accessible name, which `aria-label`
  // already supplies -- it must not also get the rail tooltip, whose
  // positioning is authored for the narrow icon rail.
  const needsAccessibleName = iconOnly || Boolean(status);
  const showTooltip = iconOnly;
  const content = (
    <>
      <span data-control-plane-rail-icon>{icon}</span>
      {iconOnly ? null : <span data-control-plane-rail-label>{label}</span>}
      {status ? (
        <span data-control-plane-rail-status={status.kind} aria-hidden="true" />
      ) : null}
      {status && !iconOnly ? (
        <span style={visuallyHidden}>{status.label}</span>
      ) : null}
      {showTooltip ? (
        <span id={tooltipId} role="tooltip" data-control-plane-tooltip>
          {accessibleName}
        </span>
      ) : null}
    </>
  );
  const reason =
    disabled && disabledReason ? (
      <span id={disabledReasonId} style={visuallyHidden}>
        {disabledReason}
      </span>
    ) : null;
  const shared = {
    className,
    'data-control-plane-rail-item': true,
    'data-control-plane-active': active || undefined,
    'data-control-plane-disabled': disabled || undefined,
    'aria-label': needsAccessibleName ? accessibleName : undefined,
    'aria-describedby':
      [
        showTooltip ? tooltipId : null,
        disabled && disabledReason ? disabledReasonId : null,
      ]
        .filter(Boolean)
        .join(' ') || undefined,
  } as const;

  if (href) {
    return (
      <>
        <a
          {...shared}
          href={href}
          target={target}
          rel={rel}
          aria-current={active ? 'page' : undefined}
          aria-disabled={disabled || undefined}
          onClick={(event) => {
            if (disabled) event.preventDefault();
            else onSelect?.();
          }}
        >
          {content}
        </a>
        {reason}
      </>
    );
  }

  return (
    <>
      <button
        {...shared}
        type="button"
        aria-pressed={active}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) onSelect?.();
        }}
      >
        {content}
      </button>
      {reason}
    </>
  );
}

export interface ControlPlanePaneProps extends CommonProps {
  label: string;
  children: ReactNode;
}

export function ControlPlanePane({
  label,
  children,
  className,
}: ControlPlanePaneProps) {
  return (
    <aside aria-label={label} className={className} data-control-plane-pane>
      {children}
    </aside>
  );
}

export interface ControlPlaneSectionProps extends CommonProps {
  title: string;
  icon?: ReactNode;
  summary?: ReactNode;
  description?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  collapsible?: boolean;
}

export function ControlPlaneSection({
  title,
  icon,
  summary,
  description,
  open = true,
  onOpenChange,
  children,
  className,
  collapsible = true,
}: ControlPlaneSectionProps) {
  const id = useId();
  const descriptionId = useId();
  return (
    <section className={className} data-control-plane-section>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-describedby={description ? descriptionId : undefined}
          onClick={() => onOpenChange?.(!open)}
          data-control-plane-section-trigger
        >
          <span data-control-plane-section-title>
            {icon ? <span data-control-plane-section-icon>{icon}</span> : null}
            {title}
          </span>
          <span data-control-plane-section-end>
            {summary ? (
              <span data-control-plane-section-summary aria-hidden="true">
                {summary}
              </span>
            ) : null}
            <ChevronRight
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              data-control-plane-chevron
              data-control-plane-section-chevron
            />
          </span>
        </button>
      ) : (
        <h2 data-control-plane-section-heading>
          {icon ? <span data-control-plane-section-icon>{icon}</span> : null}
          {title}
        </h2>
      )}
      {collapsible && description ? (
        <span
          id={descriptionId}
          style={visuallyHidden}
          data-control-plane-section-description
        >
          {description}
        </span>
      ) : null}
      {open ? (
        <div id={id} data-control-plane-section-content>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export interface ControlPlaneEnvironmentRow {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export function ControlPlaneEnvironmentList({
  rows,
  className,
}: CommonProps & { rows: ControlPlaneEnvironmentRow[] }) {
  return (
    <dl className={className} data-control-plane-environment-list>
      {rows.map((row) => (
        <div key={row.label} data-control-plane-environment-row>
          {row.icon ? (
            <span data-control-plane-environment-icon>{row.icon}</span>
          ) : null}
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type ToolbarChildProps = { tabIndex?: number; disabled?: boolean };

export function ControlPlaneActionBar({
  label,
  children,
  className,
}: CommonProps & { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  let assignedTabStop = false;
  const items = Children.map(children, (child) => {
    if (!isValidElement<ToolbarChildProps>(child)) return child;
    const enabled = !child.props.disabled;
    const tabIndex = enabled && !assignedTabStop ? 0 : -1;
    if (enabled) assignedTabStop = true;
    return cloneElement(child as ReactElement<ToolbarChildProps>, { tabIndex });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const enabled = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(
        '[data-control-plane-action]:not(:disabled):not([aria-disabled="true"])'
      ) ?? []
    );
    if (enabled.length === 0) return;
    const current = Math.max(
      0,
      enabled.indexOf(document.activeElement as HTMLElement)
    );
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? enabled.length - 1
        : event.key === 'ArrowRight'
        ? (current + 1) % enabled.length
        : (current - 1 + enabled.length) % enabled.length;
    event.preventDefault();
    enabled.forEach((item, index) => {
      item.tabIndex = index === nextIndex ? 0 : -1;
    });
    enabled[nextIndex]?.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      className={className}
      data-control-plane-action-bar
      onKeyDown={onKeyDown}
    >
      {items}
    </div>
  );
}

export interface ControlPlaneIconButtonProps extends CommonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tabIndex?: number;
  target?: string;
  rel?: string;
}

export function ControlPlaneIconButton({
  label,
  icon,
  onClick,
  href,
  disabled = false,
  tabIndex,
  className,
  target,
  rel,
}: ControlPlaneIconButtonProps) {
  const tooltipId = useId();
  const content = (
    <>
      {icon}
      <span id={tooltipId} role="tooltip" data-control-plane-tooltip>
        {label}
      </span>
    </>
  );
  const shared = {
    'aria-label': label,
    'aria-describedby': tooltipId,
    className,
    tabIndex,
    'data-control-plane-action': true,
  } as const;
  if (href) {
    return (
      <a
        {...shared}
        href={href}
        target={target}
        rel={rel}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
          else onClick?.();
        }}
      >
        {content}
      </a>
    );
  }
  return (
    <button {...shared} type="button" disabled={disabled} onClick={onClick}>
      {content}
    </button>
  );
}

export function ControlPlaneUtilityPanel({
  title,
  onClose,
  children,
  className,
}: CommonProps & { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      className={className}
      data-control-plane-utility-panel
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        onClose();
      }}
    >
      <header data-control-plane-utility-header>
        <h2 ref={titleRef} id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <button type="button" aria-label={`Close ${title}`} onClick={onClose}>
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      <div data-control-plane-utility-content>{children}</div>
    </section>
  );
}
