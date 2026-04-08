// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, signal } from '@angular/core';
import { JsonPipe, DatePipe } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { RenderSpecComponent } from '@cacheplane/render';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * ComputedFunctionsComponent demonstrates computed functions from @cacheplane/render.
 *
 * Shows how custom functions transform data for prop resolution in render specs.
 * The sidebar displays computed values including formatted dates, string transforms,
 * and math operations.
 */
@Component({
  selector: 'app-computed-functions',
  standalone: true,
  imports: [ChatComponent, RenderSpecComponent, JsonPipe, DatePipe],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Computed Values</h3>
        <div class="computed-values rounded-lg p-4 space-y-3" style="background: var(--chat-surface, #222);">
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Formatted Date</label>
            <span class="text-sm">{{ formattedDate() }}</span>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Uppercase Transform</label>
            <span class="text-sm">{{ uppercased() }}</span>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Math Result (7 x 6)</label>
            <span class="text-sm">{{ multiplied() }}</span>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Input Value</label>
            <input class="w-full px-2 py-1 rounded text-sm"
                   style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
                   [value]="inputValue()"
                   (input)="inputValue.set($any($event.target).value)" />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Reversed Input</label>
            <span class="text-sm">{{ reversed() }}</span>
          </div>
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">Functions Config</h4>
          <pre class="text-xs font-mono overflow-x-auto p-2 rounded"
               style="background: var(--chat-surface, #222); color: var(--chat-text-muted, #777);">{{ functionNames | json }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class ComputedFunctionsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly inputValue = signal('hello world');

  protected readonly formattedDate = computed(() =>
    new Date('2024-06-15T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  );

  protected readonly uppercased = computed(() => 'render specs are powerful'.toUpperCase());

  protected readonly multiplied = computed(() => 7 * 6);

  protected readonly reversed = computed(() =>
    this.inputValue().split('').reverse().join('')
  );

  protected readonly functionNames = ['formatDate', 'uppercase', 'multiply', 'reverse'];
}
