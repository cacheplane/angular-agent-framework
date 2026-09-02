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
      />
    );

    expect(
      screen.getByRole('navigation', { name: 'Workspace modes' })
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Docs' }).getAttribute('aria-current')
    ).toBe('page');
    expect(screen.getByText('Docs')).toBeTruthy();
    const settings = screen.getByRole('button', { name: 'Settings' });
    const tooltip = screen.getByRole('tooltip', { name: 'Settings' });
    expect(settings.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(
      document.querySelector('[data-control-plane-rail-label]')?.textContent
    ).not.toBe('Settings');
  });

  it('uses pressed semantics for active local mode and utility buttons', () => {
    render(
      <ControlPlaneRailItem
        label="Run"
        icon={<Icon />}
        active
        onSelect={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Run' }).getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('keeps unavailable rail modes focusable, described, and inert', () => {
    const onSelect = vi.fn();
    render(
      <ControlPlaneRailItem
        label="Run"
        icon={<Icon />}
        disabled
        disabledReason="Run is unavailable for this page."
        onSelect={onSelect}
      />
    );

    const control = screen.getByRole('button', {
      name: 'Run',
      description: 'Run is unavailable for this page.',
    });
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect((control as HTMLButtonElement).disabled).toBe(false);
    control.focus();
    expect(document.activeElement).toBe(control);
    fireEvent.click(control);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders a status dot and folds its label into the accessible name', () => {
    render(
      <ControlPlaneRailItem
        label="Run"
        icon={<svg />}
        status={{ kind: 'error', label: 'runtime error' }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Run, runtime error' });
    expect(
      button.querySelector('[data-control-plane-rail-status]')?.getAttribute(
        'data-control-plane-rail-status',
      ),
    ).toBe('error');
  });

  it('gives a labeled status item the accessible name without a tooltip', () => {
    render(
      <ControlPlaneRailItem
        label="Run"
        icon={<svg />}
        status={{ kind: 'error', label: 'runtime error' }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Run, runtime error' });
    expect(button.querySelector('[data-control-plane-tooltip]')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders no status dot when status is omitted', () => {
    render(<ControlPlaneRailItem label="Run" icon={<svg />} />);
    const button = screen.getByRole('button', { name: 'Run' });
    expect(button.querySelector('[data-control-plane-rail-status]')).toBeNull();
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
      </ControlPlanePane>
    );

    expect(
      screen.getByRole('complementary', { name: 'Docs context' })
    ).toBeTruthy();
    expect(screen.getByText('Framework').tagName).toBe('DT');
    expect(screen.getByText('Angular').tagName).toBe('DD');
  });

  it('exposes controlled disclosure state and toggles it', () => {
    const onOpenChange = vi.fn();
    render(
      <ControlPlaneSection title="Environment" open onOpenChange={onOpenChange}>
        <p>Angular</p>
      </ControlPlaneSection>
    );

    const trigger = screen.getByRole('button', { name: 'Environment' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
    expect(
      trigger.querySelector('svg[data-control-plane-chevron]')
    ).toBeTruthy();
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('Angular')).toBeTruthy();
  });

  it('shows a section summary without adding it to the disclosure name', () => {
    render(
      <ControlPlaneSection title="Runtime" summary="Ready" open>
        <p>Shared development</p>
      </ControlPlaneSection>
    );

    const trigger = screen.getByRole('button', { name: 'Runtime' });
    expect(trigger.textContent).toContain('Ready');
    expect(
      trigger
        .querySelector('[data-control-plane-section-summary]')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
    expect(screen.queryByRole('button', { name: 'Runtime Ready' })).toBeNull();
  });

  it('describes a collapsed disclosure without changing its accessible name', () => {
    render(
      <ControlPlaneSection
        title="Runtime"
        summary="Unresponsive"
        description="Runtime status: Unresponsive"
        open={false}
      >
        <p>Shared development</p>
      </ControlPlaneSection>
    );

    expect(
      screen.getByRole('button', {
        name: 'Runtime',
        description: 'Runtime status: Unresponsive',
      })
    ).toBeTruthy();
    expect(screen.queryByText('Shared development')).toBeNull();
    expect(
      document.querySelectorAll('[data-control-plane-section-description]')
    ).toHaveLength(1);
  });
});

describe('control-plane actions', () => {
  it('uses a labeled toolbar with accessible icon buttons', () => {
    render(
      <ControlPlaneActionBar label="Quick actions">
        <ControlPlaneIconButton
          label="Search"
          icon={<Icon />}
          onClick={vi.fn()}
        />
        <ControlPlaneIconButton
          label="Open runtime"
          icon={<Icon />}
          onClick={vi.fn()}
        />
      </ControlPlaneActionBar>
    );

    expect(screen.getByRole('toolbar', { name: 'Quick actions' })).toBeTruthy();
    const search = screen.getByRole('button', { name: 'Search' });
    const tooltip = screen.getByRole('tooltip', { name: 'Search' });
    expect(search.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(search.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Open runtime' }).tabIndex).toBe(
      -1
    );
  });

  it('supports wrapping arrow navigation and Home/End while skipping disabled actions', () => {
    render(
      <ControlPlaneActionBar label="Quick actions">
        <ControlPlaneIconButton
          label="First"
          icon={<Icon />}
          onClick={vi.fn()}
        />
        <ControlPlaneIconButton
          label="Disabled"
          icon={<Icon />}
          onClick={vi.fn()}
          disabled
        />
        <ControlPlaneIconButton
          label="Last"
          icon={<Icon />}
          onClick={vi.fn()}
        />
      </ControlPlaneActionBar>
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
      </ControlPlaneUtilityPanel>
    );

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ControlPlaneUtilityPanel title="Settings" onClose={onClose}>
        Preferences
      </ControlPlaneUtilityPanel>
    );
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Settings' }), {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
