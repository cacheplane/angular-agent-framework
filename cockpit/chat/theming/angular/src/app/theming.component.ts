// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ChatComponent } from '@threadplane/chat';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { injectAgent } from '@threadplane/langgraph';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--tplane-chat-bg': '#171717',
    '--tplane-chat-text': '#e0e0e0',
    '--tplane-chat-accent': '#3b82f6',
    '--tplane-chat-surface-alt': '#222',
    '--tplane-chat-separator': '#333',
    '--tplane-chat-text-muted': '#777',
  },
  light: {
    '--tplane-chat-bg': '#ffffff',
    '--tplane-chat-text': '#1a1a1a',
    '--tplane-chat-accent': '#2563eb',
    '--tplane-chat-surface-alt': '#f3f4f6',
    '--tplane-chat-separator': '#d1d5db',
    '--tplane-chat-text-muted': '#6b7280',
  },
  ocean: {
    '--tplane-chat-bg': '#0c1426',
    '--tplane-chat-text': '#c8d6e5',
    '--tplane-chat-accent': '#0abde3',
    '--tplane-chat-surface-alt': '#152238',
    '--tplane-chat-separator': '#1e3a5f',
    '--tplane-chat-text-muted': '#576574',
  },
  forest: {
    '--tplane-chat-bg': '#1a2e1a',
    '--tplane-chat-text': '#d4e6d4',
    '--tplane-chat-accent': '#4ade80',
    '--tplane-chat-surface-alt': '#243524',
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
      <div sidebar class="p-4 space-y-4" style="background: var(--tplane-chat-bg); color: var(--tplane-chat-text);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--tplane-chat-text-muted);">Theme Picker</h3>
        <div class="space-y-2">
          @for (name of themeNames; track name) {
            <button
              class="w-full px-3 py-2 rounded text-xs font-medium transition-colors"
              [style.background]="activeTheme() === name ? 'var(--tplane-chat-accent)' : 'var(--tplane-chat-surface-alt)'"
              [style.color]="activeTheme() === name ? '#fff' : 'var(--tplane-chat-text)'"
              (click)="setTheme(name)">
              {{ name | titlecase }}
            </button>
          }
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--tplane-chat-text-muted);">CSS Variables</h4>
          <ul class="text-xs space-y-1 font-mono" style="color: var(--tplane-chat-text-muted);">
            <li>--tplane-chat-bg</li>
            <li>--tplane-chat-text</li>
            <li>--tplane-chat-accent</li>
            <li>--tplane-chat-surface-alt</li>
            <li>--tplane-chat-separator</li>
            <li>--tplane-chat-text-muted</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
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
