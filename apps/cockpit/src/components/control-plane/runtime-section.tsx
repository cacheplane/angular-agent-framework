// SPDX-License-Identifier: MIT
'use client';

import React, { useState, type ReactNode } from 'react';
import {
  CircleCheck,
  CircleSlash,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  ControlPlaneActionBar,
  ControlPlaneIconButton,
  ControlPlaneSection,
} from '@threadplane/ui-react';
import type {
  RuntimePhase,
  RuntimeSnapshot,
} from '../../lib/runtime/runtime-state';
import {
  ControlPlaneOverflowMenu,
  ControlPlaneOverflowMenuItem,
} from './control-plane-overflow-menu';

type RuntimeCommandOutcome = void | 'requested' | 'succeeded' | 'failed';
type RuntimeCommand = () =>
  | RuntimeCommandOutcome
  | PromiseLike<RuntimeCommandOutcome>;

export interface RuntimeSectionProps {
  snapshot: RuntimeSnapshot;
  product: string;
  language: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  onRecheck: RuntimeCommand;
  onReload: RuntimeCommand;
  onOpenRuntime: RuntimeCommand;
  onCopyDiagnostics: RuntimeCommand;
  formatCheckedAt?: (timestamp: number) => string;
}

interface StatusPresentation {
  label: string;
  icon: LucideIcon;
  iconName: string;
}

const STATUS_PRESENTATION: Record<RuntimePhase, StatusPresentation> = {
  not_configured: {
    label: 'Not configured',
    icon: CircleSlash,
    iconName: 'circle-slash',
  },
  invalid_configuration: {
    label: 'Invalid runtime URL',
    icon: TriangleAlert,
    iconName: 'triangle-alert',
  },
  connecting: {
    label: 'Connecting',
    icon: LoaderCircle,
    iconName: 'loader-circle',
  },
  checking: {
    label: 'Checking',
    icon: LoaderCircle,
    iconName: 'loader-circle',
  },
  ready: {
    label: 'Ready',
    icon: CircleCheck,
    iconName: 'circle-check',
  },
  unresponsive: {
    label: 'Unresponsive',
    icon: TriangleAlert,
    iconName: 'triangle-alert',
  },
  reloading: {
    label: 'Reloading',
    icon: LoaderCircle,
    iconName: 'loader-circle',
  },
  error: {
    label: 'Error',
    icon: TriangleAlert,
    iconName: 'triangle-alert',
  },
};

const visuallyHidden: React.CSSProperties = {
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

function RuntimeStatus({ phase }: { phase: RuntimePhase }) {
  const presentation = STATUS_PRESENTATION[phase];
  const StatusIcon = presentation.icon;
  return (
    <span data-runtime-status data-runtime-phase={phase}>
      <span data-runtime-status-icon={presentation.iconName}>
        <StatusIcon
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className={
            presentation.icon === LoaderCircle
              ? 'cockpit-runtime-status-loader'
              : undefined
          }
        />
      </span>
      <span>{presentation.label}</span>
    </span>
  );
}

function defaultCheckedAt(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function RuntimeSection({
  snapshot,
  product,
  language,
  open,
  onOpenChange,
  onRecheck,
  onReload,
  onOpenRuntime,
  onCopyDiagnostics,
  formatCheckedAt = defaultCheckedAt,
}: RuntimeSectionProps) {
  const [announcement, setAnnouncement] = useState('');
  const phase = snapshot.phase;
  const configured = snapshot.target.kind === 'configured';
  const invalid = snapshot.target.kind === 'invalid_configuration';
  const sanitizedTarget =
    snapshot.target.kind === 'configured' ? snapshot.target.sanitizedUrl : null;
  const checking =
    phase === 'connecting' || phase === 'checking' || phase === 'reloading';

  const runCommand = async (
    command: RuntimeCommand,
    succeeded: string,
    failed: string
  ) => {
    try {
      const outcome = await command();
      setAnnouncement(outcome === 'failed' ? failed : succeeded);
    } catch {
      setAnnouncement(failed);
    }
  };

  let actions: ReactNode = null;
  if (configured) {
    actions = (
      <ControlPlaneActionBar label="Runtime actions">
        <ControlPlaneIconButton
          label="Recheck"
          icon={<RefreshCw size={16} strokeWidth={2} aria-hidden="true" />}
          disabled={checking}
          onClick={() =>
            void runCommand(
              onRecheck,
              'Runtime check requested.',
              'Runtime check failed.'
            )
          }
        />
        <ControlPlaneIconButton
          label="Reload runtime"
          icon={<RotateCw size={16} strokeWidth={2} aria-hidden="true" />}
          disabled={phase === 'reloading'}
          onClick={() =>
            void runCommand(
              onReload,
              'Runtime reload requested.',
              'Runtime reload failed.'
            )
          }
        />
        <ControlPlaneIconButton
          label="Open runtime"
          icon={<ExternalLink size={16} strokeWidth={2} aria-hidden="true" />}
          onClick={() =>
            void runCommand(
              onOpenRuntime,
              'Runtime open requested.',
              'Runtime open failed.'
            )
          }
        />
        <ControlPlaneOverflowMenu label="More runtime actions">
          <ControlPlaneOverflowMenuItem
            onSelect={() =>
              runCommand(
                onCopyDiagnostics,
                'Diagnostics copied.',
                'Diagnostics copy failed.'
              )
            }
          >
            Copy diagnostics
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneActionBar>
    );
  } else if (invalid) {
    actions = (
      <ControlPlaneActionBar label="Runtime actions">
        <ControlPlaneOverflowMenu label="More runtime actions">
          <ControlPlaneOverflowMenuItem
            onSelect={() =>
              runCommand(
                onCopyDiagnostics,
                'Diagnostics copied.',
                'Diagnostics copy failed.'
              )
            }
          >
            Copy diagnostics
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneActionBar>
    );
  }

  return (
    <ControlPlaneSection
      title="Runtime"
      summary={<RuntimeStatus phase={phase} />}
      open={open}
      onOpenChange={onOpenChange}
    >
      <span style={visuallyHidden} data-runtime-status-description>
        Runtime status: {STATUS_PRESENTATION[phase].label}
      </span>
      <div data-runtime-metadata>
        <span>Shared development</span>
        <span>
          {language} · {product}
        </span>
        {sanitizedTarget !== null ? (
          <span
            title={sanitizedTarget}
            aria-label={`Runtime target ${sanitizedTarget}`}
            data-runtime-target
          >
            {sanitizedTarget}
          </span>
        ) : null}
        <span data-runtime-checked-at>
          {snapshot.checkedAt === null
            ? 'Not checked yet'
            : `Checked ${formatCheckedAt(snapshot.checkedAt)}`}
        </span>
      </div>
      {actions}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-runtime-announcement
      >
        {announcement}
      </span>
    </ControlPlaneSection>
  );
}
