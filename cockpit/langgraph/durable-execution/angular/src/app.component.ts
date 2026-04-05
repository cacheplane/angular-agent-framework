import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatComponent, ChatErrorComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-durable-execution',
  standalone: true,
  imports: [ChatComponent, ChatErrorComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        streamResource retries with exponential back-off on network failure.
        <chat-error> surfaces the error state with a manual reconnect button
        when retries are exhausted, then auto-dismisses once the stream is
        healthy. Execution resumes from the last persisted LangGraph checkpoint.
      -->
      <chat [ref]="chat" class="flex flex-col flex-1 overflow-hidden">
        <chat-error
          class="border-t border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300"
          reconnectLabel="Reconnect"
        />
      </chat>
    </div>
  `,
})
export class DurableExecutionAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({
        assistantId: 'chat_agent',
        retry: { maxAttempts: 5, baseDelayMs: 500 },
      });
    });
  }
}
