import { Component } from '@angular/core';
import { ChatComponent } from '@cacheplane/chat';
import { streamResource } from '@cacheplane/stream-resource';
import { environment } from '../environments/environment';

/**
 * StreamingComponent demonstrates real-time LLM streaming with `streamResource()`.
 *
 * Uses the shared `@cacheplane/chat` component for the chat UI.
 * This is the simplest example — just streaming messages with no
 * additional capability features (no threads, interrupts, etc.).
 *
 * Key integration points:
 * - `streamResource()` creates a Signal-based streaming ref
 * - `stream.messages()` provides reactive access to the conversation
 * - `stream.submit()` fires a message to the LangGraph backend
 * - `stream.isLoading()` tracks whether a response is in progress
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <cp-chat
      [messages]="stream.messages()"
      [isLoading]="stream.isLoading()"
      [error]="stream.error()"
      (sendMessage)="send($event)"
    />
  `,
})
export class StreamingComponent {
  /**
   * The streaming resource ref — connects to the LangGraph Cloud backend.
   */
  protected readonly stream = streamResource({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  /**
   * Submits the user's message to the LangGraph streaming endpoint.
   */
  send(text: string): void {
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
