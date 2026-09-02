'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  cockpitManifest,
  type CockpitManifestEntry,
  type WorkspaceMode,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import {
  toCockpitPath,
  type ContentBundle,
  type NavigationProduct,
  type WorkspacePresentation,
} from '@threadplane/cockpit-shell';
import { ThemeToggle } from '@threadplane/ui-react';
import {
  WorkspaceProvider,
  WorkspaceShell,
  resolveDocsUrl,
  type RuntimeTerminalTransition,
  type TrackModeChange,
  type TrackNarrativeAction,
  type TrackNavigation,
  type TrackRuntimeAction,
  type TrackRuntimeTransition,
} from '@threadplane/workspace-react';
import { BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { track } from '../lib/analytics/client';
import { getCockpitSessionId } from '../lib/analytics/distinct-id';
import type { CockpitRuntimeStatusChangedProps } from '../lib/analytics/events';

export interface CockpitShellProps {
  readonly navigationTree: NavigationProduct[];
  readonly resolution: WorkspaceResolution;
  readonly presentation: WorkspacePresentation;
  readonly contentBundle: ContentBundle;
  readonly routePath: string;
  readonly requestedMode: string | null;
}

const MODE_ANALYTICS: Record<WorkspaceMode, 'run' | 'code' | 'docs' | 'api'> = {
  Run: 'run',
  Code: 'code',
  Docs: 'docs',
  API: 'api',
};

const WORKSPACE_PANEL_FOCUS_INTENT =
  'threadplane:cockpit:workspace-panel-focus';
const WORKSPACE_PANEL_FOCUS_MAX_AGE_MS = 10_000;
const RUNTIME_FRAME_TELEMETRY = {
  posthogToken: process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN,
  ingestHost: process.env.NEXT_PUBLIC_COCKPIT_INGEST_HOST,
};

function toRuntimeStatusChangedProps(
  transition: RuntimeTerminalTransition
): CockpitRuntimeStatusChangedProps {
  const common = {
    capability: transition.capability,
    ...(transition.elapsedMs !== undefined &&
    Number.isFinite(transition.elapsedMs)
      ? { elapsed_ms: transition.elapsedMs }
      : {}),
  };

  switch (transition.toState) {
    case 'ready':
      return transition.fromState === 'unresponsive' ||
        transition.fromState === 'error'
        ? {
            ...common,
            from_state: transition.fromState,
            to_state: 'ready',
            transition: 'recovered',
          }
        : { ...common, from_state: transition.fromState, to_state: 'ready' };
    case 'unresponsive':
      return {
        ...common,
        from_state: transition.fromState,
        to_state: 'unresponsive',
      };
    case 'error':
      return {
        ...common,
        from_state: transition.fromState,
        to_state: 'error',
        ...(transition.reasonCode === 'bootstrap_failed'
          ? { reason_code: transition.reasonCode }
          : {}),
      };
    case 'invalid_configuration':
      return {
        ...common,
        from_state: transition.fromState,
        to_state: 'invalid_configuration',
        ...(transition.reasonCode === 'invalid_runtime_url'
          ? { reason_code: transition.reasonCode }
          : {}),
      };
  }
}

const trackNavigation: TrackNavigation = ({
  capability,
  category,
  fromCapability,
}) => {
  track('cockpit:recipe_opened', {
    capability,
    category,
    from_capability: fromCapability,
  });
};

const trackNarrativeAction: TrackNarrativeAction = ({
  capability,
  surface,
}) => {
  track('cockpit:code_copied', { capability, surface });
};

const trackModeChange: TrackModeChange = ({ capability, fromMode, toMode }) => {
  track('cockpit:mode_switched', {
    capability,
    from_mode: MODE_ANALYTICS[fromMode],
    to_mode: MODE_ANALYTICS[toMode],
  });
};

const trackRuntimeAction: TrackRuntimeAction = (event) => {
  switch (event.action) {
    case 'recheck':
    case 'reload':
      track('cockpit:runtime_action', {
        capability: event.capability,
        action: event.action,
        state_before: event.stateBefore,
        outcome: event.outcome,
      });
      break;
    case 'open':
      track('cockpit:runtime_action', {
        capability: event.capability,
        action: event.action,
        state_before: event.stateBefore,
        outcome: event.outcome,
      });
      break;
    case 'copy_diagnostics':
      track('cockpit:runtime_action', {
        capability: event.capability,
        action: event.action,
        state_before: event.stateBefore,
        outcome: event.outcome,
      });
      break;
  }
};

const trackRuntimeTransition: TrackRuntimeTransition = (transition) => {
  track(
    'cockpit:runtime_status_changed',
    toRuntimeStatusChangedProps(transition)
  );
};

const modeHref = (mode: WorkspaceMode): string => {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode.toLowerCase());
  return `${url.pathname}${url.search}${url.hash}`;
};

export function CockpitShell({
  navigationTree,
  resolution,
  presentation,
  contentBundle,
  routePath,
  requestedMode,
}: CockpitShellProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const pushIdentity = useCallback(
    (
      href: string,
      options?: {
        restoreFocus?: 'mobile-navigation-trigger' | 'workspace-panel';
      }
    ) => {
      if (options?.restoreFocus === 'workspace-panel') {
        const currentDestination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (href !== currentDestination) {
          try {
            window.sessionStorage.setItem(
              WORKSPACE_PANEL_FOCUS_INTENT,
              JSON.stringify({ destination: href, requestedAt: Date.now() })
            );
          } catch {
            // Client navigation still works if session storage is unavailable.
          }
        }
      }
      routerRef.current.push(href);
    },
    []
  );
  const pushMode = useCallback((mode: WorkspaceMode) => {
    routerRef.current.push(modeHref(mode));
  }, []);
  const replaceMode = useCallback((mode: WorkspaceMode) => {
    routerRef.current.replace(modeHref(mode));
  }, []);
  const resolveIdentityHref = useCallback(
    (entry: CockpitManifestEntry) => toCockpitPath(entry),
    []
  );

  useEffect(() => {
    let rawIntent: string | null = null;
    try {
      rawIntent = window.sessionStorage.getItem(WORKSPACE_PANEL_FOCUS_INTENT);
    } catch {
      return undefined;
    }
    if (!rawIntent) return undefined;

    let intent: { destination?: unknown; requestedAt?: unknown };
    try {
      intent = JSON.parse(rawIntent) as typeof intent;
    } catch {
      window.sessionStorage.removeItem(WORKSPACE_PANEL_FOCUS_INTENT);
      return undefined;
    }
    const currentDestination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const isFresh =
      typeof intent.requestedAt === 'number' &&
      Date.now() - intent.requestedAt <= WORKSPACE_PANEL_FOCUS_MAX_AGE_MS;
    if (!isFresh) {
      window.sessionStorage.removeItem(WORKSPACE_PANEL_FOCUS_INTENT);
      return undefined;
    }
    if (intent.destination !== currentDestination) return undefined;

    window.sessionStorage.removeItem(WORKSPACE_PANEL_FOCUS_INTENT);
    const focusPanel = () => {
      const panel = document.querySelector<HTMLElement>(
        '[data-workspace-panel-target]:not([aria-hidden="true"])'
      );
      if (!panel?.closest('[inert]')) panel?.focus();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(focusPanel);
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(focusPanel, 0);
    return () => window.clearTimeout(timer);
  }, [routePath]);

  const docsUrl = resolveDocsUrl(presentation.docsPath);
  const headerActions = useMemo(
    () =>
      docsUrl ? (
        <a
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] no-underline"
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen size={14} aria-hidden="true" />
          Read docs
        </a>
      ) : null,
    [docsUrl]
  );

  return (
    <WorkspaceProvider
      resolution={resolution}
      presentation={presentation}
      contentBundle={contentBundle}
      routeKind="workspace"
      routePath={routePath}
      requestedMode={requestedMode}
      pushIdentity={pushIdentity}
      pushMode={pushMode}
      replaceMode={replaceMode}
      resolveIdentityHref={resolveIdentityHref}
      getSessionId={getCockpitSessionId}
      runtimeTelemetry={RUNTIME_FRAME_TELEMETRY}
      trackNavigation={trackNavigation}
      trackNarrativeAction={trackNarrativeAction}
      trackModeChange={trackModeChange}
      trackRuntimeAction={trackRuntimeAction}
      trackRuntimeTransition={trackRuntimeTransition}
    >
      <WorkspaceShell
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        themeControl={<ThemeToggle className="cockpit-control-plane-theme" />}
        headerActions={headerActions}
        ariaLabel="Cockpit shell"
        modeNavigationLabel="Cockpit modes"
        contextPaneLabel="Cockpit context"
        mobileDialogLabel="Cockpit control plane"
        mobileTitle="Cockpit"
      />
    </WorkspaceProvider>
  );
}
