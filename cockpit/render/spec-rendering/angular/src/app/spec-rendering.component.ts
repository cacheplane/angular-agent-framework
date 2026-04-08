// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { RenderSpecComponent, signalStateStore } from '@cacheplane/render';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * SpecRenderingComponent demonstrates RenderSpecComponent from @cacheplane/render.
 *
 * Shows how JSON render specs are converted into live Angular components.
 * The sidebar displays a live render spec preview using RenderSpecComponent,
 * while the chat area communicates with an agent that explains spec rendering.
 */
@Component({
  selector: 'app-spec-rendering',
  standalone: true,
  imports: [ChatComponent, RenderSpecComponent, JsonPipe],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Live Render Preview</h3>
        <div class="rounded-lg p-4" style="background: var(--chat-surface, #222);">
          <render-spec [spec]="demoSpec()" [store]="store" />
        </div>
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
export class SpecRenderingComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly store = signalStateStore({ greeting: 'Hello from RenderSpec!' });

  protected readonly demoSpec = signal({
    type: 'container',
    props: { class: 'space-y-2' },
    children: [
      { type: 'text', props: { content: 'This UI is rendered from a JSON spec' } },
      { type: 'text', props: { bind: '/greeting' } },
    ],
  });
}
