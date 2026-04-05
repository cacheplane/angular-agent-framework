import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import {
  ChatComponent,
  ChatMessagesComponent,
  ChatInputComponent,
  ChatTypingIndicatorComponent,
} from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [
    ChatComponent,
    ChatMessagesComponent,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
  ],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <chat [ref]="chat" class="flex flex-col flex-1 overflow-hidden">
        <chat-messages class="flex-1 overflow-y-auto px-4 py-6" />
        <chat-typing-indicator class="px-4 py-2 text-sm text-gray-400" />
        <chat-input
          class="border-t border-gray-800 px-4 py-3"
          placeholder="Send a message…"
        />
      </chat>
    </div>
  `,
})
export class StreamingAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'chat_agent' });
    });
  }
}
