// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ChatComponent } from '@cacheplane/chat';
import { RenderSpecComponent, signalStateStore } from '@cacheplane/render';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * RepeatLoopsComponent demonstrates repeat rendering from @cacheplane/render.
 *
 * Shows how to iterate over arrays using repeat specs with RepeatScope.
 * The sidebar displays a list of items rendered via repeat with add/remove buttons.
 */
@Component({
  selector: 'app-repeat-loops',
  standalone: true,
  imports: [ChatComponent, RenderSpecComponent, JsonPipe],
  template: `
    <div class="flex h-screen">
      <chat [ref]="stream" class="flex-1 min-w-0" />
      <aside class="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4"
             style="border-color: var(--chat-border, #333); background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);">
        <h3 class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--chat-text-muted, #777);">Repeat Loop Items</h3>
        <div class="rounded-lg p-4 space-y-2" style="background: var(--chat-surface, #222);">
          <ul class="item-list space-y-1">
            @for (item of items(); track item.name) {
              <li class="flex items-center justify-between text-sm px-2 py-1 rounded"
                  style="background: var(--chat-bg, #171717);">
                <span>{{ item.name }}</span>
                <button class="text-xs px-2 py-0.5 rounded"
                        style="background: var(--chat-border, #333); color: var(--chat-text-muted, #777);"
                        (click)="removeItem($index)">Remove</button>
              </li>
            }
          </ul>
          <button class="add-item mt-2 px-3 py-1 rounded text-xs font-medium w-full"
                  style="background: var(--chat-accent, #2563eb); color: white;"
                  (click)="addItem()">
            Add Item
          </button>
        </div>
        <div class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide mb-2"
              style="color: var(--chat-text-muted, #777);">State</h4>
          <pre class="text-xs font-mono overflow-x-auto p-2 rounded"
               style="background: var(--chat-surface, #222); color: var(--chat-text-muted, #777);">{{ items() | json }}</pre>
        </div>
      </aside>
    </div>
  `,
})
export class RepeatLoopsComponent {
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected readonly store = signalStateStore({
    items: [
      { name: 'Task Alpha', done: false },
      { name: 'Task Beta', done: true },
      { name: 'Task Gamma', done: false },
    ],
  });

  protected readonly items = this.store.get('/items');

  private counter = 0;

  addItem() {
    this.counter++;
    this.store.update((draft: any) => {
      draft.items.push({ name: `Task ${this.counter}`, done: false });
    });
  }

  removeItem(index: number) {
    this.store.update((draft: any) => {
      draft.items.splice(index, 1);
    });
  }
}
