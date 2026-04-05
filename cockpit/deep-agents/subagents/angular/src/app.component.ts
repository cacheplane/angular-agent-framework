import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-subagents',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> surfaces subagent delegation events as a tree of
        collapsible trace nodes. Each node shows:
          - subagent name / assistant ID
          - instructions passed by the orchestrator
          - the subagent's response or error
        Developers can expand any node to inspect the full message payload
        exchanged between the orchestrator and each subagent.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Subagent delegation trace"
      />
    </div>
  `,
})
export class SubagentsAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'orchestrator_agent' });
    });
  }
}
