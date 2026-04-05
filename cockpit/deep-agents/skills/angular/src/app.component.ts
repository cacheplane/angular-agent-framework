import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> renders each skill invocation as a top-level trace node.
        Expanding a node reveals the ordered sequence of tool calls the skill
        executed, including their arguments and results. This is particularly
        useful for verifying that the agent selects the correct skill variant
        and that skill parameters are bound accurately.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Skill invocations"
      />
    </div>
  `,
})
export class SkillsAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'skills_agent' });
    });
  }
}
