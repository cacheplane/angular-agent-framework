// SPDX-License-Identifier: MIT
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
} from 'react';
import {
  parseRuntimeResponseMessage,
  RUNTIME_BRIDGE_VERSION,
} from '@threadplane/cockpit-runtime-bridge';
import type { RuntimeActivityInput } from './session-activity';
import {
  classifyRuntimeTerminalTransition,
  createRuntimeSnapshot,
  parseRuntimeTarget,
  runtimeReducer,
  type RuntimeAction,
  type RuntimeSnapshot,
  type RuntimeTarget,
  type RuntimeTerminalTransition,
} from './runtime-state';

const RUNTIME_CHECK_TIMEOUT_MS = 5_000;

export interface UseRuntimeControllerOptions {
  runtimeUrl: string | null;
  capability: string;
  onActivity(event: RuntimeActivityInput): void;
  onTerminalTransition(event: RuntimeTerminalTransition): void;
}

export interface RuntimeController {
  snapshot: RuntimeSnapshot;
  validatedRuntimeUrl: string | null;
  frameRef: RefObject<HTMLIFrameElement | null>;
  frameGeneration: number;
  onFrameLoad(): void;
  recheck(): void;
  reload(): void;
  open(): 'requested' | 'failed';
}

interface RouteContext {
  token: number;
  target: RuntimeTarget;
  capability: string;
  invalidInputRevision: symbol | null;
}

interface ActiveCheck {
  nonce: string;
  routeToken: number;
  capability: string;
  origin: string;
  frameWindow: Window | null;
}

type RuntimeControllerActivityKind = Exclude<
  RuntimeActivityInput['kind'],
  'mode_changed'
>;

function activityKindFor(
  transition: RuntimeTerminalTransition,
): RuntimeControllerActivityKind {
  switch (transition.toState) {
    case 'invalid_configuration':
      return 'configuration_invalid';
    case 'ready':
      return transition.transition === 'recovered'
        ? 'runtime_recovered'
        : 'runtime_ready';
    case 'unresponsive':
      return 'runtime_unresponsive';
    case 'error':
      return 'runtime_initialization_error';
  }
}

function isSameOperationalRoute(
  previous: RouteContext,
  next: Omit<RouteContext, 'token'>,
): boolean {
  if (
    previous.capability !== next.capability ||
    previous.target.kind !== next.target.kind
  ) {
    return false;
  }

  switch (previous.target.kind) {
    case 'configured':
      return (
        next.target.kind === 'configured' &&
        previous.target.sanitizedUrl === next.target.sanitizedUrl
      );
    case 'invalid_configuration':
      return previous.invalidInputRevision === next.invalidInputRevision;
    case 'not_configured':
      return true;
  }
}

export function useRuntimeController({
  runtimeUrl,
  capability,
  onActivity,
  onTerminalTransition,
}: UseRuntimeControllerOptions): RuntimeController {
  const target = useMemo(() => parseRuntimeTarget(runtimeUrl), [runtimeUrl]);
  const [snapshot, dispatch] = useReducer(
    runtimeReducer,
    undefined,
    () => createRuntimeSnapshot(target, capability),
  );
  const snapshotRef = useRef(snapshot);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCheckRef = useRef<ActiveCheck | null>(null);
  const onActivityRef = useRef(onActivity);
  const onTerminalTransitionRef = useRef(onTerminalTransition);

  useLayoutEffect(() => {
    onActivityRef.current = onActivity;
    onTerminalTransitionRef.current = onTerminalTransition;
  }, [onActivity, onTerminalTransition]);

  const invalidInputRevision = useMemo(
    () =>
      target.kind === 'invalid_configuration'
        ? Symbol('invalid runtime input')
        : null,
    [runtimeUrl, target.kind],
  );
  const renderedRoute = useMemo<Omit<RouteContext, 'token'>>(
    () => ({ target, capability, invalidInputRevision }),
    [target, capability, invalidInputRevision],
  );
  const routeContextRef = useRef<RouteContext>({
    token: 0,
    ...renderedRoute,
  });

  const applyAction = useCallback((action: RuntimeAction) => {
    snapshotRef.current = runtimeReducer(snapshotRef.current, action);
    dispatch(action);
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancelActiveCheck = useCallback(
    (updateState: boolean) => {
      const hadActiveCheck = activeCheckRef.current !== null;
      activeCheckRef.current = null;
      clearTimer();
      if (hadActiveCheck && updateState) {
        applyAction({ type: 'check_cancelled' });
      }
    },
    [applyAction, clearTimer],
  );

  const recordActivity = useCallback(
    (kind: RuntimeControllerActivityKind, eventCapability: string) => {
      onActivityRef.current({
        id: globalThis.crypto.randomUUID(),
        at: new Date().toISOString(),
        kind,
        capability: eventCapability,
      });
    },
    [],
  );

  const settleActiveCheck = useCallback(
    (activeCheck: ActiveCheck, action: RuntimeAction) => {
      if (activeCheckRef.current !== activeCheck) return;
      activeCheckRef.current = null;
      clearTimer();
      applyAction(action);
    },
    [applyAction, clearTimer],
  );

  const startCheck = useCallback(
    (intent: 'frame_load' | 'recheck') => {
      const route = routeContextRef.current;
      if (route.target.kind !== 'configured') return;

      cancelActiveCheck(true);

      const nonce = globalThis.crypto.randomUUID();
      const startedAt = Date.now();
      const frameWindow = frameRef.current?.contentWindow ?? null;
      const activeCheck: ActiveCheck = {
        nonce,
        routeToken: route.token,
        capability: route.capability,
        origin: route.target.origin,
        frameWindow,
      };
      activeCheckRef.current = activeCheck;
      applyAction({ type: 'check_started', intent, nonce, startedAt });
      recordActivity('runtime_check_requested', route.capability);

      timeoutRef.current = setTimeout(() => {
        const currentRoute = routeContextRef.current;
        if (
          activeCheckRef.current !== activeCheck ||
          currentRoute.token !== activeCheck.routeToken ||
          currentRoute.capability !== activeCheck.capability
        ) {
          return;
        }
        settleActiveCheck(activeCheck, {
          type: 'timeout',
          nonce,
          at: Date.now(),
        });
      }, RUNTIME_CHECK_TIMEOUT_MS);

      try {
        if (frameWindow === null) {
          throw new Error('Runtime frame is unavailable');
        }
        frameWindow.postMessage(
          {
            type: 'tplane:runtime-check',
            version: RUNTIME_BRIDGE_VERSION,
            nonce,
            capability: route.capability,
          },
          route.target.origin,
        );
      } catch {
        settleActiveCheck(activeCheck, {
          type: 'timeout',
          nonce,
          at: Date.now(),
        });
      }
    }, [applyAction, cancelActiveCheck, recordActivity, settleActiveCheck]);

  const onFrameLoad = useCallback(() => {
    startCheck('frame_load');
  }, [startCheck]);

  const recheck = useCallback(() => {
    startCheck('recheck');
  }, [startCheck]);

  const reload = useCallback(() => {
    const route = routeContextRef.current;
    if (route.target.kind !== 'configured') return;
    cancelActiveCheck(true);
    applyAction({ type: 'reload_requested' });
    recordActivity('runtime_reload_requested', route.capability);
  }, [applyAction, cancelActiveCheck, recordActivity]);

  const open = useCallback((): 'requested' | 'failed' => {
    const route = routeContextRef.current;
    if (route.target.kind !== 'configured') return 'failed';
    recordActivity('runtime_open_requested', route.capability);
    try {
      if (typeof window.open !== 'function') return 'failed';
      window.open(
        route.target.configuredUrl,
        '_blank',
        'noopener,noreferrer',
      );
      return 'requested';
    } catch {
      return 'failed';
    }
  }, [recordActivity]);

  useLayoutEffect(() => {
    const previousRoute = routeContextRef.current;
    const routeChanged = !isSameOperationalRoute(
      previousRoute,
      renderedRoute,
    );
    if (routeChanged) {
      cancelActiveCheck(false);
    }

    const committedRoute: RouteContext = {
      ...renderedRoute,
      token: routeChanged ? previousRoute.token + 1 : previousRoute.token,
    };
    routeContextRef.current = committedRoute;

    if (routeChanged) {
      applyAction({
        type: 'route_reset',
        target: committedRoute.target,
        capability: committedRoute.capability,
      });
    }
  }, [renderedRoute, applyAction, cancelActiveCheck]);

  useLayoutEffect(
    () => () => cancelActiveCheck(false),
    [cancelActiveCheck],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const activeCheck = activeCheckRef.current;
      const route = routeContextRef.current;
      const frameWindow = frameRef.current?.contentWindow ?? null;
      if (
        activeCheck === null ||
        frameWindow === null ||
        event.source !== frameWindow ||
        event.source !== activeCheck.frameWindow ||
        event.origin !== activeCheck.origin ||
        route.token !== activeCheck.routeToken ||
        route.capability !== activeCheck.capability ||
        route.target.kind !== 'configured' ||
        route.target.origin !== activeCheck.origin
      ) {
        return;
      }

      const message = parseRuntimeResponseMessage(event.data);
      if (message === null || message.nonce !== activeCheck.nonce) return;

      const at = Date.now();
      if (message.type === 'tplane:runtime-ready') {
        settleActiveCheck(activeCheck, {
          type: 'ready',
          nonce: message.nonce,
          at,
        });
      } else {
        settleActiveCheck(activeCheck, {
          type: 'bootstrap_failed',
          nonce: message.nonce,
          code: message.code,
          at,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [settleActiveCheck]);

  const initialReportedSnapshotRef = useRef<RuntimeSnapshot | null>(null);
  if (initialReportedSnapshotRef.current === null) {
    initialReportedSnapshotRef.current =
      target.kind === 'invalid_configuration'
        ? createRuntimeSnapshot({ kind: 'not_configured' }, capability)
        : snapshot;
  }
  useEffect(() => {
    const previous = initialReportedSnapshotRef.current;
    initialReportedSnapshotRef.current = snapshot;
    if (previous === null) return;
    const transition = classifyRuntimeTerminalTransition(previous, snapshot);
    if (transition === null) return;
    onTerminalTransitionRef.current(transition);
    recordActivity(activityKindFor(transition), transition.capability);
  }, [snapshot, recordActivity]);

  return {
    snapshot,
    validatedRuntimeUrl:
      target.kind === 'configured' ? target.sanitizedUrl : null,
    frameRef,
    frameGeneration: snapshot.frameGeneration,
    onFrameLoad,
    recheck,
    reload,
    open,
  };
}
