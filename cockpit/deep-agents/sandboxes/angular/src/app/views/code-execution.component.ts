import { Component, input } from '@angular/core';

@Component({
  selector: 'code-execution',
  standalone: true,
  template: `
    <div class="rounded-xl my-2 overflow-hidden"
         style="border: 1px solid var(--tplane-chat-separator); background: var(--tplane-chat-surface-alt);">
      <div class="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
           style="border-bottom: 1px solid var(--tplane-chat-separator); background: var(--tplane-chat-bg); color: var(--tplane-chat-text-muted);">
        Code Execution
      </div>
      <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-4 m-0 overflow-x-auto"
           style="color: var(--tplane-chat-text); background: var(--tplane-chat-surface-alt);">{{ code() }}</pre>
      @if (stdout()) {
        <div class="px-4 py-2"
             style="border-top: 1px solid var(--tplane-chat-separator);">
          <div class="text-xs font-semibold mb-1" style="color: var(--tplane-chat-success);">stdout</div>
          <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 m-0 rounded"
               style="background: var(--tplane-chat-bg); color: var(--tplane-chat-success);">{{ stdout() }}</pre>
        </div>
      }
      @if (stderr()) {
        <div class="px-4 py-2"
             style="border-top: 1px solid var(--tplane-chat-separator);">
          <div class="text-xs font-semibold mb-1" style="color: var(--tplane-chat-error-text);">stderr</div>
          <pre class="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed p-2 m-0 rounded"
               style="background: var(--tplane-chat-bg); color: var(--tplane-chat-error-text);">{{ stderr() }}</pre>
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
