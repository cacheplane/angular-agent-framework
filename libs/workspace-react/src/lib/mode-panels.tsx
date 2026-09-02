'use client';

import type { ReactNode } from 'react';
import type {
  WorkspaceMode,
  WorkspaceResolution,
} from '@threadplane/cockpit-registry';

export interface WorkspaceModePanelProps {
  readonly resolution: WorkspaceResolution;
  readonly children: ReactNode;
}

function ModePanel({
  mode,
  resolution,
  children,
}: WorkspaceModePanelProps & { readonly mode: WorkspaceMode }) {
  return (
    <section data-workspace-mode={mode} data-workspace-kind={resolution.kind}>
      {children}
    </section>
  );
}

export function DocsModePanel(props: WorkspaceModePanelProps) {
  return <ModePanel {...props} mode="Docs" />;
}

export function RunModePanel(props: WorkspaceModePanelProps) {
  return <ModePanel {...props} mode="Run" />;
}

export function CodeModePanel(props: WorkspaceModePanelProps) {
  return <ModePanel {...props} mode="Code" />;
}

export function ApiModePanel(props: WorkspaceModePanelProps) {
  return <ModePanel {...props} mode="API" />;
}
