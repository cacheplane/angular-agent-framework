'use client';

import React, { useRef, useState } from 'react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import {
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
  useControlPlanePreferences,
  type ControlPlaneMode,
} from '@threadplane/ui-react';
import type { NavigationProduct } from '../../lib/route-resolution';
import { track } from '../../lib/analytics/client';
import { CockpitSidebar } from '../sidebar/cockpit-sidebar';
import { LanguagePicker } from '../sidebar/language-picker';

const MODES: Array<{
  label: ControlPlaneMode;
  icon: typeof Play;
  analytics: 'run' | 'code' | 'docs' | 'api';
}> = [
  { label: 'Docs', icon: BookOpen, analytics: 'docs' },
  { label: 'Run', icon: Play, analytics: 'run' },
  { label: 'Code', icon: Code2, analytics: 'code' },
  { label: 'API', icon: Braces, analytics: 'api' },
];

export interface CockpitControlPlaneProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
  activeMode: ControlPlaneMode;
  onModeChange: (mode: ControlPlaneMode) => void;
  runtimeUrl: string | null;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function CockpitControlPlane({
  navigationTree,
  manifest,
  entry,
  activeMode,
  onModeChange,
  runtimeUrl,
  mobile = false,
  onNavigate,
}: CockpitControlPlaneProps) {
  const preferences = useControlPlanePreferences('cockpit');
  const [activeUtility, setActiveUtility] = useState<'settings' | null>(null);
  const settingsRef = useRef<HTMLSpanElement>(null);

  const closeSettings = () => {
    settingsRef.current?.querySelector('button')?.focus();
    setActiveUtility(null);
  };

  const selectMode = (mode: ControlPlaneMode) => {
    setActiveUtility(null);
    if (mode !== activeMode) {
      track('cockpit:mode_switched', {
        capability: entry.topic,
        from_mode: MODES.find((candidate) => candidate.label === activeMode)?.analytics,
        to_mode: MODES.find((candidate) => candidate.label === mode)?.analytics,
      });
    }
    onModeChange(mode);
  };

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
            active={activeUtility === null && label === activeMode}
            onSelect={() => selectMode(label)}
          />
        ))}
        utilities={
          <span ref={settingsRef} className="cockpit-control-plane-utility-anchor">
            <ControlPlaneRailItem
              label="Settings"
              icon={<Settings size={18} aria-hidden="true" />}
              iconOnly
              active={activeUtility === 'settings'}
              onSelect={() => setActiveUtility((current) => current === 'settings' ? null : 'settings')}
            />
          </span>
        }
      />

      <ControlPlanePane label="Cockpit context">
        {activeUtility === 'settings' ? (
          <ControlPlaneUtilityPanel title="Settings" onClose={closeSettings}>
            <div className="cockpit-control-plane-setting">
              <span>Language</span>
              <LanguagePicker manifest={manifest} entry={entry} />
            </div>
            <div className="cockpit-control-plane-setting">
              <span>Theme</span>
              <ThemeToggle className="cockpit-control-plane-theme" />
            </div>
          </ControlPlaneUtilityPanel>
        ) : (
          <CockpitSidebar
            navigationTree={navigationTree}
            entry={entry}
            runtimeUrl={runtimeUrl}
            expanded={preferences.expanded}
            onExpandedChange={preferences.setExpanded}
            onNavigate={onNavigate}
          />
        )}
      </ControlPlanePane>
    </div>
  );
}
