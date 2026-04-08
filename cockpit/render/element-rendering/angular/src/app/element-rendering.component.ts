// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { RenderSpecComponent, signalStateStore } from '@cacheplane/render';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * ElementRenderingComponent demonstrates RenderElementComponent from @cacheplane/render.
 *
 * Shows how nested element trees are recursively rendered with visibility conditions.
 * The sidebar displays a nested element tree with a toggle button for visibility,
 * while the chat area communicates with an agent that explains element rendering.
 */
@Component({
  selector: 'app-element-rendering',
  standalone: true,
  imports: [ChatComponent, RenderSpecComponent, JsonPipe],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Nested Elements</h3>
        <div class="rounded-lg p-4" style="background: var(--chat-surface, #222);">
          <render-spec [spec]="demoSpec()" [store]="store" />
        </div>
        <button
          class="toggle-visibility mt-2 px-3 py-1 rounded text-xs font-medium"
          style="background: var(--chat-accent, #2563eb); color: white;"
          (click)="toggleVisibility()">
          Toggle Detail Visibility
        </button>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">JSON Spec</h4>
          <pre class="text-xs font-mono overflow-x-auto p-2 rounded"
               style="background: var(--chat-surface, #222); color: var(--chat-text-muted, #777);">{{ demoSpec() | json }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class ElementRenderingComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly store = signalStateStore({ showDetail: true });

  protected readonly demoSpec = signal({
    type: 'container',
    props: { class: 'space-y-2' },
    children: [
      { type: 'text', props: { content: 'Parent Element' } },
      {
        type: 'container',
        props: { class: 'pl-4 space-y-1' },
        children: [
          { type: 'text', props: { content: 'Child element (always visible)' } },
          { type: 'text', props: { content: 'Detail child (toggleable)', visible: { bind: '/showDetail' } } },
        ],
      },
    ],
  });

  toggleVisibility() {
    const current = this.store.get('/showDetail')();
    this.store.set('/showDetail', !current);
  }
}
