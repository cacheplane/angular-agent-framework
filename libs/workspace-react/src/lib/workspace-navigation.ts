import type { MouseEvent as ReactMouseEvent } from 'react';
import type { WorkspaceHostServices } from './workspace-contracts';

interface HandleWorkspaceNavigationOptions {
  readonly event: ReactMouseEvent<HTMLAnchorElement>;
  readonly hostServices: WorkspaceHostServices;
  readonly onNavigate?: () => void;
}

export const readWorkspaceModeQuery = (
  searchParams: Pick<URLSearchParams, 'getAll'>
): string | null => {
  const modes = searchParams.getAll('mode');
  if (modes.length === 0) return null;
  return modes.length === 1 ? modes[0] : modes.join(',');
};

const isUnmodifiedPrimaryClick = (
  event: ReactMouseEvent<HTMLAnchorElement>
): boolean =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey &&
  !event.currentTarget.target &&
  !event.currentTarget.hasAttribute('download');

export const toSameOriginNavigationPath = (href: string): string | null => {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return null;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return null;
  }
};

export const handleWorkspaceNavigation = ({
  event,
  hostServices,
  onNavigate,
}: HandleWorkspaceNavigationOptions): void => {
  if (!isUnmodifiedPrimaryClick(event)) return;

  const path = toSameOriginNavigationPath(event.currentTarget.href);
  if (!path) return;

  if (!event.defaultPrevented) {
    event.preventDefault();
    hostServices.navigate({ path, restoreFocus: 'workspace-panel' });
  }
  onNavigate?.();
};
