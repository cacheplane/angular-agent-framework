import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  ApiModePanel,
  CodeModePanel,
  DocsModePanel,
  RunModePanel,
  RuntimeTargetProvider,
  WorkspaceProvider,
  WorkspaceShell,
  useRuntimeController,
  useWorkspace,
  type ActivityKind,
  type ActivityMode,
  type ActivitySeverity,
  type RuntimeActivityInput,
  type SessionActivityEvent,
  type WorkspaceHostServices,
  type WorkspaceNavigationRequest,
} from '../index';
import type {
  WorkspaceMode,
  WorkspaceResolution,
} from '@threadplane/cockpit-registry';

const resolution: WorkspaceResolution = {
  kind: 'docs-only',
  docsPath: '/docs/example',
  title: 'Example',
  unavailableReason: 'no-workspace-capability',
};

const hostServices: WorkspaceHostServices = {
  resolveEntryHref: (entry) =>
    `/workspace/${entry.product}/${entry.topic}/${entry.language}`,
  navigate: vi.fn(),
};

const navigationRequest: WorkspaceNavigationRequest = {
  path: '/docs/example',
  mode: 'Docs',
};

function WorkspaceReadout() {
  const workspace = useWorkspace();

  return (
    <span data-testid="workspace-readout">
      {workspace.activeMode}:{workspace.runtimeController.snapshot.phase}
    </span>
  );
}

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.spec\.tsx?$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

function workspaceReactSourceRoot(): string {
  const workspacePath = resolve(process.cwd(), 'libs/workspace-react/src');
  return existsSync(workspacePath)
    ? workspacePath
    : resolve(process.cwd(), 'src');
}

describe('@threadplane/workspace-react public boundary', () => {
  it('renders provider, shell, and stable mode-panel placeholders', () => {
    const modes: readonly WorkspaceMode[] = ['Docs', 'Run', 'Code', 'API'];

    render(
      <RuntimeTargetProvider>
        <WorkspaceProvider
          resolution={resolution}
          presentation={{
            kind: 'docs-only',
            docsPath: resolution.docsPath,
            title: resolution.title,
            runnable: false,
          }}
          contentBundle={{
            codeFiles: {},
            promptFiles: {},
            runtimeUrl: null,
            docSections: [],
            narrativeDocs: [],
          }}
          routePath={resolution.docsPath}
          requestedMode="docs"
          docsSlot={<article>workspace docs</article>}
          pushIdentity={vi.fn()}
          pushMode={vi.fn()}
          replaceMode={vi.fn()}
          getSessionId={() => 'public-boundary-session'}
        >
          <WorkspaceShell navigationTree={[]} manifest={[]} />
          <DocsModePanel resolution={resolution}>docs</DocsModePanel>
          <RunModePanel resolution={resolution}>run</RunModePanel>
          <CodeModePanel resolution={resolution}>code</CodeModePanel>
          <ApiModePanel resolution={resolution}>api</ApiModePanel>
          <WorkspaceReadout />
        </WorkspaceProvider>
      </RuntimeTargetProvider>
    );

    expect(screen.getByText('docs').dataset.workspaceMode).toBe('Docs');
    expect(screen.getByText('run').dataset.workspaceMode).toBe('Run');
    expect(screen.getByText('code').dataset.workspaceMode).toBe('Code');
    expect(screen.getByText('api').dataset.workspaceMode).toBe('API');
    expect(screen.getByTestId('workspace-readout').textContent).toBe(
      'Docs:not_configured'
    );
    expect(modes).toHaveLength(4);
    expect(useRuntimeController).toBeTypeOf('function');
  });

  it('exports activity contracts compatible with Cockpit concepts', () => {
    const mode: ActivityMode = 'Run';
    const severity: ActivitySeverity = 'neutral';
    const kind: ActivityKind = 'mode_changed';
    const input: RuntimeActivityInput = {
      id: 'activity-1',
      at: '2026-09-01T00:00:00.000Z',
      kind,
      capability: 'example',
      mode,
    };
    const event: SessionActivityEvent = {
      id: input.id,
      at: input.at,
      kind: input.kind,
      severity,
      capability: input.capability,
      summary: 'Mode changed to Run',
    };

    hostServices.navigate(navigationRequest);

    expect(input).toMatchObject({ kind, mode });
    expect(event).toMatchObject({ kind, severity });
    expect(event).not.toHaveProperty('mode');
    expect(hostServices.navigate).toHaveBeenCalledWith(navigationRequest);
  });

  it('does not import application-owned modules from production source', () => {
    const sourceRoot = workspaceReactSourceRoot();
    const source = productionSourceFiles(sourceRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /(?:from\s+|import\s*\()["'](?:@\/|[^"']*apps\/(?:website|cockpit))/
    );
  });

  it('keeps production source browser-safe and free of server content loaders', () => {
    const sourceRoot = workspaceReactSourceRoot();
    const source = productionSourceFiles(sourceRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /(?:from\s+|import\s*\()["'](?:node:|shiki(?:\/|["'])|marked(?:\/|["']))/
    );
    expect(source).not.toMatch(
      /\b(?:getContentBundle|resolveWorkspaceAssetPath|findWorkspaceRoot|renderMarkdown|extractTsDocSections|extractPyDocSections)\b/
    );
  });
});
