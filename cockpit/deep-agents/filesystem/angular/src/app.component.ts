import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { ChatDebugComponent } from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-filesystem',
  standalone: true,
  imports: [ChatDebugComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <!--
        <chat-debug> intercepts tool-call events from the filesystem agent
        and renders each one as a collapsible trace node showing:
          - tool name (read_file / write_file / list_dir / …)
          - arguments (path, content, …)
          - result or error
        This lets developers verify correct filesystem interaction during
        development without adding any custom trace UI.
      -->
      <chat-debug
        [ref]="chat"
        class="flex-1 overflow-hidden"
        traceLabel="Filesystem operations"
      />
    </div>
  `,
})
export class FilesystemAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'filesystem_agent' });
    });
  }
}
