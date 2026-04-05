import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ChatMessageComponent } from './chat-message.component';
import { ChatInputComponent } from './chat-input.component';

/**
 * Headful chat component for stream-resource demos.
 *
 * Renders a message list, input bar, and optional sidebar via content projection.
 * Used by all LangGraph cockpit examples.
 *
 * @example
 * ```html
 * <cp-chat
 *   [messages]="stream.messages()"
 *   [isLoading]="stream.isLoading()"
 *   [error]="stream.error()"
 *   (sendMessage)="stream.submit({ messages: [{ role: 'human', content: $event }] })">
 *   <ng-template #sidebar>
 *     <p>Custom sidebar content</p>
 *   </ng-template>
 * </cp-chat>
 * ```
 */
@Component({
  selector: 'cp-chat',
  standalone: true,
  imports: [ChatMessageComponent, ChatInputComponent, NgTemplateOutlet],
  template: `
    <div class="cp-chat" [class.cp-chat--with-sidebar]="!!sidebarTemplate">
      <div class="cp-chat__main">
        <div class="cp-chat__messages">
          @for (msg of messages; track $index) {
            <cp-chat-message [type]="msg.type" [content]="msg.content" />
          }
          @empty {
            <p class="cp-chat__empty">Send a message to start.</p>
          }
        </div>
        @if (error) {
          <p class="cp-chat__error">{{ error }}</p>
        }
        <cp-chat-input [disabled]="isLoading" (sendMessage)="sendMessage.emit($event)" />
      </div>
      @if (sidebarTemplate) {
        <aside class="cp-chat__sidebar">
          <ng-container [ngTemplateOutlet]="sidebarTemplate" />
        </aside>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .cp-chat { display: grid; grid-template-columns: 1fr; height: 100%; }
    .cp-chat--with-sidebar { grid-template-columns: 1fr 260px; }
    .cp-chat__main { display: flex; flex-direction: column; gap: 0.75rem; max-width: 640px; width: 100%; margin: 0 auto; padding: 1rem; height: 100%; min-height: 0; }
    .cp-chat__messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
    .cp-chat__empty { color: #8b8fa3; font-size: 0.85rem; text-align: center; margin-top: 2rem; }
    .cp-chat__error { color: #ef4444; font-size: 0.85rem; padding: 0.5rem; background: rgba(239,68,68,0.06); border-radius: 0.25rem; }
    .cp-chat__sidebar { padding: 1rem; border-left: 1px solid rgba(0,64,144,0.08); overflow-y: auto; font-size: 0.85rem; }
    @media (max-width: 768px) {
      .cp-chat--with-sidebar { grid-template-columns: 1fr; }
      .cp-chat__sidebar { border-left: none; border-top: 1px solid rgba(0,64,144,0.08); max-height: 200px; }
    }
  `],
})
export class ChatComponent {
  @Input() messages: Array<{ type: string; content: string }> = [];
  @Input() isLoading = false;
  @Input() error: unknown = null;
  @Output() sendMessage = new EventEmitter<string>();
  @ContentChild('sidebar') sidebarTemplate?: TemplateRef<unknown>;
}
