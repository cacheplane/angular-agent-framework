import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ControlPlaneActionBar,
  ControlPlaneEnvironmentList,
  ControlPlaneIconButton,
  ControlPlanePane,
  ControlPlaneRail,
  ControlPlaneRailItem,
  ControlPlaneSection,
  ControlPlaneUtilityPanel,
} from './control-plane';

const Icon = () => <svg aria-hidden="true" data-testid="icon" />;

describe('control-plane structure', () => {
  it('renders labeled primary navigation and optional utilities', () => {
    render(
      <ControlPlaneRail
        label="Workspace modes"
        primary={
          <ControlPlaneRailItem
            label="Docs"
            icon={<Icon />}
            href="/docs"
            active
          />
        }
        utilities={
          <ControlPlaneRailItem
            label="Settings"
            icon={<Icon />}
            onSelect={vi.fn()}
            iconOnly
          />
        }
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Workspace modes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Docs')).toBeTruthy();
    const settings = screen.getByRole('button', { name: 'Settings' });
    const tooltip = screen.getByRole('tooltip', { name: 'Settings' });
    expect(settings.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(document.querySelector('[data-control-plane-rail-label]')?.textContent).not.toBe('Settings');
  });

  it('uses pressed semantics for active local mode and utility buttons', () => {
    render(
      <ControlPlaneRailItem label="Run" icon={<Icon />} active onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders a labeled contextual pane and environment facts', () => {
    render(
      <ControlPlanePane label="Docs context">
        <ControlPlaneEnvironmentList
          rows={[
            { label: 'Framework', value: 'Angular' },
            { label: 'Package manager', value: 'npm' },
          ]}
        />
      </ControlPlanePane>,
    );

    expect(screen.getByRole('complementary', { name: 'Docs context' })).toBeTruthy();
    expect(screen.getByText('Framework').tagName).toBe('DT');
    expect(screen.getByText('Angular').tagName).toBe('DD');
  });

  it('exposes controlled disclosure state and toggles it', () => {
    const onOpenChange = vi.fn();
    render(
      <ControlPlaneSection title="Environment" open onOpenChange={onOpenChange}>
        <p>Angular</p>
      </ControlPlaneSection>,
    );

    const trigger = screen.getByRole('button', { name: 'Environment' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
    expect(trigger.querySelector('svg[data-control-plane-chevron]')).toBeTruthy();
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('Angular')).toBeTruthy();
  });
});

describe('control-plane actions', () => {
  it('uses a labeled toolbar with accessible icon buttons', () => {
    render(
      <ControlPlaneActionBar label="Quick actions">
        <ControlPlaneIconButton label="Search" icon={<Icon />} onClick={vi.fn()} />
        <ControlPlaneIconButton label="Open runtime" icon={<Icon />} onClick={vi.fn()} />
      </ControlPlaneActionBar>,
    );

    expect(screen.getByRole('toolbar', { name: 'Quick actions' })).toBeTruthy();
    const search = screen.getByRole('button', { name: 'Search' });
    const tooltip = screen.getByRole('tooltip', { name: 'Search' });
    expect(search.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(search.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Open runtime' }).tabIndex).toBe(-1);
  });

  it('supports wrapping arrow navigation and Home/End while skipping disabled actions', () => {
    render(
      <ControlPlaneActionBar label="Quick actions">
        <ControlPlaneIconButton label="First" icon={<Icon />} onClick={vi.fn()} />
        <ControlPlaneIconButton label="Disabled" icon={<Icon />} onClick={vi.fn()} disabled />
        <ControlPlaneIconButton label="Last" icon={<Icon />} onClick={vi.fn()} />
      </ControlPlaneActionBar>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(first);
  });
});

describe('ControlPlaneUtilityPanel', () => {
  it('renders a title and closes from its button or Escape', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ControlPlaneUtilityPanel title="Settings" onClose={onClose}>
        Preferences
      </ControlPlaneUtilityPanel>,
    );

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ControlPlaneUtilityPanel title="Settings" onClose={onClose}>
        Preferences
      </ControlPlaneUtilityPanel>,
    );
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Settings' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
