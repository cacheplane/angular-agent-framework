'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type CockpitManifestEntry,
  getCanonicalWebsiteWorkspaceHref,
  getWorkspaceDestinationPath,
  type WorkspaceMode,
  type WorkspaceResolution,
} from '@threadplane/cockpit-registry';
import type {
  ContentBundle,
  NavigationProduct,
  WorkspacePresentation,
} from '@threadplane/cockpit-shell';
import {
  WorkspaceProvider,
  WorkspaceShell,
  RuntimeTargetProvider,
  readWorkspaceModeQuery,
  type RuntimeTerminalTransition,
  type TrackModeChange,
  type TrackNarrativeAction,
  type TrackNavigation,
  type TrackRuntimeAction,
  type TrackRuntimeTransition,
  type WorkspaceContextPaneRenderer,
  type WorkspaceCrumb,
} from '@threadplane/workspace-react';
import { ThemeProvider } from '@threadplane/ui-react';
import { usePathname, useRouter } from 'next/navigation';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import {
  DocsContextContent,
  type DocsControlPlaneProps,
} from '../docs/DocsControlPlane';

export interface WebsiteWorkspaceProps {
  readonly resolution: WorkspaceResolution;
  readonly presentation: WorkspacePresentation;
  readonly contentBundle: ContentBundle;
  readonly navigationTree: NavigationProduct[];
  readonly routePath: string;
  /** Test/alternate-host override. Website routes normally read this in-browser. */
  readonly requestedMode?: string | null;
  readonly docsSlot?: ReactNode;
  readonly docsContext?: DocsControlPlaneProps;
  /** Docs routes supply their own trail; workspace routes keep the derived one. */
  readonly contextTrail?: readonly WorkspaceCrumb[];
}

interface WebsiteWorkspaceRegistration {
  readonly token: object;
  readonly props: WebsiteWorkspaceProps;
}

interface WebsiteWorkspaceLayoutContextValue {
  readonly activeToken: object | null;
  readonly register: (token: object, props: WebsiteWorkspaceProps) => void;
  readonly unregister: (token: object) => void;
}

const WebsiteWorkspaceLayoutContext =
  createContext<WebsiteWorkspaceLayoutContextValue | null>(null);

interface DiscoveredRouteMode {
  readonly routePath: string;
  readonly mode: string | null;
}

const MODE_ANALYTICS: Record<WorkspaceMode, string> = {
  Docs: 'docs',
  Run: 'run',
  Code: 'code',
  API: 'api',
};

const WORKSPACE_PANEL_FOCUS_INTENT =
  'threadplane:website:workspace-panel-focus';
const WORKSPACE_PANEL_FOCUS_MAX_AGE_MS = 10_000;

const RUNTIME_FRAME_TELEMETRY = {
  posthogToken: process.env.NEXT_PUBLIC_POSTHOG_TOKEN,
};

let workspaceSessionId: string | null = null;

function getWebsiteWorkspaceSessionId(): string {
  if (!workspaceSessionId) {
    workspaceSessionId = `website_workspace_${globalThis.crypto.randomUUID()}`;
  }
  return workspaceSessionId;
}

const trackNavigation: TrackNavigation = ({
  capability,
  category,
  fromCapability,
}) => {
  track(analyticsEvents.docsWorkspaceNavigation, {
    surface: 'docs',
    capability,
    category,
    from_capability: fromCapability,
  });
};

const trackNarrativeAction: TrackNarrativeAction = ({
  capability,
  surface,
}) => {
  track(analyticsEvents.docsWorkspaceNarrativeAction, {
    surface: 'docs',
    capability,
    narrative_surface: surface,
  });
};

const trackModeChange: TrackModeChange = ({ capability, fromMode, toMode }) => {
  track(analyticsEvents.docsWorkspaceModeSwitched, {
    surface: 'docs',
    capability,
    from_mode: MODE_ANALYTICS[fromMode],
    to_mode: MODE_ANALYTICS[toMode],
  });
};

const trackRuntimeAction: TrackRuntimeAction = (event) => {
  track(analyticsEvents.docsWorkspaceRuntimeAction, {
    surface: 'docs',
    capability: event.capability,
    action: event.action,
    state_before: event.stateBefore,
    outcome: event.outcome,
  });
};

const trackRuntimeTransition: TrackRuntimeTransition = (
  transition: RuntimeTerminalTransition
) => {
  track(analyticsEvents.docsWorkspaceRuntimeStatusChanged, {
    surface: 'docs',
    capability: transition.capability,
    from_state: transition.fromState,
    to_state: transition.toState,
    ...(transition.elapsedMs === undefined
      ? {}
      : { elapsed_ms: transition.elapsedMs }),
    ...(transition.reasonCode === undefined
      ? {}
      : { reason_code: transition.reasonCode }),
  });
};

const resolveIdentityHref = (entry: CockpitManifestEntry): string =>
  getWorkspaceDestinationPath(entry);

function WebsiteWorkspaceSurface({
  resolution,
  presentation,
  contentBundle,
  navigationTree,
  routePath,
  requestedMode,
  docsSlot,
  docsContext,
  contextTrail,
}: WebsiteWorkspaceProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [discoveredRouteMode, setDiscoveredRouteMode] =
    useState<DiscoveredRouteMode | null>(null);
  const routeMode =
    requestedMode !== undefined
      ? requestedMode
      : discoveredRouteMode?.routePath === routePath
      ? discoveredRouteMode.mode
      : null;

  const synchronizeRouteMode = useCallback(
    (mode: string | null) => {
      if (requestedMode !== undefined) return;
      setDiscoveredRouteMode({ routePath, mode });
    },
    [requestedMode, routePath]
  );

  useEffect(() => {
    if (requestedMode !== undefined) return;
    const discoverCurrentMode = () => {
      const currentUrl = new URL(window.location.href);
      const destinationPath = new URL(routePath, window.location.origin)
        .pathname;
      if (currentUrl.pathname !== destinationPath) return;
      setDiscoveredRouteMode({
        routePath,
        mode: readWorkspaceModeQuery(currentUrl.searchParams),
      });
    };
    discoverCurrentMode();
    window.addEventListener('popstate', discoverCurrentMode);
    return () => window.removeEventListener('popstate', discoverCurrentMode);
  }, [requestedMode, routePath]);

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
            // Navigation still works when storage is unavailable.
          }
        }
      }
      routerRef.current.push(href);
    },
    []
  );

  const pushMode = useCallback(
    (mode: WorkspaceMode) => {
      const href = getCanonicalWebsiteWorkspaceHref(resolution, mode);
      synchronizeRouteMode(
        readWorkspaceModeQuery(
          new URL(href, window.location.origin).searchParams
        )
      );
      routerRef.current.push(href);
    },
    [resolution, synchronizeRouteMode]
  );

  const replaceMode = useCallback(
    (mode: WorkspaceMode) => {
      const href = getCanonicalWebsiteWorkspaceHref(resolution, mode);
      synchronizeRouteMode(
        readWorkspaceModeQuery(
          new URL(href, window.location.origin).searchParams
        )
      );
      routerRef.current.replace(href);
    },
    [resolution, synchronizeRouteMode]
  );

  const renderContextPane = useCallback<WorkspaceContextPaneRenderer>(
    ({ onNavigate, onAction }) => {
      if (!docsContext) return null;
      return (
        <DocsContextContent
          {...docsContext}
          mobile={Boolean(onAction)}
          onNavigate={onNavigate}
          onSearchHandoff={onAction ? () => onAction('search-docs') : undefined}
        />
      );
    },
    [docsContext]
  );

  const handleContextAction = useCallback((action: string) => {
    if (action !== 'search-docs') return;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true })
    );
  }, []);

  const handleMobileModalPresenceChange = useCallback((present: boolean) => {
    const isolate = (element: HTMLElement | null) => {
      if (!element) return;
      element.inert = present;
      if (present) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    };
    isolate(document.querySelector<HTMLElement>('[data-site-navigation]'));
    const announcementRegion = document.querySelector<HTMLElement>(
      '[data-announcement-region]'
    );
    isolate(announcementRegion);
    announcementRegion?.toggleAttribute('data-workspace-modal-hidden', present);
  }, []);

  useEffect(
    () => () => handleMobileModalPresenceChange(false),
    [handleMobileModalPresenceChange]
  );

  return (
    <ThemeProvider theme="light">
      <div className="website-workspace-host" data-website-workspace-host="">
        <WorkspaceProvider
          resolution={resolution}
          presentation={presentation}
          contentBundle={contentBundle}
          routeKind="docs"
          routePath={routePath}
          requestedMode={routeMode}
          docsSlot={docsSlot}
          pushIdentity={pushIdentity}
          pushMode={pushMode}
          replaceMode={replaceMode}
          resolveIdentityHref={resolveIdentityHref}
          getSessionId={getWebsiteWorkspaceSessionId}
          runtimeTelemetry={RUNTIME_FRAME_TELEMETRY}
          trackNavigation={trackNavigation}
          trackNarrativeAction={trackNarrativeAction}
          trackModeChange={trackModeChange}
          trackRuntimeAction={trackRuntimeAction}
          trackRuntimeTransition={trackRuntimeTransition}
        >
          <WorkspaceShell
            rootElement="section"
            navigationTree={navigationTree}
            contextTrail={contextTrail}
            ariaLabel="Documentation workspace"
            modeNavigationLabel="Documentation modes"
            contextPaneLabel="Documentation context"
            mobileDialogLabel="Documentation control plane"
            mobileTitle="Documentation"
            renderContextPane={docsContext ? renderContextPane : undefined}
            onContextAction={handleContextAction}
            onMobileModalPresenceChange={handleMobileModalPresenceChange}
          />
        </WorkspaceProvider>
      </div>
    </ThemeProvider>
  );
}

export function WebsiteWorkspaceLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const activeRef = useRef<WebsiteWorkspaceRegistration | null>(null);
  const [active, setActive] = useState<WebsiteWorkspaceRegistration | null>(
    null
  );

  const register = useCallback(
    (token: object, props: WebsiteWorkspaceProps) => {
      const registration = { token, props };
      activeRef.current = registration;
      setActive(registration);
    },
    []
  );
  const unregister = useCallback((token: object) => {
    if (activeRef.current?.token !== token) return;
    activeRef.current = null;
    setActive(null);
  }, []);

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

    const focusDestination = () => {
      const panel = Array.from(
        document.querySelectorAll<HTMLElement>('[data-workspace-panel-target]')
      ).find(
        (candidate) =>
          !candidate.closest('[aria-hidden="true"]') &&
          !candidate.closest('[inert]')
      );
      const target = panel ?? document.querySelector<HTMLElement>('main h1');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus();
      if (document.activeElement === target) {
        try {
          window.sessionStorage.removeItem(WORKSPACE_PANEL_FOCUS_INTENT);
        } catch {
          // Focus restoration succeeded even when storage becomes unavailable.
        }
      }
    };
    const timer = window.setTimeout(focusDestination, 250);
    return () => window.clearTimeout(timer);
  }, [active, pathname]);

  return (
    <WebsiteWorkspaceLayoutContext.Provider
      value={{ activeToken: active?.token ?? null, register, unregister }}
    >
      {active ? <WebsiteWorkspaceSurface {...active.props} /> : null}
      {children}
    </WebsiteWorkspaceLayoutContext.Provider>
  );
}

export function WebsiteWorkspaceRoot({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <RuntimeTargetProvider>
      <WebsiteWorkspaceLayout>{children}</WebsiteWorkspaceLayout>
    </RuntimeTargetProvider>
  );
}

export function WebsiteWorkspace(props: WebsiteWorkspaceProps) {
  const layout = useContext(WebsiteWorkspaceLayoutContext);
  const tokenRef = useRef<object | null>(null);
  if (!tokenRef.current) tokenRef.current = {};
  const token = tokenRef.current;

  useLayoutEffect(() => {
    if (!layout) return undefined;
    layout.register(token, props);
    return () => layout.unregister(token);
  }, [
    layout?.register,
    layout?.unregister,
    token,
    props.resolution,
    props.presentation,
    props.contentBundle,
    props.navigationTree,
    props.routePath,
    props.requestedMode,
    props.docsSlot,
    props.docsContext,
    props.contextTrail,
  ]);

  if (!layout) return <WebsiteWorkspaceSurface {...props} />;
  if (layout.activeToken === token) return null;

  // Preserve the server-rendered article until the persistent shell registers.
  return props.docsSlot ?? null;
}
