import { Component, Input, OnInit, Injector, runInInjectionContext } from '@angular/core';
import { agent } from '@cacheplane/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'stream-chat-demo',
  standalone: false,
  template: `
    <div class="chat-demo">
      <div class="messages" *ngIf="chat">
        <div *ngFor="let msg of chat.messages()" class="message" [class.ai]="msg.getType() === 'ai'">
          {{ msg.content }}
        </div>
        <div *ngIf="chat.isLoading()" class="loading">Thinking…</div>
      </div>
      <form (submit)="send($event)" class="input-row">
        <input #inputEl type="text" placeholder="Ask anything…" />
        <button type="submit">Send</button>
      </form>
    </div>
  `,
  styles: [`
    .chat-demo { font-family: Inter, system-ui, sans-serif; max-width: 560px; }
    .messages { min-height: 200px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .message { padding: 8px 12px; border-radius: 8px; font-size: 14px; color: #EEF1FF; background: rgba(108,142,255,0.08); }
    .message.ai { background: rgba(108,142,255,0.15); }
    .loading { font-size: 13px; color: #8B96C8; padding: 8px 12px; }
    .input-row { display: flex; gap: 8px; padding: 0 16px 16px; }
    .input-row input { flex: 1; padding: 8px 12px; border-radius: 6px; background: rgba(108,142,255,0.04); border: 1px solid rgba(108,142,255,0.15); color: #EEF1FF; font-size: 14px; outline: none; }
    .input-row button { padding: 8px 16px; border-radius: 6px; background: #6C8EFF; color: #fff; border: none; font-size: 14px; cursor: pointer; }
  `],
})
export class ChatDemoComponent implements OnInit {
  @Input() apiUrl = 'http://localhost:2024';
  @Input() assistantId = 'chat_agent';

  chat: ReturnType<typeof agent<{ messages: BaseMessage[] }>> | null = null;

  constructor(private injector: Injector) {}

  ngOnInit() {
    // @Input() values are available in ngOnInit, so use runInInjectionContext
    runInInjectionContext(this.injector, () => {
      this.chat = agent<{ messages: BaseMessage[] }>({
        apiUrl: this.apiUrl,
        assistantId: this.assistantId,
      });
    });
  }

  send(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const content = input.value.trim();
    if (!content || !this.chat) return;
    input.value = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.chat.submit({ messages: [{ role: 'human', content }] } as any);
  }
}
