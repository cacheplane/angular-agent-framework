// SPDX-License-Identifier: MIT
import { Component, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ChatComponent } from '@ngaf/chat';
import { ExampleChatLayoutComponent } from '@ngaf/example-layouts';
import { agent } from '@ngaf/langgraph';
import { environment } from '../environments/environment';

const THEMES: Record<string, Record<string, string>> = {
  dark: {
    '--ngaf-chat-bg': '#171717',
    '--ngaf-chat-text': '#e0e0e0',
    '--ngaf-chat-accent': '#3b82f6',
    '--ngaf-chat-surface-alt': '#222',
    '--ngaf-chat-separator': '#333',
    '--ngaf-chat-text-muted': '#777',
  },
  light: {
    '--ngaf-chat-bg': '#ffffff',
    '--ngaf-chat-text': '#1a1a1a',
    '--ngaf-chat-accent': '#2563eb',
    '--ngaf-chat-surface-alt': '#f3f4f6',
    '--ngaf-chat-separator': '#d1d5db',
    '--ngaf-chat-text-muted': '#6b7280',
  },
  ocean: {
    '--ngaf-chat-bg': '#0c1426',
    '--ngaf-chat-text': '#c8d6e5',
    '--ngaf-chat-accent': '#0abde3',
    '--ngaf-chat-surface-alt': '#152238',
    '--ngaf-chat-separator': '#1e3a5f',
    '--ngaf-chat-text-muted': '#576574',
  },
  forest: {
    '--ngaf-chat-bg': '#1a2e1a',
    '--ngaf-chat-text': '#d4e6d4',
    '--ngaf-chat-accent': '#4ade80',
    '--ngaf-chat-surface-alt': '#243524',
    '--ngaf-chat-separator': '#2d4a2d',
    '--ngaf-chat-text-muted': '#6b8f6b',
  },
};

/**
 * ThemingComponent demonstrates chat theming with CSS custom properties.
 * A sidebar with theme picker buttons swaps CSS variables at runtime,
 * showcasing the --ngaf-chat-* token system and custom theme presets.
 */
@Component({
  selector: 'app-theming',
  standalone: true,
  imports: [ChatComponent, ExampleChatLayoutComponent, TitleCasePipe],
  template: `
    <example-chat-layout sidebarWidth="w-72">
      <chat main [agent]="agent" class="flex-1 min-w-0" />
      <div sidebar class="p-4 space-y-4" style="background: var(--ngaf-chat-bg, #171717); color: var(--ngaf-chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--ngaf-chat-text-muted, #777);">Theme Picker</h3>
        <div class="space-y-2">
          @for (name of themeNames; track name) {
            <button
              class="w-full px-3 py-2 rounded text-xs font-medium transition-colors"
              [style.background]="activeTheme() === name ? 'var(--ngaf-chat-accent, #3b82f6)' : 'var(--ngaf-chat-surface-alt, #222)'"
              [style.color]="activeTheme() === name ? '#fff' : 'var(--ngaf-chat-text, #e0e0e0)'"
              (click)="setTheme(name)">
              {{ name | titlecase }}
            </button>
          }
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--ngaf-chat-text-muted, #777);">CSS Variables</h4>
          <ul class="text-xs space-y-1 font-mono" style="color: var(--ngaf-chat-text-muted, #777);">
            <li>--ngaf-chat-bg</li>
            <li>--ngaf-chat-text</li>
            <li>--ngaf-chat-accent</li>
            <li>--ngaf-chat-surface-alt</li>
            <li>--ngaf-chat-separator</li>
            <li>--ngaf-chat-text-muted</li>
          </ul>
        </div>
      </div>
    </example-chat-layout>
  `,
})
export class ThemingComponent {
  protected readonly agent = agent({
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
