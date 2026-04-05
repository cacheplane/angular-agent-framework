import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import {
  ChatComponent,
  ChatTimelineSliderComponent,
} from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-time-travel',
  standalone: true,
  imports: [ChatComponent, ChatTimelineSliderComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <chat [ref]="chat" class="flex flex-col flex-1 overflow-hidden">
        <!--
          chat-timeline-slider renders a scrub bar beneath the messages.
          Selecting a checkpoint replays the thread from that state,
          allowing the user to branch the conversation from any prior turn.
        -->
        <chat-timeline-slider
          class="border-t border-gray-800 px-4 py-3 bg-gray-900"
        />
      </chat>
    </div>
  `,
})
export class TimeTravelAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'chat_agent' });
    });
  }
}
