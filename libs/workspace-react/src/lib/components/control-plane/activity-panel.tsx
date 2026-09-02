// SPDX-License-Identifier: MIT
'use client';

import { Circle, CircleCheck, TriangleAlert } from 'lucide-react';
import {
  ControlPlaneActionBar,
  ControlPlaneUtilityPanel,
} from '@threadplane/ui-react';
import type {
  ActivitySeverity,
  SessionActivityEvent,
} from '../../runtime/session-activity';
import {
  ControlPlaneOverflowMenu,
  ControlPlaneOverflowMenuItem,
} from './control-plane-overflow-menu';

export interface ActivityPanelProps {
  events: readonly SessionActivityEvent[];
  currentCapability: string;
  attention?: boolean;
  onClose(): void;
  onClear(): void | PromiseLike<void>;
  formatTimestamp?: (timestamp: string) => string;
}

const compactTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

const accessibleTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function parsedTimestamp(timestamp: string): Date | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultTimestamp(timestamp: string): string {
  const date = parsedTimestamp(timestamp);
  return date ? compactTimestampFormatter.format(date) : timestamp;
}

function accessibleTimestamp(timestamp: string): string {
  const date = parsedTimestamp(timestamp);
  return date ? accessibleTimestampFormatter.format(date) : timestamp;
}

function SeverityIcon({ severity }: { severity: ActivitySeverity }) {
  const Icon =
    severity === 'success'
      ? CircleCheck
      : severity === 'error'
      ? TriangleAlert
      : Circle;
  return (
    <span data-activity-severity-icon={severity}>
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

function byNewest(
  left: SessionActivityEvent,
  right: SessionActivityEvent
): number {
  const difference = Date.parse(right.at) - Date.parse(left.at);
  return Number.isFinite(difference) ? difference : 0;
}

export function ActivityPanel({
  events,
  currentCapability,
  attention = false,
  onClose,
  onClear,
  formatTimestamp = defaultTimestamp,
}: ActivityPanelProps) {
  const orderedEvents = [...events].sort(byNewest);
  const label = attention ? 'Activity, unread problems' : 'Activity';

  return (
    <ControlPlaneUtilityPanel title="Activity" onClose={onClose}>
      <ControlPlaneActionBar label="Activity actions">
        <ControlPlaneOverflowMenu label="Activity actions" placement="start">
          <ControlPlaneOverflowMenuItem onSelect={onClear}>
            Clear session activity
          </ControlPlaneOverflowMenuItem>
        </ControlPlaneOverflowMenu>
      </ControlPlaneActionBar>
      {orderedEvents.length === 0 ? (
        <p data-activity-empty>No operational activity this session.</p>
      ) : (
        <ol
          aria-label={label}
          data-activity-timeline
          data-activity-attention={attention || undefined}
        >
          {orderedEvents.map((event, index) => (
            <li
              key={event.id}
              data-activity-event
              data-activity-kind={event.kind}
              data-activity-severity={event.severity}
            >
              <SeverityIcon severity={event.severity} />
              <span data-activity-summary>{event.summary}</span>
              <time
                dateTime={event.at}
                aria-label={accessibleTimestamp(event.at)}
                data-activity-timestamp
              >
                {formatTimestamp(event.at)}
              </time>
              {event.capability !== currentCapability ? (
                <span data-activity-capability>{event.capability}</span>
              ) : null}
              {index < orderedEvents.length - 1 ? (
                <span aria-hidden="true" data-activity-connector />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </ControlPlaneUtilityPanel>
  );
}
