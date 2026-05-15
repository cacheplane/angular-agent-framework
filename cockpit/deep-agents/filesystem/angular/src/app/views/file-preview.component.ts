import { Component, input } from '@angular/core';

@Component({
  selector: 'file-preview',
  standalone: true,
  template: `
    <div class="rounded-xl my-2 overflow-hidden"
         style="border: 1px solid var(--ngaf-chat-separator); background: var(--ngaf-chat-surface-alt);">
      <div class="flex items-center justify-between px-4 py-2"
           style="border-bottom: 1px solid var(--ngaf-chat-separator); background: var(--ngaf-chat-bg);">
        <span class="text-sm font-mono truncate" style="color: var(--ngaf-chat-text);">{{ path() }}</span>
        <span class="text-xs ml-2 shrink-0" style="color: var(--ngaf-chat-text-muted);">{{ size() }}</span>
      </div>
      <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-4 m-0 overflow-x-auto"
           style="color: var(--ngaf-chat-text); background: var(--ngaf-chat-surface-alt);">{{ content() }}</pre>
    </div>
  `,
})
export class FilePreviewComponent {
  readonly path = input<string>('');
  readonly content = input<string>('');
  readonly size = input<string>('');
}
