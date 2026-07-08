// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ChatComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--tplane-chat-bg': '#171717',
    '--tplane-chat-surface': '#1c1c1c',
    '--tplane-chat-surface-alt': '#222222',
    '--tplane-chat-primary': '#3b82f6',
    '--tplane-chat-on-primary': '#ffffff',
    '--tplane-chat-text': '#e0e0e0',
    '--tplane-chat-separator': '#333',
    '--tplane-chat-text-muted': '#777',
  },
  light: {
    '--tplane-chat-bg': '#ffffff',
    '--tplane-chat-surface': '#ffffff',
    '--tplane-chat-surface-alt': '#f3f4f6',
    '--tplane-chat-primary': '#2563eb',
    '--tplane-chat-on-primary': '#ffffff',
    '--tplane-chat-text': '#1a1a1a',
    '--tplane-chat-separator': '#d1d5db',
    '--tplane-chat-text-muted': '#6b7280',
  },
  ocean: {
    '--tplane-chat-bg': '#0c1426',
    '--tplane-chat-surface': '#111b31',
    '--tplane-chat-surface-alt': '#152238',
    '--tplane-chat-primary': '#0abde3',
    '--tplane-chat-on-primary': '#07111f',
    '--tplane-chat-text': '#c8d6e5',
    '--tplane-chat-separator': '#1e3a5f',
    '--tplane-chat-text-muted': '#576574',
  },
  forest: {
    '--tplane-chat-bg': '#1a2e1a',
    '--tplane-chat-surface': '#203420',
    '--tplane-chat-surface-alt': '#243524',
    '--tplane-chat-primary': '#4ade80',
    '--tplane-chat-on-primary': '#102410',
    '--tplane-chat-text': '#d4e6d4',
    '--tplane-chat-separator': '#2d4a2d',
    '--tplane-chat-text-muted': '#6b8f6b',
  },
};

/**
 * ThemingComponent demonstrates chat theming with CSS custom properties.
 * A sidebar with theme picker buttons swaps CSS variables at runtime,
 * showcasing the --tplane-chat-* token system and custom theme presets.
 */
@Component({
  selector: 'app-theming',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent, TitleCasePipe],
  template: `
    <example-chat-layout sidebarWidth="18rem">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="panel">
        <h3 class="cap">Theme Picker</h3>
        <div class="theme-list">
          @for (name of themeNames; track name) {
            <button
              class="theme-button"
              [class.theme-button--active]="activeTheme() === name"
              (click)="setTheme(name)">
              {{ name | titlecase }}
            </button>
          }
        </div>
        <div>
          <h4 class="cap">CSS Variables</h4>
          <ul class="token-list">
            <li><code>--tplane-chat-bg</code></li>
            <li><code>--tplane-chat-surface</code></li>
            <li><code>--tplane-chat-surface-alt</code></li>
            <li><code>--tplane-chat-primary</code></li>
            <li><code>--tplane-chat-on-primary</code></li>
            <li><code>--tplane-chat-text</code></li>
            <li><code>--tplane-chat-separator</code></li>
            <li><code>--tplane-chat-text-muted</code></li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
  styles: [`
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--tplane-chat-bg);
      color: var(--tplane-chat-text);
    }

    .cap {
      margin: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: var(--tplane-chat-line-height-tight);
      text-transform: uppercase;
    }

    .theme-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .theme-button {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--tplane-chat-separator);
      border-radius: var(--tplane-chat-radius-button);
      background: var(--tplane-chat-surface-alt);
      color: var(--tplane-chat-text);
      cursor: pointer;
      font: inherit;
      font-size: var(--tplane-chat-font-size-xs);
      font-weight: 600;
      line-height: var(--tplane-chat-line-height-tight);
      text-align: left;
      transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .theme-button:hover {
      border-color: var(--tplane-chat-primary);
    }

    .theme-button--active {
      border-color: var(--tplane-chat-primary);
      background: var(--tplane-chat-primary);
      color: var(--tplane-chat-on-primary);
    }

    .token-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0.5rem 0 0;
      padding: 0;
      color: var(--tplane-chat-text-muted);
      font-size: var(--tplane-chat-font-size-xs);
      line-height: var(--tplane-chat-line-height);
      list-style: none;
    }

    .token-list code {
      color: var(--tplane-chat-text-muted);
      font-family: var(--tplane-chat-font-mono);
    }
  `],
})
export class ThemingComponent {
  protected readonly agent = injectAgent();

  protected readonly themeNames = Object.keys(THEMES);
  protected readonly activeTheme = signal('dark');

  setTheme(name: string) {
    const theme = THEMES[name];
    if (!theme) return;
    this.activeTheme.set(name);
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }
}
