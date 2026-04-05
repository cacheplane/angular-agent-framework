import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-sandboxes',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> intercepts sandbox execution events and renders them as
        collapsible trace nodes. Each node includes:
          - runtime identifier (python3, node, bash, …)
          - source code submitted to the sandbox
          - stdout / stderr captured during execution
          - exit code and elapsed time
        This makes it easy to inspect agent-generated code, reproduce failures,
        and verify that the sandbox environment is configured correctly.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Sandbox executions"
      />
    </div>
  `,
})
export class SandboxesAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'sandbox_agent' });
    });
  }
}
