'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { cockpitManifest } from '@threadplane/cockpit-registry';
import { BookOpen, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  parseControlPlaneMode,
  useControlPlanePreferences,
  type ControlPlaneMode,
} from '@threadplane/ui-react';
import type { ContentBundle } from '../lib/content-bundle';
import type {
  CapabilityPresentation,
  NavigationProduct,
} from '../lib/route-resolution';
import { PRODUCT_LABELS } from '../lib/navigation-labels';
import { track } from '../lib/analytics/client';
import type {
  CockpitRuntimeActionProps,
  CockpitRuntimeStatusChangedProps,
} from '../lib/analytics/events';
import {
  activityReducer,
  countUnseenProblems,
  createSessionActivityEvent,
  type ActivityMode,
  type RuntimeActivityInput,
} from '../lib/runtime/session-activity';
import { copyRuntimeDiagnostics } from '../lib/runtime/runtime-diagnostics';
import type { RuntimeTerminalTransition } from '../lib/runtime/runtime-state';
import { useRuntimeController } from '../lib/runtime/use-runtime-controller';
import { resolveDocsUrl } from '../lib/docs-links';
import { CodeMode } from './code-mode/code-mode';
import { ApiMode } from './api-mode/api-mode';
import { NarrativeDocs } from './narrative-docs/narrative-docs';
import { RunMode } from './run-mode/run-mode';
import { MobileNavOverlay } from './mobile-nav-overlay';
import {
  CockpitControlPlane,
  type CockpitControlPlaneProps,
  type CockpitUtility,
} from './control-plane/cockpit-control-plane';

interface CockpitShellProps {
  navigationTree: NavigationProduct[];
  presentation: CapabilityPresentation;
  entryTitle: string;
  contentBundle: ContentBundle;
}

const MODE_ANALYTICS: Record<
  ControlPlaneMode,
  'run' | 'code' | 'docs' | 'api'
> = {
  Run: 'run',
  Code: 'code',
  Docs: 'docs',
  API: 'api',
};

const MOBILE_NAVIGATION_FOCUS_INTENT =
  'threadplane:cockpit:mobile-navigation-focus';
const MOBILE_NAVIGATION_FOCUS_MAX_AGE_MS = 10_000;

const toLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function createLocalActivityInput(
  capability: string,
  input:
    | { kind: 'mode_changed'; mode: ActivityMode }
    | { kind: 'diagnostics_copied' | 'diagnostics_copy_failed' }
): RuntimeActivityInput {
  return {
    id: globalThis.crypto.randomUUID(),
    at: new Date().toISOString(),
    capability,
    ...input,
  };
}

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
    case 'ready': {
      if (
        transition.fromState === 'unresponsive' ||
        transition.fromState === 'error'
      ) {
        return {
          ...common,
          from_state: transition.fromState,
          to_state: 'ready',
          transition: 'recovered',
        };
      }
      return {
        ...common,
        from_state: transition.fromState,
        to_state: 'ready',
      };
    }
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

export function CockpitShell({
  navigationTree,
  presentation,
  entryTitle,
  contentBundle,
}: CockpitShellProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const preferences = useControlPlanePreferences('cockpit');
  const queryHandled = useRef(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ControlPlaneMode>('Run');
  const [isMobileOverlayPresent, setIsMobileOverlayPresent] = useState(false);
  const [activeUtility, setActiveUtility] = useState<CockpitUtility>(null);
  const [activityOpenCycle, setActivityOpenCycle] = useState(0);
  const [seenActivityCount, setSeenActivityCount] = useState(0);
  const [events, dispatchActivity] = useReducer(activityReducer, []);
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = isCapability ? presentation.codeAssetPaths : [];
  const backendAssetPaths = isCapability
    ? presentation.backendAssetPaths ?? []
    : [];
  const entry = presentation.entry;
  const contextLabel = [
    PRODUCT_LABELS[entry.product] ?? toLabel(entry.product),
    toLabel(entry.section),
    toLabel(entry.topic),
  ].join(' / ');

  const appendActivity = useCallback((input: RuntimeActivityInput) => {
    dispatchActivity({
      type: 'add',
      event: createSessionActivityEvent(input),
    });
  }, []);

  const handleTerminalTransition = useCallback(
    (transition: RuntimeTerminalTransition) => {
      track(
        'cockpit:runtime_status_changed',
        toRuntimeStatusChangedProps(transition)
      );
    },
    []
  );

  const controller = useRuntimeController({
    runtimeUrl: contentBundle.runtimeUrl,
    capability: entry.topic,
    onActivity: appendActivity,
    onTerminalTransition: handleTerminalTransition,
  });
  // Null for the capabilities that have no published docs page yet — those
  // render no link at all rather than one that 404s.
  const docsUrl = resolveDocsUrl(presentation.docsPath);

  useEffect(() => {
    if (queryHandled.current) return;
    queryHandled.current = true;
    const url = new URL(window.location.href);
    const rawMode = url.searchParams.get('mode');
    const requestedMode = parseControlPlaneMode(rawMode);
    if (requestedMode) setActiveMode(requestedMode);
    if (rawMode !== null) {
      url.searchParams.delete('mode');
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search + url.hash
      );
    }
  }, []);

  const isMobileModalActive = isSidebarOpen || isMobileOverlayPresent;

  const handleModeChange = useCallback(
    (mode: ControlPlaneMode) => {
      if (mode === activeMode) return;
      setActiveMode(mode);
      appendActivity(
        createLocalActivityInput(entry.topic, {
          kind: 'mode_changed',
          mode,
        })
      );
      track('cockpit:mode_switched', {
        capability: entry.topic,
        from_mode: MODE_ANALYTICS[activeMode],
        to_mode: MODE_ANALYTICS[mode],
      });
    },
    [activeMode, appendActivity, entry.topic]
  );

  const handleActiveUtilityChange = useCallback(
    (utility: CockpitUtility) => {
      if (utility === 'activity' && activeUtility !== 'activity') {
        setActivityOpenCycle((cycle) => cycle + 1);
        setSeenActivityCount(events.length);
      }
      setActiveUtility(utility);
    },
    [activeUtility, events.length]
  );

  const closeMobileNavigation = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleCapabilityNavigate = useCallback((destination: string) => {
    const currentDestination =
      window.location.pathname + window.location.search + window.location.hash;
    if (destination !== currentDestination) {
      try {
        window.sessionStorage.setItem(
          MOBILE_NAVIGATION_FOCUS_INTENT,
          JSON.stringify({ destination, requestedAt: Date.now() })
        );
      } catch {
        // Client navigation still works if session storage is unavailable.
      }
    }
    routerRef.current.push(destination);
  }, []);

  useEffect(() => {
    let rawIntent: string | null = null;
    try {
      rawIntent = window.sessionStorage.getItem(MOBILE_NAVIGATION_FOCUS_INTENT);
    } catch {
      return undefined;
    }
    if (!rawIntent) return undefined;

    let intent: { destination?: unknown; requestedAt?: unknown };
    try {
      intent = JSON.parse(rawIntent) as typeof intent;
    } catch {
      window.sessionStorage.removeItem(MOBILE_NAVIGATION_FOCUS_INTENT);
      return undefined;
    }
    const currentDestination =
      window.location.pathname + window.location.search + window.location.hash;
    const isFresh =
      typeof intent.requestedAt === 'number' &&
      Date.now() - intent.requestedAt <= MOBILE_NAVIGATION_FOCUS_MAX_AGE_MS;
    if (!isFresh) {
      window.sessionStorage.removeItem(MOBILE_NAVIGATION_FOCUS_INTENT);
      return undefined;
    }
    if (intent.destination !== currentDestination) return undefined;

    window.sessionStorage.removeItem(MOBILE_NAVIGATION_FOCUS_INTENT);
    const focusTrigger = () => {
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(min-width: 48rem)').matches
      ) {
        return;
      }
      const trigger = mobileTriggerRef.current;
      if (!trigger?.closest('[inert]')) trigger?.focus();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(focusTrigger);
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(focusTrigger, 0);
    return () => window.clearTimeout(timer);
  }, [entry.page, entry.product, entry.section, entry.topic]);

  const handleClearActivity = useCallback(() => {
    dispatchActivity({ type: 'clear' });
    setSeenActivityCount(0);
  }, []);

  const handleRecheck = useCallback(() => {
    const stateBefore = controller.snapshot.phase;
    controller.recheck();
    track('cockpit:runtime_action', {
      capability: entry.topic,
      action: 'recheck',
      state_before: stateBefore,
      outcome: 'requested',
    } satisfies CockpitRuntimeActionProps);
    return 'requested' as const;
  }, [controller, entry.topic]);

  const handleReload = useCallback(() => {
    const stateBefore = controller.snapshot.phase;
    controller.reload();
    track('cockpit:runtime_action', {
      capability: entry.topic,
      action: 'reload',
      state_before: stateBefore,
      outcome: 'requested',
    } satisfies CockpitRuntimeActionProps);
    return 'requested' as const;
  }, [controller, entry.topic]);

  const handleOpenRuntime = useCallback(() => {
    const stateBefore = controller.snapshot.phase;
    const outcome = controller.open();
    track('cockpit:runtime_action', {
      capability: entry.topic,
      action: 'open',
      state_before: stateBefore,
      outcome,
    } satisfies CockpitRuntimeActionProps);
    return outcome;
  }, [controller, entry.topic]);

  const handleCopyDiagnostics = useCallback(async () => {
    const snapshot = controller.snapshot;
    const stateBefore = snapshot.phase;
    const outcome = await copyRuntimeDiagnostics(snapshot, events);
    appendActivity(
      createLocalActivityInput(entry.topic, {
        kind:
          outcome === 'succeeded'
            ? 'diagnostics_copied'
            : 'diagnostics_copy_failed',
      })
    );
    track('cockpit:runtime_action', {
      capability: entry.topic,
      action: 'copy_diagnostics',
      state_before: stateBefore,
      outcome,
    } satisfies CockpitRuntimeActionProps);
    return outcome;
  }, [appendActivity, controller.snapshot, entry.topic, events]);

  const controlPlaneProps = useMemo<
    Omit<CockpitControlPlaneProps, 'mobile' | 'onModeSelected' | 'onNavigate'>
  >(
    () => ({
      navigationTree,
      manifest: cockpitManifest,
      entry,
      activeMode,
      onModeChange: handleModeChange,
      activeUtility,
      onActiveUtilityChange: handleActiveUtilityChange,
      activityOpenCycle,
      runtimeSnapshot: controller.snapshot,
      events,
      unseenProblems: countUnseenProblems(events, seenActivityCount),
      expanded: preferences.expanded,
      onExpandedChange: preferences.setExpanded,
      onClearActivity: handleClearActivity,
      onRecheck: handleRecheck,
      onReload: handleReload,
      onOpenRuntime: handleOpenRuntime,
      onCopyDiagnostics: handleCopyDiagnostics,
    }),
    [
      activeMode,
      activeUtility,
      activityOpenCycle,
      controller.snapshot,
      entry,
      events,
      handleActiveUtilityChange,
      handleClearActivity,
      handleCopyDiagnostics,
      handleModeChange,
      handleOpenRuntime,
      handleRecheck,
      handleReload,
      navigationTree,
      preferences.expanded,
      preferences.setExpanded,
      seenActivityCount,
    ]
  );

  return (
    <main
      aria-label="Cockpit shell"
      className="cockpit-shell h-screen overflow-hidden"
      data-hydrated={preferences.hydrated ? 'true' : 'false'}
    >
      <div
        className="hidden md:block min-h-0 overflow-hidden"
        data-cockpit-desktop-navigation
        inert={isMobileModalActive ? true : undefined}
        aria-hidden={isMobileModalActive ? true : undefined}
      >
        <CockpitControlPlane {...controlPlaneProps} />
      </div>

      <MobileNavOverlay
        controlPlaneProps={controlPlaneProps}
        isOpen={isSidebarOpen}
        onClose={closeMobileNavigation}
        onPresenceChange={setIsMobileOverlayPresent}
        onCapabilityNavigate={handleCapabilityNavigate}
        triggerRef={mobileTriggerRef}
      />

      <section
        className="grid grid-rows-[auto_1fr] grid-cols-[minmax(0,1fr)] overflow-hidden bg-[var(--ds-surface)]"
        data-cockpit-workspace
        inert={isMobileModalActive ? true : undefined}
        aria-hidden={isMobileModalActive ? true : undefined}
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--ds-border)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={mobileTriggerRef}
              className="cockpit-mobile-navigation-trigger md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
              aria-expanded={isSidebarOpen}
              tabIndex={isMobileModalActive ? -1 : undefined}
            >
              <Menu size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <p className="hidden md:block text-[var(--ds-text-muted)] font-mono text-xs truncate">
              {contextLabel}
            </p>
          </div>
          {docsUrl ? (
            <a
              className="shrink-0 inline-flex items-center gap-1.5 text-xs text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] no-underline"
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen size={14} aria-hidden="true" />
              Read docs
            </a>
          ) : null}
        </header>

        <div className="min-h-0 relative">
          <div
            className={
              'h-full ' +
              (activeMode === 'Run' ? '' : 'invisible absolute inset-0')
            }
          >
            <RunMode
              entryTitle={entryTitle}
              runtimeUrl={controller.validatedRuntimeUrl}
              capabilitySlug={entry.topic}
              frameRef={controller.frameRef}
              frameGeneration={controller.frameGeneration}
              onFrameLoad={controller.onFrameLoad}
              runtimePhase={controller.snapshot.phase}
            />
          </div>
          {activeMode === 'Code' ? (
            <CodeMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              backendAssetPaths={backendAssetPaths}
              codeFiles={contentBundle.codeFiles}
              promptFiles={contentBundle.promptFiles}
              capability={entry.topic}
            />
          ) : null}
          {activeMode === 'Docs' ? (
            <NarrativeDocs
              narrativeDocs={contentBundle.narrativeDocs}
              capability={entry.topic}
            />
          ) : null}
          {activeMode === 'API' ? (
            <ApiMode docSections={contentBundle.docSections} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
