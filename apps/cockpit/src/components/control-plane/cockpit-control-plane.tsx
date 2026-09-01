'use client';

import React, { useRef } from 'react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import {
  Activity as ActivityIcon,
  BookOpen,
  Braces,
  Code2,
  Play,
  Settings,
} from 'lucide-react';
import {
  ControlPlanePane,
  ControlPlaneRail,
  ControlPlaneRailItem,
  ControlPlaneUtilityPanel,
  ThemeToggle,
  type ControlPlaneMode,
} from '@threadplane/ui-react';
import type { NavigationProduct } from '../../lib/route-resolution';
import { PRODUCT_LABELS } from '../../lib/navigation-labels';
import type { SessionActivityEvent } from '../../lib/runtime/session-activity';
import {
  runtimeNeedsAttention,
  type RuntimeSnapshot,
} from '../../lib/runtime/runtime-state';
import { CockpitSidebar } from '../sidebar/cockpit-sidebar';
import { LanguagePicker } from '../sidebar/language-picker';
import { ActivityPanel } from './activity-panel';
import { ActivityPanelBoundary } from './activity-panel-boundary';
import { RuntimeSection } from './runtime-section';

const MODES: Array<{
  label: ControlPlaneMode;
  icon: typeof Play;
}> = [
  { label: 'Docs', icon: BookOpen },
  { label: 'Run', icon: Play },
  { label: 'Code', icon: Code2 },
  { label: 'API', icon: Braces },
];

type RuntimeCommandOutcome = void | 'requested' | 'succeeded' | 'failed';
type RuntimeCommand = () =>
  | RuntimeCommandOutcome
  | PromiseLike<RuntimeCommandOutcome>;

export type CockpitUtility = 'activity' | 'settings' | null;

export interface CockpitControlPlaneProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
  activeMode: ControlPlaneMode;
  onModeChange(mode: ControlPlaneMode): void;
  activeUtility: CockpitUtility;
  onActiveUtilityChange(utility: CockpitUtility): void;
  activityOpenCycle: number;
  runtimeSnapshot: RuntimeSnapshot;
  events: readonly SessionActivityEvent[];
  expanded: Record<string, boolean>;
  onExpandedChange(key: string, open: boolean): void;
  onClearActivity(): void;
  onRecheck: RuntimeCommand;
  onReload: RuntimeCommand;
  onOpenRuntime: RuntimeCommand;
  onCopyDiagnostics: RuntimeCommand;
  mobile?: boolean;
  onModeSelected?: () => void;
  onNavigate?: () => void;
}

function focusUtilityInvoker(ref: React.RefObject<HTMLSpanElement | null>) {
  ref.current?.querySelector('button')?.focus();
}

export function CockpitControlPlane({
  navigationTree,
  manifest,
  entry,
  activeMode,
  onModeChange,
  activeUtility,
  onActiveUtilityChange,
  activityOpenCycle,
  runtimeSnapshot,
  events,
  expanded,
  onExpandedChange,
  onClearActivity,
  onRecheck,
  onReload,
  onOpenRuntime,
  onCopyDiagnostics,
  mobile = false,
  onModeSelected,
  onNavigate,
}: CockpitControlPlaneProps) {
  const activityRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef<HTMLSpanElement>(null);
  const attention = runtimeNeedsAttention(runtimeSnapshot.phase);
  const activityLabel = attention ? 'Activity, attention required' : 'Activity';
  const product = PRODUCT_LABELS[entry.product] ?? entry.product;
  const language = entry.language === 'typescript' ? 'TypeScript' : 'Python';

  const closeUtility = (
    utility: Exclude<CockpitUtility, null>,
    invokerRef: React.RefObject<HTMLSpanElement | null>
  ) => {
    if (activeUtility !== utility) return;
    onActiveUtilityChange(null);
    focusUtilityInvoker(invokerRef);
  };

  const selectUtility = (
    utility: Exclude<CockpitUtility, null>,
    invokerRef: React.RefObject<HTMLSpanElement | null>
  ) => {
    if (activeUtility === utility) {
      closeUtility(utility, invokerRef);
      return;
    }
    onActiveUtilityChange(utility);
  };

  const selectMode = (mode: ControlPlaneMode) => {
    if (activeUtility !== null) {
      onActiveUtilityChange(null);
    }
    onModeChange(mode);
    onModeSelected?.();
  };

  let paneContent: React.ReactNode;
  if (activeUtility === 'activity') {
    paneContent = (
      <ActivityPanelBoundary
        resetKey={activityOpenCycle}
        onClose={() => closeUtility('activity', activityRef)}
      >
        <ActivityPanel
          events={events}
          currentCapability={entry.topic}
          attention={attention}
          onClose={() => closeUtility('activity', activityRef)}
          onClear={onClearActivity}
        />
      </ActivityPanelBoundary>
    );
  } else if (activeUtility === 'settings') {
    paneContent = (
      <ControlPlaneUtilityPanel
        title="Settings"
        onClose={() => closeUtility('settings', settingsRef)}
      >
        <div className="cockpit-control-plane-setting">
          <span>Language</span>
          <LanguagePicker manifest={manifest} entry={entry} />
        </div>
        <div className="cockpit-control-plane-setting">
          <span>Theme</span>
          <ThemeToggle className="cockpit-control-plane-theme" />
        </div>
      </ControlPlaneUtilityPanel>
    );
  } else {
    paneContent = (
      <>
        <CockpitSidebar
          navigationTree={navigationTree}
          entry={entry}
          expanded={expanded}
          onExpandedChange={onExpandedChange}
          onNavigate={onNavigate}
        />
        <RuntimeSection
          snapshot={runtimeSnapshot}
          product={product}
          language={language}
          open={expanded.Runtime ?? true}
          onOpenChange={(open) => onExpandedChange('Runtime', open)}
          onRecheck={onRecheck}
          onReload={onReload}
          onOpenRuntime={onOpenRuntime}
          onCopyDiagnostics={onCopyDiagnostics}
        />
      </>
    );
  }

  return (
    <div
      className="cockpit-control-plane"
      data-cockpit-control-plane
      data-mobile={mobile || undefined}
    >
      <ControlPlaneRail
        label="Cockpit modes"
        primary={MODES.map(({ label, icon: Icon }) => (
          <ControlPlaneRailItem
            key={label}
            label={label}
            icon={<Icon size={18} aria-hidden="true" />}
            active={label === activeMode}
            onSelect={() => selectMode(label)}
          />
        ))}
        utilities={
          <>
            <span
              ref={activityRef}
              className="cockpit-control-plane-utility-anchor"
            >
              <ControlPlaneRailItem
                label={activityLabel}
                icon={
                  <span data-cockpit-activity-icon>
                    <ActivityIcon size={18} aria-hidden="true" />
                    {attention ? (
                      <span
                        aria-hidden="true"
                        data-cockpit-activity-attention
                      />
                    ) : null}
                  </span>
                }
                iconOnly
                active={activeUtility === 'activity'}
                onSelect={() => selectUtility('activity', activityRef)}
              />
            </span>
            <span
              ref={settingsRef}
              className="cockpit-control-plane-utility-anchor"
            >
              <ControlPlaneRailItem
                label="Settings"
                icon={<Settings size={18} aria-hidden="true" />}
                iconOnly
                active={activeUtility === 'settings'}
                onSelect={() => selectUtility('settings', settingsRef)}
              />
            </span>
          </>
        }
      />

      <ControlPlanePane label="Cockpit context">{paneContent}</ControlPlanePane>
    </div>
  );
}
