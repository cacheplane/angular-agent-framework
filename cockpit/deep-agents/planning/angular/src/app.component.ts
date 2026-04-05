import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> renders both the final assistant message and the full
        internal reasoning trace produced by the planning agent. Each planning
        step (goal, sub-tasks, dependencies) is shown as a collapsible node
        so developers can drill into the agent's decision-making process.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Planning trace"
      />
    </div>
  `,
})
export class PlanningAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'planning_agent' });
    });
  }
}
