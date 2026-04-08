// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { RenderSpecComponent, signalStateStore } from '@cacheplane/render';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * StateManagementComponent demonstrates signalStateStore from @cacheplane/render.
 *
 * Shows how to use get/set/update methods with JSON Pointer paths for
 * reactive state management. The sidebar displays an interactive form
 * with state store values that update reactively.
 */
@Component({
  selector: 'app-state-management',
  standalone: true,
  imports: [ChatComponent, RenderSpecComponent, JsonPipe],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">State Management</h3>
        <div class="state-display rounded-lg p-4 space-y-3" style="background: var(--chat-surface, #222);">
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Name</label>
            <input class="w-full px-2 py-1 rounded text-sm"
                   style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
                   [value]="store.get('/user/name')()"
                   (input)="store.set('/user/name', $any($event.target).value)" />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Age</label>
            <input class="w-full px-2 py-1 rounded text-sm" type="number"
                   style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
                   [value]="store.get('/user/age')()"
                   (input)="store.set('/user/age', +$any($event.target).value)" />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--chat-text-muted, #777);">Theme</label>
            <select class="w-full px-2 py-1 rounded text-sm"
                    style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
                    [value]="store.get('/settings/theme')()"
                    (change)="store.set('/settings/theme', $any($event.target).value)">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">Current State</h4>
          <pre class="text-xs font-mono overflow-x-auto p-2 rounded"
               style="background: var(--chat-surface, #222); color: var(--chat-text-muted, #777);">{{ currentState() | json }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class StateManagementComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly store = signalStateStore({
    user: { name: 'Alice', age: 30 },
    settings: { theme: 'dark' },
  });

  protected currentState() {
    return {
      user: {
        name: this.store.get('/user/name')(),
        age: this.store.get('/user/age')(),
      },
      settings: {
        theme: this.store.get('/settings/theme')(),
      },
    };
  }
}
