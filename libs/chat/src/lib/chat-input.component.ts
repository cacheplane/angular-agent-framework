import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Chat input bar with text field and send button.
 * Emits sendMessage when user submits.
 */
@Component({
  selector: 'cp-chat-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="cp-input" (ngSubmit)="onSend()">
      <input [(ngModel)]="text" name="prompt" [placeholder]="placeholder" [disabled]="disabled" />
      <button type="submit" [disabled]="disabled || !text.trim()">
        {{ disabled ? 'Streaming...' : 'Send' }}
      </button>
    </form>
  `,
  styles: [`
    .cp-input { display: flex; gap: 0.5rem; }
    .cp-input input { flex: 1; padding: 0.75rem 1rem; border: 1px solid rgba(0,64,144,0.15); border-radius: 0.5rem; background: rgba(255,255,255,0.7); color: #1a1a2e; font: inherit; font-size: 0.9rem; }
    .cp-input input:focus { outline: none; border-color: rgba(0,64,144,0.3); }
    .cp-input button { padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; background: #004090; color: #fff; font: inherit; font-size: 0.85rem; cursor: pointer; transition: opacity 0.15s; }
    .cp-input button:disabled { opacity: 0.5; cursor: not-allowed; }
    .cp-input button:hover:not(:disabled) { opacity: 0.9; }
  `],
})
export class ChatInputComponent {
  @Input() placeholder = 'Type a message...';
  @Input() disabled = false;
  @Output() sendMessage = new EventEmitter<string>();

  text = '';

  onSend(): void {
    const msg = this.text.trim();
    if (!msg || this.disabled) return;
    this.sendMessage.emit(msg);
    this.text = '';
  }
}
