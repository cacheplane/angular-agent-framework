'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { RuntimeAdapter } from '@threadplane/cockpit-registry';
import { Cloud, KeyRound, Server } from 'lucide-react';
import {
  useAgUiRuntimeTarget,
  useLangGraphRuntimeTarget,
} from '../../runtime/runtime-target-provider';
import type {
  RuntimeTargetValidationError,
  SanitizedRuntimeTargetDisplay,
} from '../../runtime/runtime-target-session';

export interface RuntimeTargetSettingsProps {
  readonly adapter: RuntimeAdapter;
  readonly runtimeOrigin: string | null;
}

type TargetChoice = 'shared' | 'custom';

const customLabel = (adapter: Exclude<RuntimeAdapter, 'none'>): string =>
  adapter === 'ag-ui' ? 'Custom AG-UI' : 'Custom LangSmith';

const choiceForView = (view: SanitizedRuntimeTargetDisplay): TargetChoice =>
  view.kind === 'shared' ? 'shared' : 'custom';

export function RuntimeTargetSettings({
  adapter,
  runtimeOrigin,
}: RuntimeTargetSettingsProps) {
  return (
    <RuntimeTargetSettingsForm
      key={adapter}
      adapter={adapter}
      runtimeOrigin={runtimeOrigin}
    />
  );
}

function RuntimeTargetSettingsForm({
  adapter,
  runtimeOrigin,
}: RuntimeTargetSettingsProps) {
  const agUi = useAgUiRuntimeTarget();
  const langgraph = useLangGraphRuntimeTarget();
  const view = adapter === 'ag-ui' ? agUi.view : langgraph.view;
  const [choice, setChoice] = useState<TargetChoice>(() => choiceForView(view));
  const [endpointDraft, setEndpointDraft] = useState(view.location ?? '');
  const [error, setError] = useState<RuntimeTargetValidationError | null>(null);
  const endpointRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const radioName = useId();

  useEffect(() => {
    setChoice(choiceForView(view));
    setEndpointDraft(view.location ?? '');
    setError(null);
  }, [view.kind, view.location]);

  useEffect(() => {
    if (adapter === 'none') return undefined;
    const clearDraft = () => {
      setChoice('shared');
      setEndpointDraft('');
      setError(null);
      if (endpointRef.current) endpointRef.current.value = '';
      if (keyRef.current) keyRef.current.value = '';
    };
    return adapter === 'ag-ui'
      ? agUi.registerDraftClear(clearDraft)
      : langgraph.registerDraftClear(clearDraft);
  }, [adapter, agUi, langgraph]);

  useLayoutEffect(() => {
    if (choice !== 'custom') return undefined;
    const endpointInput = endpointRef.current;
    const keyInput = keyRef.current;
    return () => {
      if (endpointInput) endpointInput.value = '';
      if (keyInput) keyInput.value = '';
    };
  }, [choice]);

  if (adapter === 'none') {
    return (
      <section data-runtime-target-settings data-runtime-adapter="none">
        <h3>Runtime target</h3>
        <p>Custom runtime targets are unavailable for this capability.</p>
      </section>
    );
  }

  const focusInvalidField = (nextError: RuntimeTargetValidationError) => {
    if (nextError.code === 'api_key_required') keyRef.current?.focus();
    else endpointRef.current?.focus();
  };

  const applyCustomTarget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const endpoint = formData.get('rtu');
    const result =
      adapter === 'ag-ui'
        ? agUi.applyCustomTarget(endpoint)
        : langgraph.applyCustomTarget(endpoint, formData.get('rts'));

    if (!result.ok) {
      setError(result.error);
      focusInvalidField(result.error);
      return;
    }

    setError(null);
    if (keyRef.current) keyRef.current.value = '';
  };

  const useSharedDevelopment = () => {
    if (adapter === 'ag-ui') agUi.useSharedDevelopment();
    else langgraph.useSharedDevelopment();
    setChoice('shared');
    setEndpointDraft('');
    setError(null);
    if (keyRef.current) keyRef.current.value = '';
  };

  const endpointLabel = adapter === 'ag-ui' ? 'Endpoint' : 'API URL';
  const isCustom = choice === 'custom';
  const hasCustomTarget = view.kind !== 'shared';

  return (
    <section
      data-runtime-target-settings
      data-runtime-adapter={adapter}
      data-runtime-target-kind={view.kind}
    >
      <h3>Runtime target</h3>
      <form aria-label="Runtime target" onSubmit={applyCustomTarget}>
        <fieldset data-runtime-target-selector>
          <legend>Connection</legend>
          <label>
            <input
              type="radio"
              name={radioName}
              value="shared"
              checked={choice === 'shared'}
              onChange={() => {
                setChoice('shared');
                setError(null);
              }}
            />
            <Cloud size={17} strokeWidth={2} aria-hidden="true" />
            <span>Shared development</span>
          </label>
          <label>
            <input
              type="radio"
              name={radioName}
              value="custom"
              checked={isCustom}
              onChange={() => {
                setChoice('custom');
                setError(null);
              }}
            />
            <Server size={17} strokeWidth={2} aria-hidden="true" />
            <span>{customLabel(adapter)}</span>
          </label>
        </fieldset>

        {isCustom ? (
          <div data-runtime-target-fields>
            <label>
              <span>{endpointLabel}</span>
              <input
                ref={endpointRef}
                type="url"
                name="rtu"
                value={endpointDraft}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={
                  error !== null && error.code !== 'api_key_required'
                    ? true
                    : undefined
                }
                aria-describedby={
                  error !== null && error.code !== 'api_key_required'
                    ? errorId
                    : undefined
                }
                onChange={(event) => {
                  setEndpointDraft(event.currentTarget.value);
                  setError(null);
                }}
              />
            </label>
            {adapter === 'langgraph' ? (
              <label>
                <span>
                  <KeyRound size={14} strokeWidth={2} aria-hidden="true" />
                  API key
                </span>
                <input
                  ref={keyRef}
                  type="password"
                  name="rts"
                  autoComplete="new-password"
                  aria-invalid={error?.code === 'api_key_required' || undefined}
                  aria-describedby={
                    error?.code === 'api_key_required' ? errorId : undefined
                  }
                  onInput={() => setError(null)}
                />
              </label>
            ) : null}
            {error ? (
              <p id={errorId} role="alert" data-runtime-target-error>
                {error.message}
              </p>
            ) : null}
            <button type="submit" data-runtime-target-primary-action>
              Use custom target
            </button>
          </div>
        ) : null}

        {hasCustomTarget ? (
          <button
            type="button"
            data-runtime-target-shared-action
            onClick={useSharedDevelopment}
          >
            Use shared development
          </button>
        ) : null}
      </form>

      {view.location ? (
        <p data-runtime-target-current>
          <span>Active</span>
          <code>{view.location}</code>
        </p>
      ) : null}
      <p data-runtime-target-cors>
        {runtimeOrigin
          ? `Allow Origin: ${runtimeOrigin}. This is the embedded Angular runtime origin, not necessarily the top-level workspace origin.`
          : 'The embedded Angular runtime origin is unavailable for this capability.'}
      </p>
      <p data-runtime-target-memory>
        Kept in this tab until refresh. Nothing is saved.
      </p>
    </section>
  );
}
