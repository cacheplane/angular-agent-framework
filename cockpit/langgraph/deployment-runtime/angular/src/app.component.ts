import { Component, inject, Injector, InjectionToken, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

/** Provide via environment.ts / environment.prod.ts for zero-code env switching. */
export const LANGGRAPH_CONFIG = new InjectionToken<{
  apiUrl: string;
  assistantId: string;
}>('LANGGRAPH_CONFIG', {
  factory: () => ({
    apiUrl: 'http://localhost:2024',
    assistantId: 'chat_agent',
  }),
});

@Component({
  selector: 'app-deployment-runtime',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        All deployment configuration (base URL, assistant ID, auth headers)
        comes from the LANGGRAPH_CONFIG injection token, which is swapped per
        environment at build time via Angular's fileReplacements in project.json.
        The <chat> template stays identical across local / staging / production.
      -->
      <chat [ref]="chat" class="flex-1" />
    </div>
  `,
})
export class DeploymentRuntimeAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  private readonly config = inject(LANGGRAPH_CONFIG);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({
        apiUrl: this.config.apiUrl,
        assistantId: this.config.assistantId,
      });
    });
  }
}
