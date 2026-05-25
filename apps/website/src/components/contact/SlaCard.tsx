// SPDX-License-Identifier: MIT
import React from 'react';
import { tokens } from '@threadplane/design-tokens';
import { Card } from '../ui/Card';

export function SlaCard() {
  return (
    <Card style={{ padding: 20, maxWidth: 480 }}>
      <p
        style={{
          margin: 0,
          color: tokens.colors.textPrimary,
          fontSize: tokens.typography.body.size,
          fontFamily: tokens.typography.body.family,
          lineHeight: tokens.typography.body.line,
        }}
      >
        Brian or someone on the team replies personally — from a real inbox, not <code>noreply@</code>. We read every message.
      </p>
    </Card>
  );
}
