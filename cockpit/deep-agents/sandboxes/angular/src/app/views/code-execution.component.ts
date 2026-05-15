import { Component, input } from '@angular/core';

@Component({
  selector: 'code-execution',
  standalone: true,
  template: `
    <div class="rounded-xl my-2 overflow-hidden"
         style="border: 1px solid var(--ngaf-chat-separator); background: var(--ngaf-chat-surface-alt);">
      <div class="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
           style="border-bottom: 1px solid var(--ngaf-chat-separator); background: var(--ngaf-chat-bg); color: var(--ngaf-chat-text-muted);">
        Code Execution
      </div>
      <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-4 m-0 overflow-x-auto"
           style="color: var(--ngaf-chat-text); background: var(--ngaf-chat-surface-alt);">{{ code() }}</pre>
      @if (stdout()) {
        <div class="px-4 py-2"
             style="border-top: 1px solid var(--ngaf-chat-separator);">
          <div class="text-xs font-semibold mb-1" style="color: var(--ngaf-chat-success);">stdout</div>
          <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 m-0 rounded"
               style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-success);">{{ stdout() }}</pre>
        </div>
      }
      @if (stderr()) {
        <div class="px-4 py-2"
             style="border-top: 1px solid var(--ngaf-chat-separator);">
          <div class="text-xs font-semibold mb-1" style="color: var(--ngaf-chat-error-text);">stderr</div>
          <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 m-0 rounded"
               style="background: var(--ngaf-chat-bg); color: var(--ngaf-chat-error-text);">{{ stderr() }}</pre>
        </div>
      }
    </div>
  `,
})
export class CodeExecutionComponent {
  readonly code = input<string>('');
  readonly stdout = input<string>('');
  readonly stderr = input<string>('');
}
