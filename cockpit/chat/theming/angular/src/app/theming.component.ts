// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, signal } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
import { environment } from '../environments/environment';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--chat-bg': '#171717',
    '--chat-text': '#e0e0e0',
    '--chat-accent': '#3b82f6',
    '--chat-surface': '#222',
    '--chat-border': '#333',
    '--chat-text-muted': '#777',
  },
  light: {
    '--chat-bg': '#ffffff',
    '--chat-text': '#1a1a1a',
    '--chat-accent': '#2563eb',
    '--chat-surface': '#f3f4f6',
    '--chat-border': '#d1d5db',
    '--chat-text-muted': '#6b7280',
  },
  ocean: {
    '--chat-bg': '#0c1426',
    '--chat-text': '#c8d6e5',
    '--chat-accent': '#0abde3',
    '--chat-surface': '#152238',
    '--chat-border': '#1e3a5f',
    '--chat-text-muted': '#576574',
  },
  forest: {
    '--chat-bg': '#1a2e1a',
    '--chat-text': '#d4e6d4',
    '--chat-accent': '#4ade80',
    '--chat-surface': '#243524',
    '--chat-border': '#2d4a2d',
    '--chat-text-muted': '#6b8f6b',
  },
};

/**
 * ThemingComponent demonstrates chat theming with CSS custom properties.
 * A sidebar with theme picker buttons swaps CSS variables at runtime,
 * showcasing CHAT_THEME_STYLES and custom theme presets.
 */
@Component({
  selector: 'app-theming',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-72 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Theme Picker</h3>
        <div class="space-y-2">
          @for (name of themeNames; track name) {
            <button
              class="w-full px-3 py-2 rounded text-xs font-medium transition-colors"
              [style.background]="activeTheme() === name ? 'var(--chat-accent, #3b82f6)' : 'var(--chat-surface, #222)'"
              [style.color]="activeTheme() === name ? '#fff' : 'var(--chat-text, #e0e0e0)'"
              (click)="setTheme(name)">
              {{ name | titlecase }}
            </button>
          }
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">CSS Variables</h4>
          <ul class="text-xs space-y-1 font-mono" style="color: var(--chat-text-muted, #777);">
            <li>--chat-bg</li>
            <li>--chat-text</li>
            <li>--chat-accent</li>
            <li>--chat-surface</li>
            <li>--chat-border</li>
            <li>--chat-text-muted</li>
          </ul>
        </div>
      </aside>
    </div>
  `,
})
export class ThemingComponent {
  protected readonly stream = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

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
