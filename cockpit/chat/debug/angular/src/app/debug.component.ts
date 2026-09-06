import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { ChatDebugComponent } from '@threadplane/chat/debug';
import { injectAgent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';

/**
 * DebugComponent pairs the standard `<chat>` composition with
 * `<chat-debug>`, the devtools dock that carries the timeline, state
 * inspector, and diff viewer.
 *
 * `<chat-debug>` renders `display: contents` and mounts its own fixed
 * launcher, so it adds no layout of its own; both elements carry the
 * layout's `main` projection attribute, and `<chat>` supplies the
 * transcript and the composer that produce the runs to inspect.
 */
@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [ChatComponent, ChatDebugComponent, ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <chat main [agent]="agent" />
      <chat-debug main [agent]="agent" />
    </example-chat-layout>
  `,
})
export class DebugPageComponent {
  protected readonly agent = injectAgent();
}
