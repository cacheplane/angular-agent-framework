import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> intercepts memory tool-call events and renders them as
        collapsible trace nodes labelled by operation type:
          - store_memory   → key + value written
          - retrieve_memories → query + ranked results
          - delete_memory  → key removed
        This lets developers confirm that the agent is persisting the right
        facts and retrieving them with appropriate relevance scores.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Memory operations"
      />
    </div>
  `,
})
export class MemoryAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'memory_agent' });
    });
  }
}
