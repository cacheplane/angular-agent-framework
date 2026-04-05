import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import {
  ChatComponent,
  ChatSubagentCardComponent,
} from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-subgraphs',
  standalone: true,
  imports: [ChatComponent, ChatSubagentCardComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        The <chat> host surfaces subgraph events as structured stream chunks.
        <chat-subagent-card> intercepts those events and renders a card for
        each active subgraph invocation inline with the message stream.
      -->
      <chat [ref]="chat" class="flex flex-col flex-1 overflow-hidden">
        <chat-subagent-card
          class="mx-4 my-2 rounded-xl border border-indigo-800 bg-indigo-950/40 p-3"
        />
      </chat>
    </div>
  `,
})
export class SubgraphsAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'orchestrator_agent' });
    });
  }
}
