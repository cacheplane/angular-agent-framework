import { Component, inject, Injector, OnInit } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
} from '@cacheplane/chat';
import { streamResource, StreamResourceRef } from '@cacheplane/stream-resource';

@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      <chat [ref]="chat" class="flex flex-col flex-1 overflow-hidden">
        <!--
          chat-interrupt-panel renders automatically when the thread has a
          pending interrupt. It exposes approve / reject / custom-reply slots.
        -->
        <chat-interrupt-panel class="border-t border-amber-800 bg-amber-950/40 px-4 py-3" />
      </chat>
    </div>
  `,
})
export class InterruptsAppComponent implements OnInit {
  private readonly injector = inject(Injector);
  chat!: StreamResourceRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => {
      this.chat = streamResource({ assistantId: 'interrupt_agent' });
    });
  }
}
