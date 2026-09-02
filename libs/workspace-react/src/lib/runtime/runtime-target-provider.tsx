'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import type { RuntimeAdapter } from '@threadplane/cockpit-registry';
import {
  areEffectiveRuntimeTargetsEqual,
  createDefaultRuntimeTargetSession,
  getSanitizedRuntimeTargetDisplay,
  validateAgUiTarget,
  validateLangGraphTarget,
  type AgUiTarget,
  type EffectiveRuntimeTarget,
  type LangGraphTarget,
  type RuntimeTargetValidationError,
  type SanitizedRuntimeTargetDisplay,
} from './runtime-target-session';

type DraftClearCallback = () => void;

export type RuntimeTargetApplyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: RuntimeTargetValidationError };

interface RuntimeTargetContextValue {
  readonly agUiView: SanitizedRuntimeTargetDisplay;
  readonly langgraphView: SanitizedRuntimeTargetDisplay;
  readonly noneView: SanitizedRuntimeTargetDisplay;
  readonly applyAgUiTarget: (endpoint: unknown) => RuntimeTargetApplyResult;
  readonly applyLangGraphTarget: (
    apiUrl: unknown,
    apiKey: unknown
  ) => RuntimeTargetApplyResult;
  readonly clearAgUiTarget: () => void;
  readonly clearLangGraphTarget: () => void;
  readonly registerDraftClear: (
    adapter: Exclude<RuntimeAdapter, 'none'>,
    callback: DraftClearCallback
  ) => () => void;
}

export interface AgUiRuntimeTargetControls {
  readonly view: SanitizedRuntimeTargetDisplay;
  readonly applyCustomTarget: (endpoint: unknown) => RuntimeTargetApplyResult;
  readonly useSharedDevelopment: () => void;
  readonly registerDraftClear: (callback: DraftClearCallback) => () => void;
}

export interface LangGraphRuntimeTargetControls {
  readonly view: SanitizedRuntimeTargetDisplay;
  readonly applyCustomTarget: (
    apiUrl: unknown,
    apiKey: unknown
  ) => RuntimeTargetApplyResult;
  readonly useSharedDevelopment: () => void;
  readonly registerDraftClear: (callback: DraftClearCallback) => () => void;
}

const RuntimeTargetContext = createContext<RuntimeTargetContextValue | null>(
  null
);
const AgUiEffectiveTargetContext = createContext<AgUiTarget | null>(null);
const LangGraphEffectiveTargetContext = createContext<LangGraphTarget | null>(
  null
);

const useRuntimeTargetContext = (): RuntimeTargetContextValue => {
  const context = useContext(RuntimeTargetContext);
  if (!context) {
    throw new Error('Runtime target hooks require RuntimeTargetProvider.');
  }
  return context;
};

const runDraftClearCallbacks = (
  callbacks: ReadonlySet<DraftClearCallback>
): void => {
  for (const callback of callbacks) {
    try {
      callback();
    } catch {
      // Lifecycle clearing must continue even if one mounted draft was removed.
    }
  }
};

export function RuntimeTargetProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const defaults = useMemo(createDefaultRuntimeTargetSession, []);
  const [agUiTarget, setAgUiTarget] = useState<AgUiTarget>(defaults.agUi);
  const [langgraphTarget, setLangGraphTarget] = useState<LangGraphTarget>(
    defaults.langgraph
  );
  const agUiTargetRef = useRef(agUiTarget);
  const langgraphTargetRef = useRef(langgraphTarget);
  const draftClearCallbacks = useRef({
    agUi: new Set<DraftClearCallback>(),
    langgraph: new Set<DraftClearCallback>(),
  });

  const clearDrafts = useCallback(
    (adapter: Exclude<RuntimeAdapter, 'none'>) => {
      runDraftClearCallbacks(
        adapter === 'ag-ui'
          ? draftClearCallbacks.current.agUi
          : draftClearCallbacks.current.langgraph
      );
    },
    []
  );

  const applyAgUiTarget = useCallback((endpoint: unknown) => {
    const result = validateAgUiTarget(endpoint);
    if (!result.ok) return { ok: false, error: result.error } as const;
    if (
      areEffectiveRuntimeTargetsEqual(
        { adapter: 'ag-ui', target: agUiTargetRef.current },
        { adapter: 'ag-ui', target: result.value }
      )
    ) {
      return { ok: true } as const;
    }
    agUiTargetRef.current = result.value;
    setAgUiTarget(result.value);
    return { ok: true } as const;
  }, []);

  const applyLangGraphTarget = useCallback(
    (apiUrl: unknown, apiKey: unknown) => {
      const result = validateLangGraphTarget(apiUrl, apiKey);
      if (!result.ok) return { ok: false, error: result.error } as const;
      if (
        areEffectiveRuntimeTargetsEqual(
          { adapter: 'langgraph', target: langgraphTargetRef.current },
          { adapter: 'langgraph', target: result.value }
        )
      ) {
        return { ok: true } as const;
      }
      langgraphTargetRef.current = result.value;
      setLangGraphTarget(result.value);
      return { ok: true } as const;
    },
    []
  );

  const clearAgUiTarget = useCallback(() => {
    if (agUiTargetRef.current.kind !== 'shared') {
      const shared: AgUiTarget = { kind: 'shared' };
      agUiTargetRef.current = shared;
      setAgUiTarget(shared);
    }
    clearDrafts('ag-ui');
  }, [clearDrafts]);

  const clearLangGraphTarget = useCallback(() => {
    if (langgraphTargetRef.current.kind !== 'shared') {
      const shared: LangGraphTarget = { kind: 'shared' };
      langgraphTargetRef.current = shared;
      setLangGraphTarget(shared);
    }
    clearDrafts('langgraph');
  }, [clearDrafts]);

  const registerDraftClear = useCallback(
    (
      adapter: Exclude<RuntimeAdapter, 'none'>,
      callback: DraftClearCallback
    ) => {
      const callbacks =
        adapter === 'ag-ui'
          ? draftClearCallbacks.current.agUi
          : draftClearCallbacks.current.langgraph;
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    []
  );

  const resetForDocumentLifecycle = useCallback(() => {
    const next = createDefaultRuntimeTargetSession();
    agUiTargetRef.current = next.agUi;
    langgraphTargetRef.current = next.langgraph;
    flushSync(() => {
      setAgUiTarget(next.agUi);
      setLangGraphTarget(next.langgraph);
      clearDrafts('ag-ui');
      clearDrafts('langgraph');
    });
  }, [clearDrafts]);

  useEffect(() => {
    const handlePageHide = () => resetForDocumentLifecycle();
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resetForDocumentLifecycle();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [resetForDocumentLifecycle]);

  const agUiView = useMemo(
    () =>
      getSanitizedRuntimeTargetDisplay({
        adapter: 'ag-ui',
        target: agUiTarget,
      }),
    [agUiTarget]
  );
  const langgraphView = useMemo(
    () =>
      getSanitizedRuntimeTargetDisplay({
        adapter: 'langgraph',
        target: langgraphTarget,
      }),
    [langgraphTarget]
  );
  const noneView = useMemo(
    () =>
      getSanitizedRuntimeTargetDisplay({
        adapter: 'none',
        target: null,
      }),
    []
  );

  const value = useMemo<RuntimeTargetContextValue>(
    () => ({
      agUiView,
      langgraphView,
      noneView,
      applyAgUiTarget,
      applyLangGraphTarget,
      clearAgUiTarget,
      clearLangGraphTarget,
      registerDraftClear,
    }),
    [
      agUiView,
      applyAgUiTarget,
      applyLangGraphTarget,
      clearAgUiTarget,
      clearLangGraphTarget,
      langgraphView,
      noneView,
      registerDraftClear,
    ]
  );

  return (
    <AgUiEffectiveTargetContext.Provider value={agUiTarget}>
      <LangGraphEffectiveTargetContext.Provider value={langgraphTarget}>
        <RuntimeTargetContext.Provider value={value}>
          {children}
        </RuntimeTargetContext.Provider>
      </LangGraphEffectiveTargetContext.Provider>
    </AgUiEffectiveTargetContext.Provider>
  );
}

export const useAgUiRuntimeTarget = (): AgUiRuntimeTargetControls => {
  const context = useRuntimeTargetContext();
  return useMemo(
    () => ({
      view: context.agUiView,
      applyCustomTarget: context.applyAgUiTarget,
      useSharedDevelopment: context.clearAgUiTarget,
      registerDraftClear: (callback: DraftClearCallback) =>
        context.registerDraftClear('ag-ui', callback),
    }),
    [context]
  );
};

export const useLangGraphRuntimeTarget = (): LangGraphRuntimeTargetControls => {
  const context = useRuntimeTargetContext();
  return useMemo(
    () => ({
      view: context.langgraphView,
      applyCustomTarget: context.applyLangGraphTarget,
      useSharedDevelopment: context.clearLangGraphTarget,
      registerDraftClear: (callback: DraftClearCallback) =>
        context.registerDraftClear('langgraph', callback),
    }),
    [context]
  );
};

/** Internal trusted selector for WorkspaceProvider and runtime-controller wiring. */
export const useEffectiveRuntimeTarget = (
  adapter: RuntimeAdapter
): EffectiveRuntimeTarget => {
  const agUiTarget = useContext(AgUiEffectiveTargetContext);
  const langgraphTarget = useContext(LangGraphEffectiveTargetContext);
  if (agUiTarget === null || langgraphTarget === null) {
    throw new Error('Runtime target hooks require RuntimeTargetProvider.');
  }
  const agUiEffectiveTarget = useMemo<EffectiveRuntimeTarget>(
    () => ({ adapter: 'ag-ui', target: agUiTarget }),
    [agUiTarget]
  );
  const langgraphEffectiveTarget = useMemo<EffectiveRuntimeTarget>(
    () => ({ adapter: 'langgraph', target: langgraphTarget }),
    [langgraphTarget]
  );
  const noneEffectiveTarget = useMemo<EffectiveRuntimeTarget>(
    () => ({ adapter: 'none', target: null }),
    []
  );
  switch (adapter) {
    case 'ag-ui':
      return agUiEffectiveTarget;
    case 'langgraph':
      return langgraphEffectiveTarget;
    case 'none':
      return noneEffectiveTarget;
  }
};

export const useRuntimeTargetView = (
  adapter: RuntimeAdapter
): SanitizedRuntimeTargetDisplay => {
  const context = useRuntimeTargetContext();
  switch (adapter) {
    case 'ag-ui':
      return context.agUiView;
    case 'langgraph':
      return context.langgraphView;
    case 'none':
      return context.noneView;
  }
};
