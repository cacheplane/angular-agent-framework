// SPDX-License-Identifier: MIT
'use client';

import React, { Component, type ReactNode } from 'react';
import { ControlPlaneUtilityPanel } from '@threadplane/ui-react';

export interface ActivityPanelBoundaryProps {
  children: ReactNode;
  resetKey: string | number;
  onClose(): void;
}

interface ActivityPanelBoundaryState {
  hasError: boolean;
}

export class ActivityPanelBoundary extends Component<
  ActivityPanelBoundaryProps,
  ActivityPanelBoundaryState
> {
  override state: ActivityPanelBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ActivityPanelBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // Keep the fallback fixed and local; operational errors are not rendered.
  }

  override componentDidUpdate(previousProps: ActivityPanelBoundaryProps): void {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <ControlPlaneUtilityPanel
          title="Activity unavailable"
          onClose={this.props.onClose}
        >
          <p>Activity unavailable</p>
        </ControlPlaneUtilityPanel>
      );
    }
    return this.props.children;
  }
}
