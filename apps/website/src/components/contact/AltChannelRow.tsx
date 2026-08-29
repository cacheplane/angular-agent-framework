// SPDX-License-Identifier: MIT
import React from 'react';

export function AltChannelRow() {
  return (
    <p className="contact-alt-row">
      <a href="/docs" className="contact-alt-link">docs</a>
      <span className="contact-alt-sep">·</span>
      <a href="https://github.com/cacheplane/angular-agent-framework/issues" className="contact-alt-link">GitHub issues</a>
      <span className="contact-alt-sep">·</span>
      <a href="https://discord.gg/cacheplane" className="contact-alt-link">Discord</a>
    </p>
  );
}
