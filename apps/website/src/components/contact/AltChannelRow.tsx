// SPDX-License-Identifier: MIT
import React from 'react';
import { tokens } from '@threadplane/design-tokens';

const linkStyle: React.CSSProperties = {
  color: tokens.colors.accent,
  textDecoration: 'none',
  fontSize: tokens.typography.body.size,
  fontFamily: tokens.typography.body.family,
};

export function AltChannelRow() {
  return (
    <p style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', margin: 0 }}>
      <a href="/docs" style={linkStyle}>docs</a>
      <span style={{ color: tokens.colors.textMuted }}>·</span>
      <a href="https://github.com/cacheplane/angular-agent-framework/issues" style={linkStyle}>GitHub issues</a>
      <span style={{ color: tokens.colors.textMuted }}>·</span>
      <a href="https://discord.gg/cacheplane" style={linkStyle}>Discord</a>
    </p>
  );
}
